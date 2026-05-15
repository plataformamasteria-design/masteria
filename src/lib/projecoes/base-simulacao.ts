/**
 * getBaseSimulacao() — Calcula media dos ultimos 3 meses fechados
 * para servir como ponto de partida dos sliders do simulador.
 *
 * Fontes (todas existentes, nenhuma logica nova):
 * - computeAquisicaoResumo() — custos, contratos, MRR, CAC, ROAS
 * - vw_trafego_funil_mensal — reunioes, no-show, conversoes
 * - getInvestimentoMensal() — investimento Meta
 * - clientes_receita.ltv_meses — LTV medio
 * - comissoes_mes_status — determina meses fechados
 *
 * Docs: docs/projecoes/base-simulacao.md
 */
import { createClient } from "@supabase/supabase-js";
import { computeAquisicaoResumo } from "@/app/api/projecoes/aquisicao-resumo/route";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export interface BaseSimulacao {
  periodo_referencia: {
    inicio: string;
    fim: string;
    meses: string[];
  };
  funil: {
    investimento_midia: number;
    cpl: number;
    leads: number;
    reunioes_agendadas: number;
    reunioes_feitas: number;
    cprf: number;
    taxa_no_show_pct: number;
    taxa_conversao_sdr_pct: number;
    taxa_conversao_closer_pct: number;
  };
  custo_aquisicao: {
    salario_closers: number;
    salario_sdr: number;
    comissao_closers: number;
    comissao_sdr: number;
  };
  saude_financeira: {
    contratos_novos: number;
    mrr_medio_contrato: number;
    custo_operacional_total: number;
    custo_servir_unitario: number;
    clientes_ativos: number;
  };
  derivados_atuais: {
    cac_unitario: number;
    margem_mensal_cliente: number;
    payback_meses: number | null;
    ltv_real: number;
    roas_real: number;
    roas_cash: number;
    lucro_mensal_aproximado: number;
  };
}

/**
 * Retorna os ultimos N meses candidatos (excluindo o atual).
 */
function getCandidateMonths(n: number): string[] {
  const meses: string[] = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

/**
 * Busca os 3 meses mais recentes com comissao fechada.
 * Se nao encontrar 3 fechados nos ultimos 6, usa os 3 mais recentes disponiveis.
 */
async function getMesesFechados(): Promise<string[]> {
  const candidatos = getCandidateMonths(6);

  const { data: statusRows } = await supabase
    .from("comissoes_mes_status")
    .select("mes_referencia, status")
    .in("mes_referencia", candidatos)
    .eq("status", "fechado")
    .order("mes_referencia", { ascending: false })
    .limit(3);

  const fechados = (statusRows || []).map((r) => r.mes_referencia);

  if (fechados.length >= 3) {
    return fechados.sort();
  }

  // Fallback: usar os 3 mais recentes independente do status
  return candidatos.slice(0, 3).sort();
}

const safe = (n: number, d: number): number => (d > 0 ? n / d : 0);

export async function getBaseSimulacao(): Promise<BaseSimulacao> {
  const meses = await getMesesFechados();

  // Buscar dados de cada mes em paralelo
  const [resumos, reunioesRows, leadsRows, ltvRows] = await Promise.all([
    // 1. Aquisicao-resumo para cada mes (reutiliza logica existente)
    Promise.all(meses.map((m) => computeAquisicaoResumo(m))),

    // 2. Reunioes de vw_reunioes_consolidada (fonte real: lancamentos_diarios)
    // Substitui vw_trafego_funil_mensal que usava dados de CRM pipeline (errados)
    // Docs: docs/auditoria/etapa6-fix-fontes-reuniao.md
    supabase
      .from("vw_reunioes_consolidada")
      .select("mes_referencia, reunioes_agendadas, reunioes_realizadas, reunioes_no_show, contratos_fechados")
      .in("mes_referencia", meses)
      .then((r) => r.data || []),

    // 3. Leads do CRM (contagem por mes_referencia)
    supabase
      .from("leads_crm")
      .select("mes_referencia")
      .in("mes_referencia", meses)
      .then((r) => r.data || []),

    // 4. LTV medio
    supabase
      .from("clientes_receita")
      .select("ltv_meses")
      .gt("ltv_meses", 0)
      .then((r) => r.data || []),
  ]);

  // LTV medio da carteira
  const ltvArr = ltvRows.map((r: any) => Number(r.ltv_meses)).filter((v: number) => v > 0);
  const ltvMesesMedio = ltvArr.length > 0
    ? ltvArr.reduce((s: number, v: number) => s + v, 0) / ltvArr.length
    : 4.3; // fallback documentado

  const n = meses.length;

  // --- Agregar reunioes (fonte: lancamentos_diarios via vw_reunioes_consolidada) ---
  let totalReunioesAgendadas = 0;
  let totalReunioesRealizadas = 0;
  let totalNoShows = 0;
  let totalClientesFechadosReuniao = 0;
  for (const row of reunioesRows) {
    totalReunioesAgendadas += Number((row as any).reunioes_agendadas || 0);
    totalReunioesRealizadas += Number((row as any).reunioes_realizadas || 0);
    totalNoShows += Number((row as any).reunioes_no_show || 0);
    totalClientesFechadosReuniao += Number((row as any).contratos_fechados || 0);
  }

  // Medias mensais do funil
  const mediaReunioesAgendadas = totalReunioesAgendadas / n;
  const mediaReunioesFeitas = totalReunioesRealizadas / n;

  // --- Agregar custos (de computeAquisicaoResumo) ---
  let totalInvestimento = 0;
  let totalSalarioClosers = 0;
  let totalSalarioSdr = 0;
  let totalComissaoClosers = 0;
  let totalComissaoSdr = 0;
  let totalContratosNovos = 0;
  let totalMrrNovos = 0;
  let totalCustoOp = 0;
  let totalClientesAtivos = 0;
  let totalCustoServir = 0;
  let countCustoServir = 0;
  let totalMrrMedioCarteira = 0;
  let totalRoasCash = 0;
  let countRoasCash = 0;

  for (const r of resumos) {
    totalInvestimento += r.custo_aquisicao.investimento_midia.value;
    totalSalarioClosers += r.custo_aquisicao.salario_closers.value;
    totalSalarioSdr += r.custo_aquisicao.salario_sdrs.value;
    totalComissaoClosers += r.custo_aquisicao.comissao_closers.value;
    totalComissaoSdr += r.custo_aquisicao.comissao_sdrs.value;
    totalContratosNovos += (r.resultados as any).contratos_novos?.value ?? 0;
    totalMrrNovos += r.resultados.mrr_novos;
    totalCustoOp += r.custo_operacional.total_excluindo_ads.value;
    totalClientesAtivos += r.custo_operacional.clientes_ativos_fim_mes.value;
    totalMrrMedioCarteira += r.resultados.mrr_medio_carteira.value;
    if (r.custo_operacional.custo_servir_unitario != null) {
      totalCustoServir += r.custo_operacional.custo_servir_unitario;
      countCustoServir++;
    }
    if (r.resultados.roas_cash.value != null) {
      totalRoasCash += r.resultados.roas_cash.value;
      countRoasCash++;
    }
  }

  // Medias
  const mediaInvestimento = totalInvestimento / n;
  const mediaContratosNovos = totalContratosNovos / n;
  const mediaMrrNovos = totalMrrNovos / n;
  const mediaCustoOp = totalCustoOp / n;
  const mediaClientesAtivos = totalClientesAtivos / n;
  const mediaMrrMedioCarteira = totalMrrMedioCarteira / n;
  const mediaCustoServir = countCustoServir > 0 ? totalCustoServir / countCustoServir : 0;
  const mediaMrrMedioContrato = mediaContratosNovos > 0 ? mediaMrrNovos / mediaContratosNovos : 0;

  // Taxas de conversao (do agregado, nao media de taxas)
  // No-show real = no_shows / agendadas (fonte: lancamentos_diarios)
  const taxaNoShowPct = totalReunioesAgendadas > 0
    ? (totalNoShows / totalReunioesAgendadas) * 100
    : 0;
  // Conversao SDR = reunioes agendadas / leads totais do CRM
  const totalLeads = leadsRows.length; // cada row = 1 lead
  const taxaConversaoSdrPct = totalLeads > 0
    ? (totalReunioesAgendadas / totalLeads) * 100
    : 0;
  // Taxa de conversao closer: contratos_novos (resumo) / reunioes realizadas (lancamentos_diarios)
  // SEM cap de 100% — se > 100%, indica contratos registrados sem reuniao formal (reportar)
  const taxaConversaoCloserPct = totalReunioesRealizadas > 0
    ? (totalContratosNovos / totalReunioesRealizadas) * 100
    : 0;

  // CPL e CPRF
  const mediaLeads = totalLeads / n;
  const cpl = safe(mediaInvestimento, mediaLeads);
  const cprf = safe(mediaInvestimento, mediaReunioesFeitas);

  // CAC, margem, payback, LTV, ROAS
  const folhaTotal = (totalSalarioClosers + totalSalarioSdr) / n;
  const comissaoTotal = (totalComissaoClosers + totalComissaoSdr) / n;
  const cacTotal = mediaInvestimento + folhaTotal + comissaoTotal;
  const cacUnitario = mediaContratosNovos > 0 ? cacTotal / mediaContratosNovos : 0;
  // Margem = MRR medio do contrato - custo servir (mesma formula de simularCenario)
  const margemMensal = mediaMrrMedioContrato - mediaCustoServir;
  const paybackMeses = margemMensal > 0 ? cacUnitario / margemMensal : null;
  const ltvReal = margemMensal > 0 ? margemMensal * ltvMesesMedio : 0;
  const roasReal = cacUnitario > 0 ? ltvReal / cacUnitario : 0;
  const roasCash = countRoasCash > 0 ? totalRoasCash / countRoasCash : 0;
  const lucroMensal = mediaMrrMedioCarteira * mediaClientesAtivos - mediaCustoOp;

  return {
    periodo_referencia: {
      inicio: meses[0],
      fim: meses[meses.length - 1],
      meses,
    },
    funil: {
      investimento_midia: Math.round(mediaInvestimento * 100) / 100,
      cpl: Math.round(cpl * 100) / 100,
      leads: Math.round(mediaLeads * 100) / 100,
      reunioes_agendadas: Math.round(mediaReunioesAgendadas * 100) / 100,
      reunioes_feitas: Math.round(mediaReunioesFeitas * 100) / 100,
      cprf: Math.round(cprf * 100) / 100,
      taxa_no_show_pct: Math.round(taxaNoShowPct * 100) / 100,
      taxa_conversao_sdr_pct: Math.round(taxaConversaoSdrPct * 100) / 100,
      taxa_conversao_closer_pct: Math.round(taxaConversaoCloserPct * 100) / 100,
    },
    custo_aquisicao: {
      salario_closers: Math.round((totalSalarioClosers / n) * 100) / 100,
      salario_sdr: Math.round((totalSalarioSdr / n) * 100) / 100,
      comissao_closers: Math.round((totalComissaoClosers / n) * 100) / 100,
      comissao_sdr: Math.round((totalComissaoSdr / n) * 100) / 100,
    },
    saude_financeira: {
      contratos_novos: Math.round(mediaContratosNovos * 100) / 100,
      mrr_medio_contrato: Math.round(mediaMrrMedioContrato * 100) / 100,
      custo_operacional_total: Math.round(mediaCustoOp * 100) / 100,
      custo_servir_unitario: Math.round(mediaCustoServir * 100) / 100,
      clientes_ativos: Math.round(mediaClientesAtivos * 100) / 100,
    },
    derivados_atuais: {
      cac_unitario: Math.round(cacUnitario * 100) / 100,
      margem_mensal_cliente: Math.round(margemMensal * 100) / 100,
      payback_meses: paybackMeses != null ? Math.round(paybackMeses * 100) / 100 : null,
      ltv_real: Math.round(ltvReal * 100) / 100,
      roas_real: Math.round(roasReal * 100) / 100,
      roas_cash: Math.round(roasCash * 100) / 100,
      lucro_mensal_aproximado: Math.round(lucroMensal * 100) / 100,
    },
  };
}
