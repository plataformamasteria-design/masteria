import { supabase } from "@/lib/supabase";

// ============================================================
// FONTE UNICA DE VERDADE: Meta Marketing API (spend real).
// Fallback: ads_performance.spend (pode estar incompleto).
// Nunca usar config_mensal.investimento para calculos.
// ============================================================

const META_TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const META_ACCOUNT = () => process.env.META_ADS_ACCOUNT_ID || "";
const META_BASE = "https://graph.facebook.com/v21.0";

interface InvestimentoResult {
  valor: number;
  fonte: "meta_api" | "ads_performance";
  detalhes: { campanhas_com_spend: number; ultima_atualizacao: Date };
}

// Cache in-memory com TTL de 5 min
const cache = new Map<string, { data: InvestimentoResult; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string): InvestimentoResult | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: InvestimentoResult) {
  cache.set(key, { data, ts: Date.now() });
}

/**
 * Busca spend real da Meta Marketing API para um periodo.
 * Retorna null se credenciais ausentes ou API falhar.
 */
async function fetchMetaSpend(since: string, until: string): Promise<number | null> {
  const token = META_TOKEN();
  const account = META_ACCOUNT();
  if (!token || !account) return null;

  try {
    const params = new URLSearchParams({
      access_token: token,
      fields: "spend",
      time_range: JSON.stringify({ since, until }),
      level: "account",
    });
    const res = await fetch(`${META_BASE}/${account}/insights?${params.toString()}`);
    if (!res.ok) return null;
    const body = await res.json();
    const rows = (body.data || []) as { spend?: string }[];
    if (rows.length === 0) return null;
    return rows.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);
  } catch {
    return null;
  }
}

/**
 * Busca spend de uma campanha especifica via Meta API.
 */
async function fetchMetaSpendCampaign(campaignId: string, since: string, until: string): Promise<number | null> {
  const token = META_TOKEN();
  if (!token) return null;

  try {
    const params = new URLSearchParams({
      access_token: token,
      fields: "spend",
      time_range: JSON.stringify({ since, until }),
      level: "campaign",
    });
    const res = await fetch(`${META_BASE}/${campaignId}/insights?${params.toString()}`);
    if (!res.ok) return null;
    const body = await res.json();
    const rows = (body.data || []) as { spend?: string }[];
    if (rows.length === 0) return null;
    return rows.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);
  } catch {
    return null;
  }
}

/**
 * Fallback: soma spend de ads_performance (pode estar incompleto se sync falhou).
 */
async function fetchDbSpend(startDate: string, endDate: string) {
  let allRows: { spend: number; ad_id: string; created_at: string }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("ads_performance")
      .select("spend, ad_id, created_at")
      .gte("data_ref", startDate)
      .lte("data_ref", endDate)
      .range(offset, offset + PAGE_SIZE - 1);
    const page = data || [];
    allRows = allRows.concat(page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  const valor = allRows.reduce((s, r) => s + Number(r.spend || 0), 0);
  const campanhasComSpend = new Set(allRows.filter(r => Number(r.spend) > 0).map(r => r.ad_id)).size;
  const ultimaAtualizacao = allRows.length > 0
    ? new Date(Math.max(...allRows.map(r => new Date(r.created_at).getTime())))
    : new Date();
  return { valor, campanhasComSpend, ultimaAtualizacao };
}

/**
 * Investimento total de um mes (YYYY-MM).
 * Fonte primaria: Meta API. Fallback: ads_performance.
 */
export async function getInvestimentoMensal(mesReferencia: string): Promise<InvestimentoResult> {
  const cacheKey = `mensal:${mesReferencia}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const startDate = `${mesReferencia}-01`;
  const [y, m] = mesReferencia.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${mesReferencia}-${String(lastDay).padStart(2, "0")}`;

  // Buscar Meta API e DB em paralelo
  const [metaSpend, dbData] = await Promise.all([
    fetchMetaSpend(startDate, endDate),
    fetchDbSpend(startDate, endDate),
  ]);

  const useMeta = metaSpend != null && metaSpend > 0;

  const result: InvestimentoResult = {
    valor: useMeta ? metaSpend : dbData.valor,
    fonte: useMeta ? "meta_api" : "ads_performance",
    detalhes: { campanhas_com_spend: dbData.campanhasComSpend, ultima_atualizacao: dbData.ultimaAtualizacao },
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Investimento de uma campanha especifica em um mes.
 * Per-campaign: usa Meta API com campaign_id, fallback ads_performance.
 */
export async function getInvestimentoPorCampanha(
  mesReferencia: string,
  campanhaId: string
): Promise<InvestimentoResult> {
  const cacheKey = `campanha:${mesReferencia}:${campanhaId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const startDate = `${mesReferencia}-01`;
  const [yC, mC] = mesReferencia.split("-").map(Number);
  const lastDayC = new Date(yC, mC, 0).getDate();
  const endDate = `${mesReferencia}-${String(lastDayC).padStart(2, "0")}`;

  // Tentar Meta API por campanha
  const metaSpend = await fetchMetaSpendCampaign(campanhaId, startDate, endDate);

  // DB fallback
  let allRows: { spend: number; ad_id: string; created_at: string }[] = [];
  const PAGE_SIZE_C = 1000;
  let offsetC = 0;
  while (true) {
    const { data } = await supabase
      .from("ads_performance")
      .select("spend, ad_id, created_at, ads_metadata!inner(campaign_id)")
      .gte("data_ref", startDate)
      .lte("data_ref", endDate)
      .eq("ads_metadata.campaign_id", campanhaId)
      .range(offsetC, offsetC + PAGE_SIZE_C - 1);
    const page = data || [];
    allRows = allRows.concat(page as any);
    if (page.length < PAGE_SIZE_C) break;
    offsetC += PAGE_SIZE_C;
  }

  const dbValor = allRows.reduce((s, r) => s + Number(r.spend || 0), 0);
  const campanhasComSpend = new Set(allRows.filter(r => Number(r.spend) > 0).map(r => r.ad_id)).size;
  const ultimaAtualizacao = allRows.length > 0
    ? new Date(Math.max(...allRows.map(r => new Date(r.created_at).getTime())))
    : new Date();

  const useMeta = metaSpend != null && metaSpend > 0;

  const result: InvestimentoResult = {
    valor: useMeta ? metaSpend : dbValor,
    fonte: useMeta ? "meta_api" : "ads_performance",
    detalhes: { campanhas_com_spend: campanhasComSpend, ultima_atualizacao: ultimaAtualizacao },
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Investimento total em um periodo arbitrario (YYYY-MM-DD a YYYY-MM-DD).
 * Fonte primaria: Meta API. Fallback: ads_performance.
 */
export async function getInvestimentoPorPeriodo(
  dataInicio: string,
  dataFim: string
): Promise<InvestimentoResult> {
  const cacheKey = `periodo:${dataInicio}:${dataFim}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const [metaSpend, dbData] = await Promise.all([
    fetchMetaSpend(dataInicio, dataFim),
    fetchDbSpend(dataInicio, dataFim),
  ]);

  const useMeta = metaSpend != null && metaSpend > 0;

  const result: InvestimentoResult = {
    valor: useMeta ? metaSpend : dbData.valor,
    fonte: useMeta ? "meta_api" : "ads_performance",
    detalhes: { campanhas_com_spend: dbData.campanhasComSpend, ultima_atualizacao: dbData.ultimaAtualizacao },
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Helper client-side: soma spend de um array de ads_performance rows.
 * Para uso em componentes que ja tem os dados carregados.
 */
export function somarSpendRows(rows: { spend: number }[]): number {
  return rows.reduce((s, r) => s + Number(r.spend || 0), 0);
}
