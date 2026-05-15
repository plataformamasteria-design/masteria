/**
 * sinais-diarios.ts — Coleta sinais operacionais do dia para briefing AI.
 *
 * Reutiliza funções canônicas:
 * - getInvestimentoPorPeriodo (ads_performance — fonte única de investimento)
 * - calcularForecast (forecast-comercial.ts — pipeline ponderado)
 *
 * Tabelas consultadas: leads_crm, contratos, clientes_receita,
 * metas_mensais, ads_performance (via canônica).
 */
import { createClient } from "@supabase/supabase-js";
import { getInvestimentoPorPeriodo } from "@/lib/metricas/investimento";
import { calcularForecast } from "@/lib/forecast/forecast-comercial";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export interface SinaisDiarios {
  ontem: {
    leads_chegaram: number;
    contratos_fechados: number;
    valor_fechado: number;
    investimento_meta: number;
    cpl_dia: number;
  };
  hoje_planejado: {
    reunioes_agendadas: number;
    leads_aguardando_sla_vermelho: number;
    propostas_enviadas_aguardando: number;
  };
  alertas: Array<{
    tipo: "critico" | "atencao" | "info";
    mensagem: string;
  }>;
  metricas_chave: {
    pipeline_aberto_total: number;
    forecast_mes: number;
    gap_meta_pct: number;
    score_saude_medio: number;
  };
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function coletarSinaisDiarios(): Promise<SinaisDiarios> {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const ontemIso = toIso(ontem);
  const mesAtual = toIso(hoje).slice(0, 7);

  // ─── Ontem ───────────────────────────────────────────
  const [
    { data: leadsOntem },
    { data: contratosOntem },
    investOntem,
  ] = await Promise.all([
    supabase
      .from("leads_crm")
      .select("id", { count: "exact", head: true })
      .gte("ghl_created_at", `${ontemIso}T00:00:00`)
      .lte("ghl_created_at", `${ontemIso}T23:59:59`),
    supabase
      .from("contratos")
      .select("id, valor_entrada")
      .eq("status", "ativo")
      .gte("data_fechamento", `${ontemIso}T00:00:00`)
      .lte("data_fechamento", `${ontemIso}T23:59:59`),
    getInvestimentoPorPeriodo(ontemIso, ontemIso),
  ]);

  // leads_crm count usa head:true, o count vem separado
  const { count: leadsOntemCount } = await supabase
    .from("leads_crm")
    .select("id", { count: "exact", head: true })
    .gte("ghl_created_at", `${ontemIso}T00:00:00`)
    .lte("ghl_created_at", `${ontemIso}T23:59:59`);

  const totalLeadsOntem = leadsOntemCount || 0;
  const totalContratosOntem = (contratosOntem || []).length;
  const valorFechadoOntem = (contratosOntem || []).reduce(
    (s, c) => s + Number(c.valor_entrada || 0), 0
  );
  const investOntemVal = investOntem.valor;
  const cplOntem = totalLeadsOntem > 0 ? investOntemVal / totalLeadsOntem : 0;

  // ─── Hoje planejado ──────────────────────────────────
  const hojeIso = toIso(hoje);

  // Reuniões agendadas para hoje (leads com etapa reuniao_agendada e data_reuniao hoje)
  const { count: reunioesHoje } = await supabase
    .from("leads_crm")
    .select("id", { count: "exact", head: true })
    .eq("etapa", "reuniao_agendada")
    .gte("data_reuniao_agendada", `${hojeIso}T00:00:00`)
    .lte("data_reuniao_agendada", `${hojeIso}T23:59:59`);

  // Leads com SLA vermelho (>48h sem ação, etapa = oportunidade ou ligacao)
  const sla48h = new Date(hoje);
  sla48h.setHours(sla48h.getHours() - 48);
  const { count: leadsSlaCritico } = await supabase
    .from("leads_crm")
    .select("id", { count: "exact", head: true })
    .in("etapa", ["oportunidade", "ligacao"])
    .lte("ghl_created_at", sla48h.toISOString());

  // Propostas aguardando resposta
  const { count: propostasAguardando } = await supabase
    .from("leads_crm")
    .select("id", { count: "exact", head: true })
    .in("etapa", ["proposta_enviada", "follow_up"]);

  // ─── Métricas-chave ──────────────────────────────────
  const forecast = await calcularForecast({ mes_referencia: mesAtual });

  // Meta do mês (metas_mensais)
  const { data: metaMes } = await supabase
    .from("metas_mensais")
    .select("meta_entrada_valor, meta_faturamento_total")
    .eq("mes_referencia", mesAtual)
    .maybeSingle();

  const metaReceita = Number(metaMes?.meta_faturamento_total || metaMes?.meta_entrada_valor || 0);
  const forecastTotal = forecast.ja_fechado_no_mes + forecast.forecast_ponderado;
  const gapPct = metaReceita > 0
    ? Math.round(((metaReceita - forecastTotal) / metaReceita) * 100)
    : 0;

  // Score de saúde médio (clientes_receita)
  const { data: scores } = await supabase
    .from("clientes_receita")
    .select("score_saude")
    .in("status_financeiro", ["ativo", "pausado", "pagou_integral", "parceria"])
    .not("score_saude", "is", null);

  const scoreMedio = (scores || []).length > 0
    ? Math.round((scores || []).reduce((s, c) => s + Number(c.score_saude), 0) / (scores || []).length)
    : 0;

  // ─── Alertas ─────────────────────────────────────────
  const alertas: SinaisDiarios["alertas"] = [];

  if ((leadsSlaCritico || 0) > 3) {
    alertas.push({
      tipo: "critico",
      mensagem: `${leadsSlaCritico} leads aguardando há mais de 48h sem ação`,
    });
  } else if ((leadsSlaCritico || 0) > 0) {
    alertas.push({
      tipo: "atencao",
      mensagem: `${leadsSlaCritico} lead(s) aguardando há mais de 48h`,
    });
  }

  if (gapPct > 30) {
    alertas.push({
      tipo: "critico",
      mensagem: `Gap de ${gapPct}% para a meta do mês — risco de não bater`,
    });
  } else if (gapPct > 10) {
    alertas.push({
      tipo: "atencao",
      mensagem: `Gap de ${gapPct}% para a meta — atenção ao ritmo`,
    });
  }

  if (scoreMedio > 0 && scoreMedio < 50) {
    alertas.push({
      tipo: "atencao",
      mensagem: `Score de saúde médio da carteira está em ${scoreMedio}/100 — abaixo do ideal`,
    });
  }

  if (totalLeadsOntem === 0 && ontem.getDay() >= 1 && ontem.getDay() <= 5) {
    alertas.push({
      tipo: "atencao",
      mensagem: "Zero leads ontem em dia útil — verificar campanhas Meta",
    });
  }

  if (alertas.length === 0) {
    alertas.push({ tipo: "info", mensagem: "Operação normal, sem alertas" });
  }

  return {
    ontem: {
      leads_chegaram: totalLeadsOntem,
      contratos_fechados: totalContratosOntem,
      valor_fechado: valorFechadoOntem,
      investimento_meta: Math.round(investOntemVal * 100) / 100,
      cpl_dia: Math.round(cplOntem * 100) / 100,
    },
    hoje_planejado: {
      reunioes_agendadas: reunioesHoje || 0,
      leads_aguardando_sla_vermelho: leadsSlaCritico || 0,
      propostas_enviadas_aguardando: propostasAguardando || 0,
    },
    alertas,
    metricas_chave: {
      pipeline_aberto_total: forecast.pipeline_aberto,
      forecast_mes: forecastTotal,
      gap_meta_pct: gapPct,
      score_saude_medio: scoreMedio,
    },
  };
}
