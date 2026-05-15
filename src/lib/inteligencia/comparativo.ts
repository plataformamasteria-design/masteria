/**
 * comparativo.ts — Lógica de comparação mês-a-mês para /inteligencia/comparativo.
 *
 * Fontes canônicas:
 *   - Investimento: getInvestimentoPorPeriodo (ads_performance / Meta API)
 *   - Leads: leads_crm WHERE ghl_created_at IN período
 *   - Reuniões: vw_reunioes_consolidada
 *   - Fechamentos/MRR: contratos WHERE status = 'ativo'
 *   - CTR: ads_performance (cliques/impressoes)
 */
import { createClient } from "@supabase/supabase-js";
import { getInvestimentoPorPeriodo } from "@/lib/metricas/investimento";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// ── Types ──

export type MetricDirection = "up_good" | "up_bad" | "neutral";
export type MetricFormat = "currency" | "number" | "percent" | "pp" | "multiplier";

export interface MetricaDef {
  id: string;
  label: string;
  direction: MetricDirection;
  format: MetricFormat;
  bloco: "midia" | "funil" | "receita";
}

export interface MetricaComparada {
  def: MetricaDef;
  atual: number;
  comparativo: number;
  variacao: number; // % or pp depending on format
  variacaoLabel: string;
  sinal: "positivo" | "negativo" | "neutro";
  intensidade: "forte" | "leve" | "neutro";
}

export interface ComparativoResult {
  periodoAtual: { inicio: string; fim: string };
  periodoComp: { inicio: string; fim: string };
  metricas: MetricaComparada[];
  veredito: {
    nivel: "melhor" | "equilibrado" | "pior";
    melhoraram: number;
    total: number;
    texto: string;
  };
  destaques: {
    maiorQueda: MetricaComparada | null;
    maiorSalto: MetricaComparada | null;
  };
}

// ── Metric Definitions ──

export const METRICAS: MetricaDef[] = [
  // Bloco Mídia
  { id: "investimento", label: "Investimento", direction: "neutral", format: "currency", bloco: "midia" },
  { id: "leads", label: "Leads (Meta)", direction: "up_good", format: "number", bloco: "midia" },
  { id: "cpl", label: "CPL", direction: "up_bad", format: "currency", bloco: "midia" },
  { id: "ctr", label: "CTR", direction: "up_good", format: "pp", bloco: "midia" },
  // Bloco Funil
  { id: "mql", label: "MQL", direction: "up_good", format: "number", bloco: "funil" },
  { id: "sql", label: "SQL", direction: "up_good", format: "number", bloco: "funil" },
  { id: "reunioes", label: "Reuniões realizadas", direction: "up_good", format: "number", bloco: "funil" },
  { id: "show_rate", label: "Show rate", direction: "up_good", format: "pp", bloco: "funil" },
  // Bloco Receita
  { id: "fechamentos", label: "Fechamentos", direction: "up_good", format: "number", bloco: "receita" },
  { id: "mrr", label: "MRR novo", direction: "up_good", format: "currency", bloco: "receita" },
  { id: "cac", label: "CAC", direction: "up_bad", format: "currency", bloco: "receita" },
  { id: "roas", label: "ROAS Cash", direction: "up_good", format: "multiplier", bloco: "receita" },
];

// Indicadores usados no veredito (exclui investimento que é neutro)
const VEREDITO_IDS = ["leads", "cpl", "fechamentos", "mrr", "roas"];

// ── Insights automáticos ──

const INSIGHTS_QUEDA: Record<string, string> = {
  reunioes: "investigar processo SDR e qualificação",
  show_rate: "revisar confirmação e lembrete de reuniões",
  cpl: "revisar criativos ou segmentação",
  cac: "verificar custo das campanhas e taxa de fechamento",
  fechamentos: "revisar processo do closer e qualidade dos leads",
  leads: "verificar campanhas ativas e budgets",
  mrr: "verificar ticket médio e mix de planos",
  roas: "investigar campanhas com pior eficiência",
  mql: "revisar critério de qualificação do SDR",
  sql: "revisar processo de qualificação avançada",
  ctr: "criativos podem estar saturados ou segmentação ampla demais",
};

const INSIGHTS_SALTO: Record<string, string> = {
  reunioes: "manter agenda e processo de agendamento",
  show_rate: "padrão de confirmação está funcionando",
  cpl: "criativos atuais estão eficientes",
  fechamentos: "processo do closer está convertendo bem",
  leads: "estratégia de captação está performando",
  mrr: "ticket médio ou volume estão crescendo",
  roas: "eficiência geral aumentou",
  mql: "qualificação do SDR está mais precisa",
  sql: "pipeline está amadurecendo mais leads",
  ctr: "criativos estão gerando mais engajamento",
  cac: "custo de aquisição caiu — boa eficiência",
};

// ── Core Logic ──

interface PeriodMetrics {
  investimento: number;
  leads: number;
  cpl: number;
  ctr: number;
  mql: number;
  sql: number;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  show_rate: number;
  fechamentos: number;
  mrr: number;
  cac: number;
  roas: number;
}

async function fetchPeriodMetrics(inicio: string, fim: string): Promise<PeriodMetrics> {
  const [investRes, leadsRes, qualRes, adsRes, reunioesRes, contratosRes] = await Promise.all([
    getInvestimentoPorPeriodo(inicio, fim),
    supabase
      .from("leads_crm")
      .select("id, etapa", { count: "exact" })
      .gte("ghl_created_at", `${inicio}T00:00:00`)
      .lte("ghl_created_at", `${fim}T23:59:59`),
    supabase
      .from("leads_crm")
      .select("id, etapa")
      .gte("ghl_created_at", `${inicio}T00:00:00`)
      .lte("ghl_created_at", `${fim}T23:59:59`)
      .in("etapa", ["qualificado", "reuniao_agendada", "reuniao_feita", "reuniao_realizada", "proposta_enviada", "comprou"]),
    supabase
      .from("ads_performance")
      .select("impressoes, cliques")
      .gte("data_ref", inicio)
      .lte("data_ref", fim),
    supabase
      .from("vw_reunioes_consolidada")
      .select("reunioes_realizadas, reunioes_agendadas")
      .eq("mes_referencia", inicio.slice(0, 7)),
    supabase
      .from("contratos")
      .select("id, valor_mensal")
      .eq("status", "ativo")
      .gte("data_fechamento", `${inicio}T00:00:00`)
      .lte("data_fechamento", `${fim}T23:59:59`),
  ]);

  const investimento = investRes.valor;
  const leads = leadsRes.count || 0;
  const cpl = leads > 0 ? investimento / leads : 0;

  const impressoes = (adsRes.data || []).reduce((s: number, r: any) => s + Number(r.impressoes || 0), 0);
  const cliques = (adsRes.data || []).reduce((s: number, r: any) => s + Number(r.cliques || 0), 0);
  const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;

  const qualData = qualRes.data || [];
  const mql = qualData.filter((l: any) => ["qualificado", "reuniao_agendada", "reuniao_feita", "reuniao_realizada", "proposta_enviada", "comprou"].includes(l.etapa)).length;
  const sql = qualData.filter((l: any) => ["reuniao_feita", "reuniao_realizada", "proposta_enviada", "comprou"].includes(l.etapa)).length;

  const reunioesData = reunioesRes.data || [];
  const reunioes_agendadas = reunioesData.reduce((s: number, r: any) => s + Number(r.reunioes_agendadas || 0), 0);
  const reunioes_realizadas = reunioesData.reduce((s: number, r: any) => s + Number(r.reunioes_realizadas || 0), 0);
  const show_rate = reunioes_agendadas > 0 ? (reunioes_realizadas / reunioes_agendadas) * 100 : 0;

  const fechamentos = (contratosRes.data || []).length;
  const mrr = (contratosRes.data || []).reduce((s: number, c: any) => s + Number(c.valor_mensal || 0), 0);
  const cac = fechamentos > 0 ? investimento / fechamentos : 0;
  const roas = investimento > 0 ? mrr / investimento : 0;

  return { investimento, leads, cpl, ctr, mql, sql, reunioes_agendadas, reunioes_realizadas, show_rate, fechamentos, mrr, cac, roas };
}

function calcVariacao(atual: number, comp: number, def: MetricaDef): MetricaComparada {
  const isPp = def.format === "pp";

  let variacao: number;
  let variacaoLabel: string;

  if (comp === 0 && atual > 0) {
    variacao = 100;
    variacaoLabel = "Novo";
  } else if (comp === 0 && atual === 0) {
    variacao = 0;
    variacaoLabel = "—";
  } else if (isPp) {
    variacao = atual - comp;
    const sign = variacao > 0 ? "+" : "";
    variacaoLabel = `${sign}${variacao.toFixed(1)}pp`;
  } else {
    variacao = ((atual - comp) / comp) * 100;
    const sign = variacao > 0 ? "+" : "";
    variacaoLabel = `${sign}${variacao.toFixed(1)}%`;
  }

  // Signal: did the metric "improve"?
  let melhorou: boolean;
  if (def.direction === "neutral") {
    melhorou = false; // neutral = never good or bad
  } else if (def.direction === "up_good") {
    melhorou = atual > comp;
  } else {
    // up_bad: improving = going down
    melhorou = atual < comp;
  }

  const absVar = Math.abs(isPp ? variacao : variacao);
  const thresholdForte = isPp ? 2 : 5;
  const thresholdLeve = isPp ? 0.5 : 1;

  let sinal: MetricaComparada["sinal"];
  if (def.direction === "neutral") sinal = "neutro";
  else if (comp === 0 && atual === 0) sinal = "neutro";
  else sinal = melhorou ? "positivo" : "negativo";

  let intensidade: MetricaComparada["intensidade"];
  if (absVar >= thresholdForte) intensidade = "forte";
  else if (absVar >= thresholdLeve) intensidade = "leve";
  else intensidade = "neutro";

  return { def, atual, comparativo: comp, variacao, variacaoLabel, sinal, intensidade };
}

// ── "Mesmos dias úteis" logic ──

export function calcMesmosDiasUteis(mesRef: string): { inicio: string; fim: string } {
  const [y, m] = mesRef.split("-").map(Number);
  const hoje = new Date();
  const diaAtual = hoje.getFullYear() === y && hoje.getMonth() + 1 === m
    ? hoje.getDate()
    : new Date(y, m, 0).getDate();

  // Count business days in current period (1 to diaAtual)
  let diasUteis = 0;
  for (let d = 1; d <= diaAtual; d++) {
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    if (dow !== 0 && dow !== 6) diasUteis++;
  }

  // Find the date in the previous month that has the same number of business days
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  let bizCount = 0;
  let lastDay = 1;
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

  for (let d = 1; d <= daysInPrevMonth; d++) {
    const dt = new Date(prevYear, prevMonth - 1, d);
    const dow = dt.getDay();
    if (dow !== 0 && dow !== 6) bizCount++;
    if (bizCount >= diasUteis) { lastDay = d; break; }
    lastDay = d;
  }

  const pm = String(prevMonth).padStart(2, "0");
  return {
    inicio: `${prevYear}-${pm}-01`,
    fim: `${prevYear}-${pm}-${String(lastDay).padStart(2, "0")}`,
  };
}

// ── Main export ──

export async function calcularComparativo(
  atualInicio: string,
  atualFim: string,
  compInicio: string,
  compFim: string,
): Promise<ComparativoResult> {
  const [metAtual, metComp] = await Promise.all([
    fetchPeriodMetrics(atualInicio, atualFim),
    fetchPeriodMetrics(compInicio, compFim),
  ]);

  const metricas: MetricaComparada[] = METRICAS.map((def) => {
    const atual = metAtual[def.id as keyof PeriodMetrics] ?? 0;
    const comp = metComp[def.id as keyof PeriodMetrics] ?? 0;
    return calcVariacao(atual, comp, def);
  });

  // Veredito
  const vereditoMetricas = metricas.filter((m) => VEREDITO_IDS.includes(m.def.id));
  const melhoraram = vereditoMetricas.filter((m) => m.sinal === "positivo").length;
  const total = vereditoMetricas.length;

  let nivel: ComparativoResult["veredito"]["nivel"];
  if (melhoraram >= 4) nivel = "melhor";
  else if (melhoraram >= 2) nivel = "equilibrado";
  else nivel = "pior";

  const textoVeredito = `${melhoraram} de ${total} indicadores principais melhoraram`;

  // Destaques
  const elegiveisDestaque = metricas.filter(
    (m) => m.def.direction !== "neutral" && m.comparativo > 0 && m.variacaoLabel !== "—"
  );

  // "Melhor variação" = highest positive score considering direction
  // "Pior variação" = worst negative score considering direction
  let maiorSalto: MetricaComparada | null = null;
  let maiorQueda: MetricaComparada | null = null;

  for (const m of elegiveisDestaque) {
    // Score: positive = good improvement, negative = bad deterioration
    const score = m.sinal === "positivo" ? Math.abs(m.variacao) : -Math.abs(m.variacao);

    if (m.sinal === "positivo" && (!maiorSalto || Math.abs(m.variacao) > Math.abs(maiorSalto.variacao))) {
      maiorSalto = m;
    }
    if (m.sinal === "negativo" && (!maiorQueda || Math.abs(m.variacao) > Math.abs(maiorQueda.variacao))) {
      maiorQueda = m;
    }
  }

  return {
    periodoAtual: { inicio: atualInicio, fim: atualFim },
    periodoComp: { inicio: compInicio, fim: compFim },
    metricas,
    veredito: { nivel, melhoraram, total, texto: textoVeredito },
    destaques: { maiorQueda, maiorSalto },
  };
}

export function getInsightTexto(metricaId: string, tipo: "queda" | "salto"): string {
  const map = tipo === "queda" ? INSIGHTS_QUEDA : INSIGHTS_SALTO;
  return map[metricaId] || (tipo === "queda" ? "investigar causa da deterioração" : "manter a estratégia atual");
}
