/**
 * Helpers para o "ponto de corte" do cruzamento CRM × tráfego.
 *
 * Antes da data em que capturamos o primeiro lead com ad_id, a integração
 * Meta↔GHL não estava passando attribution. Cruzar esses leads antigos com
 * campanhas gera números irrealistas (4.5% de atribuição).
 *
 * Regra: para qualquer métrica que cruze `leads_crm` / `leads_ads_attribution`
 * com `ads_*`, aplicar `created_at >= attributionStartDate()` OU usar
 * `effectiveStart(dataInicio)` para respeitar também o filtro do usuário.
 */
import { supabase } from "@/lib/supabase";

// Fallback caso não exista nenhum lead com ad_id ainda. ISO string sem offset.
// Definido manualmente a partir da auditoria de 2026-04-08.
export const ATTRIBUTION_START_FALLBACK = "2026-04-03T23:21:18.000Z";

let _cached: { date: string; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000; // 5 min

/**
 * Retorna ISO string do primeiro lead com ad_id populado. Cacheia por 5min.
 * Se não houver nenhum lead com ad_id, retorna o fallback.
 */
export async function attributionStartDate(): Promise<string> {
  if (_cached && Date.now() - _cached.at < CACHE_MS) return _cached.date;
  // Usa ghl_created_at (data real no GHL), com fallback para created_at
  const { data } = await supabase
    .from("leads_crm")
    .select("ghl_created_at,created_at")
    .not("ad_id", "is", null)
    .order("ghl_created_at", { ascending: true, nullsFirst: false })
    .limit(1);
  const row = data?.[0];
  const date = row?.ghl_created_at || row?.created_at || ATTRIBUTION_START_FALLBACK;
  _cached = { date, at: Date.now() };
  return date;
}

/** Reseta o cache — útil após rodar sync/enrich */
export function resetAttributionCache() {
  _cached = null;
}

/**
 * Dado um `dataInicio` do filtro do usuário (formato YYYY-MM-DD), retorna a
 * data efetiva de início do cruzamento (o maior entre dataInicio e a attrStart).
 * Saída: ISO string adequada para comparar com `created_at`.
 */
export function effectiveStart(dataInicio: string, attrStart: string): string {
  const inicioIso = dataInicio.length === 10 ? `${dataInicio}T00:00:00.000Z` : dataInicio;
  return inicioIso > attrStart ? inicioIso : attrStart;
}

/**
 * Versão "YYYY-MM-DD" para filtros que comparam datas sem hora (data_ref, etc).
 */
export function effectiveStartDateOnly(dataInicio: string, attrStart: string): string {
  const eff = effectiveStart(dataInicio, attrStart);
  return eff.slice(0, 10);
}
