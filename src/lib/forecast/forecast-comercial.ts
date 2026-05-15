/**
 * forecast-comercial.ts — Forecast comercial ponderado por probabilidade de etapa.
 *
 * Calcula quanto o pipeline aberto deve converter em contratos,
 * usando taxas historicas de conversao por etapa do funil.
 *
 * Probabilidades NAO sao hardcoded — sao calculadas do historico
 * (ultimos 6 meses de leads_crm).
 *
 * Reuso de funcoes canonicas:
 * - contratos (ja fechado no mes)
 * - metas_closers (meta do mes)
 * - leads_crm (pipeline aberto + historico de conversao)
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

// Ordem do funil (do mais inicial ao mais avancado)
const FUNNEL_ORDER = [
  "oportunidade",
  "ligacao",
  "qualificado",
  "reuniao_agendada",
  "no_show",
  "proposta_enviada",
  "follow_up",
  "negociacao",
  "assinatura_contrato",
] as const;

// Etapas terminais (nao entram no pipeline aberto)
const ETAPAS_TERMINAIS = ["desqualificado", "desistiu", "remarketing", "comprou"];

// Mapeamento de etapas para "profundidade" no funil.
// Leads em etapas mais avancadas contam como tendo passado pelas anteriores.
const ETAPA_DEPTH: Record<string, number> = {
  oportunidade: 0,
  ligacao: 1,
  qualificado: 2,
  reuniao_agendada: 3,
  no_show: 3, // mesmo nivel que reuniao (foi agendado mas nao compareceu)
  proposta_enviada: 4,
  follow_up: 5,
  negociacao: 6,
  assinatura_contrato: 7,
  comprou: 8,
};

// Profundidade maxima do funil (comprou)
const MAX_DEPTH = 8;

// Tempo medio estimado por profundidade de etapa (em dias)
// Baseado em dados historicos: media 33 dias total, distribuido por etapa
const DIAS_POR_DEPTH_STEP = 5; // ~5 dias por step de profundidade

// ─── Types ───────────────────────────────────────────────

export interface ForecastSemana {
  semana_inicio: string; // YYYY-MM-DD (segunda)
  semana_fim: string;
  pipeline_aberto: number;
  forecast_ponderado: number;
  fechamentos_estimados: number;
  confianca: "alta" | "media" | "baixa";
}

export interface ForecastSemanalResult {
  semanas: ForecastSemana[];
  total_4_semanas: number;
}

export interface ForecastCloserRanking {
  closer_id: string;
  nome: string;
  pipeline_aberto: number;
  forecast_ponderado: number;
  ja_fechado: number;
  meta_individual: number;
  gap: number;
  ranking: number;
  trend_4_semanas: "subindo" | "estavel" | "descendo";
}

export interface ProbabilidadeTrend {
  etapa: string;
  prob_4_semanas_atras: number;
  prob_atual: number;
  delta_pct: number;
  insight: string;
}

export interface ForecastEtapa {
  etapa: string;
  qtd_leads: number;
  valor_total_pipeline: number;
  probabilidade_pct: number;
  forecast_ponderado: number;
}

export interface ForecastCloser {
  closer_id: string;
  nome: string;
  pipeline_aberto: number;
  forecast_ponderado: number;
  ja_fechado: number;
  gap: number;
}

export interface ForecastResult {
  mes_referencia: string;
  pipeline_aberto: number;
  forecast_ponderado: number;
  forecast_otimista: number;
  forecast_pessimista: number;
  ja_fechado_no_mes: number;
  meta_mes: number;
  gap_meta: number;
  por_etapa: ForecastEtapa[];
  por_closer: ForecastCloser[];
  probabilidades_periodo: string;
  ticket_medio_usado: number;
}

// ─── Probabilidades historicas ───────────────────────────

async function calcularProbabilidades(): Promise<Record<string, number>> {
  // Calcula conversao historica: para cada etapa, que % dos leads
  // que atingiram essa profundidade no funil eventualmente converteram?
  //
  // Logica: um lead em "proposta_enviada" passou por oportunidade, qualificado,
  // reuniao. Entao conta no denominador de todas essas etapas anteriores.

  const { data: leads } = await supabase
    .from("leads_crm")
    .select("etapa")
    .gte("mes_referencia", getMesNMesesAtras(6));

  if (!leads || leads.length === 0) return getDefaultProbabilidades();

  // Contar quantos leads atingiram cada profundidade
  const reachedCount: Record<string, number> = {};
  let convertedCount = 0;

  for (const lead of leads) {
    const etapa = lead.etapa || "oportunidade";
    const depth = ETAPA_DEPTH[etapa] ?? 0;

    // Se comprou, conta como conversao
    if (etapa === "comprou") convertedCount++;

    // Conta como tendo atingido todas as etapas ate sua profundidade
    for (const [stage, stageDepth] of Object.entries(ETAPA_DEPTH)) {
      if (stage === "comprou") continue;
      if (stageDepth <= depth) {
        reachedCount[stage] = (reachedCount[stage] || 0) + 1;
      }
    }
  }

  const probs: Record<string, number> = {};
  for (const stage of FUNNEL_ORDER) {
    const reached = reachedCount[stage] || 0;
    probs[stage] = reached > 0 ? (convertedCount / reached) * 100 : 0;
  }

  return probs;
}

function getDefaultProbabilidades(): Record<string, number> {
  // Fallback conservador se nao houver dados historicos
  return {
    oportunidade: 5,
    ligacao: 8,
    qualificado: 25,
    reuniao_agendada: 30,
    no_show: 10,
    proposta_enviada: 35,
    follow_up: 60,
    negociacao: 75,
    assinatura_contrato: 90,
  };
}

function getMesNMesesAtras(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Main function ───────────────────────────────────────

export async function calcularForecast(input: {
  mes_referencia: string;
  closer_id?: string;
}): Promise<ForecastResult> {
  const { mes_referencia, closer_id } = input;

  // 1. Probabilidades historicas
  const probs = await calcularProbabilidades();

  // 2. Ticket medio (para leads sem valor)
  const { data: avgData } = await supabase
    .from("contratos")
    .select("mrr")
    .eq("status", "ativo")
    .gte("mes_referencia", getMesNMesesAtras(6));
  const avgMrr =
    avgData && avgData.length > 0
      ? avgData.reduce((s, c) => s + Number(c.mrr || 0), 0) / avgData.length
      : 1500;

  // 3. Pipeline aberto (leads em etapas ativas)
  let pipelineQuery = supabase
    .from("leads_crm")
    .select("id, etapa, mensalidade, closer_id")
    .not("etapa", "in", `(${ETAPAS_TERMINAIS.join(",")})`)
    .not("etapa", "is", null);

  if (closer_id) {
    pipelineQuery = pipelineQuery.eq("closer_id", closer_id);
  }

  const { data: pipeline } = await pipelineQuery;
  const pipelineLeads = pipeline || [];

  // 4. Agregar por etapa
  const etapaMap = new Map<string, { qtd: number; valor: number }>();
  for (const lead of pipelineLeads) {
    const etapa = lead.etapa || "oportunidade";
    const valor = Number(lead.mensalidade) || avgMrr;
    const ex = etapaMap.get(etapa) || { qtd: 0, valor: 0 };
    ex.qtd++;
    ex.valor += valor;
    etapaMap.set(etapa, ex);
  }

  const porEtapa: ForecastEtapa[] = FUNNEL_ORDER.filter((e) =>
    etapaMap.has(e)
  ).map((etapa) => {
    const { qtd, valor } = etapaMap.get(etapa)!;
    const prob = probs[etapa] || 0;
    return {
      etapa,
      qtd_leads: qtd,
      valor_total_pipeline: valor,
      probabilidade_pct: Math.round(prob * 10) / 10,
      forecast_ponderado: Math.round((valor * prob) / 100),
    };
  });

  // Include stages that have leads but aren't in FUNNEL_ORDER
  for (const [etapa, { qtd, valor }] of Array.from(etapaMap.entries())) {
    if (!FUNNEL_ORDER.includes(etapa as (typeof FUNNEL_ORDER)[number])) {
      const prob = probs[etapa] || 5; // fallback
      porEtapa.push({
        etapa,
        qtd_leads: qtd,
        valor_total_pipeline: valor,
        probabilidade_pct: Math.round(prob * 10) / 10,
        forecast_ponderado: Math.round((valor * prob) / 100),
      });
    }
  }

  const pipelineAberto = porEtapa.reduce(
    (s, e) => s + e.valor_total_pipeline,
    0
  );
  const forecastPonderado = porEtapa.reduce(
    (s, e) => s + e.forecast_ponderado,
    0
  );

  // 5. Ja fechado no mes (contratos ativos)
  let ctQuery = supabase
    .from("contratos")
    .select("id, mrr, valor_entrada, closer_id")
    .eq("mes_referencia", mes_referencia)
    .eq("status", "ativo");

  if (closer_id) {
    ctQuery = ctQuery.eq("closer_id", closer_id);
  }

  const { data: contratos } = await ctQuery;
  const jaFechado = (contratos || []).reduce(
    (s, c) => s + Number(c.valor_entrada || 0),
    0
  );

  // 6. Meta do mes
  let metaTotal = 0;
  if (!closer_id) {
    const { data: metas } = await supabase
      .from("metas_closers")
      .select("meta_mrr")
      .eq("mes_referencia", mes_referencia);
    metaTotal = (metas || []).reduce(
      (s, m) => s + Number(m.meta_mrr || 0),
      0
    );
  } else {
    const { data: meta } = await supabase
      .from("metas_closers")
      .select("meta_mrr")
      .eq("mes_referencia", mes_referencia)
      .eq("closer_id", closer_id)
      .maybeSingle();
    metaTotal = Number(meta?.meta_mrr || 0);
  }

  // 7. Por closer
  const closerMap = new Map<
    string,
    { pipeline: number; forecast: number; fechado: number }
  >();

  for (const lead of pipelineLeads) {
    const cid = lead.closer_id || "sem_closer";
    const etapa = lead.etapa || "oportunidade";
    const valor = Number(lead.mensalidade) || avgMrr;
    const prob = probs[etapa] || 0;
    const ex = closerMap.get(cid) || { pipeline: 0, forecast: 0, fechado: 0 };
    ex.pipeline += valor;
    ex.forecast += (valor * prob) / 100;
    closerMap.set(cid, ex);
  }

  for (const ct of contratos || []) {
    const cid = ct.closer_id || "sem_closer";
    const ex = closerMap.get(cid) || { pipeline: 0, forecast: 0, fechado: 0 };
    ex.fechado += Number(ct.valor_entrada || 0);
    closerMap.set(cid, ex);
  }

  // Fetch closer names
  const closerIds = Array.from(closerMap.keys()).filter(
    (id) => id !== "sem_closer"
  );
  const { data: empData } = closerIds.length > 0
    ? await supabase
        .from("employees")
        .select("entity_id, nome")
        .in("entity_id", closerIds)
        .eq("ativo", true)
    : { data: [] };
  const nameMap = new Map(
    (empData || []).map((e) => [e.entity_id, e.nome])
  );

  const porCloser: ForecastCloser[] = Array.from(closerMap.entries())
    .map(([cid, data]) => ({
      closer_id: cid,
      nome: cid === "sem_closer" ? "Sem closer" : nameMap.get(cid) || cid,
      pipeline_aberto: Math.round(data.pipeline),
      forecast_ponderado: Math.round(data.forecast),
      ja_fechado: Math.round(data.fechado),
      gap: 0, // calculated per-closer meta would require more queries
    }))
    .sort((a, b) => b.forecast_ponderado - a.forecast_ponderado);

  const gapMeta = metaTotal - (jaFechado + forecastPonderado);

  return {
    mes_referencia,
    pipeline_aberto: Math.round(pipelineAberto),
    forecast_ponderado: Math.round(forecastPonderado),
    forecast_otimista: Math.round(forecastPonderado * 1.2),
    forecast_pessimista: Math.round(forecastPonderado * 0.8),
    ja_fechado_no_mes: Math.round(jaFechado),
    meta_mes: Math.round(metaTotal),
    gap_meta: Math.round(gapMeta),
    por_etapa: porEtapa,
    por_closer: porCloser,
    probabilidades_periodo: `${getMesNMesesAtras(6)} a ${mes_referencia}`,
    ticket_medio_usado: Math.round(avgMrr),
  };
}

// ─── Helpers de data semanal ────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─── Forecast Semanal ───────────────────────────────────

export async function calcularForecastSemanal(input: {
  semanas_a_frente?: number;
  closer_id?: string;
}): Promise<ForecastSemanalResult> {
  const numSemanas = input.semanas_a_frente || 4;
  const probs = await calcularProbabilidades();

  // Ticket medio
  const { data: avgData } = await supabase
    .from("contratos")
    .select("mrr")
    .eq("status", "ativo")
    .gte("mes_referencia", getMesNMesesAtras(6));
  const avgMrr =
    avgData && avgData.length > 0
      ? avgData.reduce((s, c) => s + Number(c.mrr || 0), 0) / avgData.length
      : 1500;

  // Pipeline aberto
  let query = supabase
    .from("leads_crm")
    .select("id, etapa, mensalidade, ghl_created_at")
    .not("etapa", "in", `(${ETAPAS_TERMINAIS.join(",")})`)
    .not("etapa", "is", null);

  if (input.closer_id) {
    query = query.eq("closer_id", input.closer_id);
  }

  const { data: pipeline } = await query;
  const leads = pipeline || [];

  // Para cada lead, estimar em qual semana futura ele deve converter
  // baseado na profundidade restante no funil
  const hoje = new Date();
  const segundaAtual = getMonday(hoje);

  // Inicializar semanas
  const semanas: ForecastSemana[] = [];
  for (let i = 0; i < numSemanas; i++) {
    const inicio = addDays(segundaAtual, i * 7);
    const fim = addDays(inicio, 6);
    semanas.push({
      semana_inicio: formatDate(inicio),
      semana_fim: formatDate(fim),
      pipeline_aberto: 0,
      forecast_ponderado: 0,
      fechamentos_estimados: 0,
      confianca: "media",
    });
  }

  for (const lead of leads) {
    const etapa = lead.etapa || "oportunidade";
    const depth = ETAPA_DEPTH[etapa] ?? 0;
    const stepsRestantes = MAX_DEPTH - depth;
    const diasEstimados = stepsRestantes * DIAS_POR_DEPTH_STEP;
    const valor = Number(lead.mensalidade) || avgMrr;
    const prob = (probs[etapa] || 0) / 100;

    // Em qual semana cai esse lead?
    const semanaIdx = Math.min(
      Math.floor(diasEstimados / 7),
      numSemanas - 1
    );

    semanas[semanaIdx].pipeline_aberto += valor;
    semanas[semanaIdx].forecast_ponderado += valor * prob;
    if (prob > 0.3) {
      semanas[semanaIdx].fechamentos_estimados++;
    }
  }

  // Arredondar e definir confianca
  for (const s of semanas) {
    s.pipeline_aberto = Math.round(s.pipeline_aberto);
    s.forecast_ponderado = Math.round(s.forecast_ponderado);
    // Confianca: alta se muitos leads proximos de converter
    if (s.fechamentos_estimados >= 3 && s.forecast_ponderado > 0) {
      s.confianca = "alta";
    } else if (s.fechamentos_estimados >= 1) {
      s.confianca = "media";
    } else {
      s.confianca = "baixa";
    }
  }

  const total = semanas.reduce((s, w) => s + w.forecast_ponderado, 0);

  return { semanas, total_4_semanas: total };
}

// ─── Forecast por Closer (ranking + trend) ──────────────

export async function calcularForecastPorCloser(input: {
  mes_referencia: string;
}): Promise<ForecastCloserRanking[]> {
  const { mes_referencia } = input;

  // Forecast completo (reutiliza calcularForecast)
  const forecast = await calcularForecast({ mes_referencia });

  // Metas individuais
  const { data: metas } = await supabase
    .from("metas_closers")
    .select("closer_id, meta_mrr")
    .eq("mes_referencia", mes_referencia);
  const metaMap = new Map(
    (metas || []).map((m) => [m.closer_id, Number(m.meta_mrr || 0)])
  );

  // Calcular forecast do mes anterior para trend
  const mesAnterior = getMesNMesesAtras(1);
  const forecastAnterior = await calcularForecast({ mes_referencia: mesAnterior });
  const anteriorMap = new Map(
    forecastAnterior.por_closer.map((c) => [c.closer_id, c.forecast_ponderado])
  );

  // Montar ranking
  const closers: ForecastCloserRanking[] = forecast.por_closer
    .filter((c) => c.closer_id !== "sem_closer")
    .map((c) => {
      const meta = metaMap.get(c.closer_id) || 0;
      const totalProjetado = c.ja_fechado + c.forecast_ponderado;
      const gap = meta > 0 ? meta - totalProjetado : 0;
      const forecastAnt = anteriorMap.get(c.closer_id) || 0;

      let trend: "subindo" | "estavel" | "descendo" = "estavel";
      if (forecastAnt > 0) {
        const delta = ((c.forecast_ponderado - forecastAnt) / forecastAnt) * 100;
        if (delta > 10) trend = "subindo";
        else if (delta < -10) trend = "descendo";
      } else if (c.forecast_ponderado > 0) {
        trend = "subindo";
      }

      return {
        closer_id: c.closer_id,
        nome: c.nome,
        pipeline_aberto: c.pipeline_aberto,
        forecast_ponderado: c.forecast_ponderado,
        ja_fechado: c.ja_fechado,
        meta_individual: Math.round(meta),
        gap: Math.round(gap),
        ranking: 0,
        trend_4_semanas: trend,
      };
    })
    .sort((a, b) => {
      // Ranking: quem tem mais forecast + ja_fechado
      const totalA = a.ja_fechado + a.forecast_ponderado;
      const totalB = b.ja_fechado + b.forecast_ponderado;
      return totalB - totalA;
    });

  // Atribuir ranking
  closers.forEach((c, i) => {
    c.ranking = i + 1;
  });

  return closers;
}

// ─── Probabilidades Trend (rolling 4 semanas) ───────────

async function calcularProbabilidadesWindow(
  dataInicio: string,
  dataFim: string
): Promise<Record<string, number>> {
  const { data: leads } = await supabase
    .from("leads_crm")
    .select("etapa, ghl_created_at")
    .gte("ghl_created_at", dataInicio)
    .lte("ghl_created_at", dataFim);

  if (!leads || leads.length === 0) return {};

  const reachedCount: Record<string, number> = {};
  let convertedCount = 0;

  for (const lead of leads) {
    const etapa = lead.etapa || "oportunidade";
    const depth = ETAPA_DEPTH[etapa] ?? 0;

    if (etapa === "comprou") convertedCount++;

    for (const [stage, stageDepth] of Object.entries(ETAPA_DEPTH)) {
      if (stage === "comprou") continue;
      if (stageDepth <= depth) {
        reachedCount[stage] = (reachedCount[stage] || 0) + 1;
      }
    }
  }

  const probs: Record<string, number> = {};
  for (const stage of FUNNEL_ORDER) {
    const reached = reachedCount[stage] || 0;
    probs[stage] = reached > 0 ? (convertedCount / reached) * 100 : 0;
  }

  return probs;
}

export async function probabilidadesPorEtapaTrend(): Promise<ProbabilidadeTrend[]> {
  const hoje = new Date();

  // Window atual: últimas 4 semanas
  const fimAtual = hoje.toISOString();
  const inicioAtual = addDays(hoje, -28).toISOString();

  // Window anterior: 8 a 4 semanas atrás
  const fimAnterior = addDays(hoje, -28).toISOString();
  const inicioAnterior = addDays(hoje, -56).toISOString();

  const [probsAtual, probsAnterior] = await Promise.all([
    calcularProbabilidadesWindow(inicioAtual, fimAtual),
    calcularProbabilidadesWindow(inicioAnterior, fimAnterior),
  ]);

  const trends: ProbabilidadeTrend[] = [];

  for (const etapa of FUNNEL_ORDER) {
    const atual = Math.round((probsAtual[etapa] || 0) * 10) / 10;
    const anterior = Math.round((probsAnterior[etapa] || 0) * 10) / 10;
    const delta = atual - anterior;
    const deltaPct = Math.round(delta * 10) / 10;

    let insight: string;
    if (anterior === 0 && atual === 0) {
      insight = "Sem dados suficientes neste periodo";
    } else if (anterior === 0) {
      insight = `Sem dados no periodo anterior, atual ${atual.toFixed(1)}%`;
    } else if (Math.abs(deltaPct) < 2) {
      insight = "Estavel — sem mudanca significativa";
    } else if (deltaPct > 0) {
      insight = `Convertendo +${deltaPct.toFixed(1)}pp — etapa ficou mais facil`;
    } else {
      insight = `Caiu ${deltaPct.toFixed(1)}pp — etapa ficou mais dificil`;
    }

    trends.push({
      etapa,
      prob_4_semanas_atras: anterior,
      prob_atual: atual,
      delta_pct: deltaPct,
      insight,
    });
  }

  return trends;
}
