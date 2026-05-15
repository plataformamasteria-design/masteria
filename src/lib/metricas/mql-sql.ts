/**
 * Funções utilitárias para classificação MQL/SQL.
 *
 * Fonte única de leitura da config: getConfigMqlSql()
 * Tabela: config_funil_etapas (Supabase)
 * Cache em memória: 5 minutos
 */
import { supabase } from "@/lib/supabase";
import type { LeadCrm } from "@/types/database";

export interface ConfigMqlSql {
  mql: string[];
  sql: string[];
}

// Cache em memória (5 min)
let cachedConfig: ConfigMqlSql | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Lê config_funil_etapas WHERE ativo = true.
 * Retorna arrays de etapas por classificação.
 * Cache em memória por 5 minutos.
 */
export async function getConfigMqlSql(): Promise<ConfigMqlSql> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  const { data, error } = await supabase
    .from("config_funil_etapas")
    .select("etapa, classificacao")
    .eq("ativo", true);

  if (error || !data) {
    // Fallback seguro se a tabela ainda não existir ou der erro
    // MQL inclui qualificado + todas as SQL (todo SQL é MQL)
    return { mql: ["qualificado", "reuniao_agendada", "proposta_enviada", "assinatura_contrato"], sql: ["reuniao_agendada", "proposta_enviada", "assinatura_contrato"] };
  }

  const config: ConfigMqlSql = { mql: [], sql: [] };
  for (const row of data) {
    if (row.classificacao === "MQL") config.mql.push(row.etapa);
    else if (row.classificacao === "SQL") config.sql.push(row.etapa);
  }

  cachedConfig = config;
  cacheTimestamp = now;
  return config;
}

/** Invalida o cache (chamar após salvar config) */
export function invalidateConfigMqlSql(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Conta quantos leads estão em etapas MQL e SQL.
 */
export function countMqlSql(
  leads: Pick<LeadCrm, "etapa">[],
  config: ConfigMqlSql,
): { mql: number; sql: number } {
  let mql = 0;
  let sql = 0;
  for (const lead of leads) {
    if (config.mql.includes(lead.etapa)) mql++;
    if (config.sql.includes(lead.etapa)) sql++;
  }
  return { mql, sql };
}

/**
 * Custo por MQL: investimento / mql
 */
export function calcCustoMql(investimento: number, mql: number): number | null {
  return mql > 0 ? investimento / mql : null;
}

/**
 * Custo por SQL: investimento / sql
 */
export function calcCustoSql(investimento: number, sql: number): number | null {
  return sql > 0 ? investimento / sql : null;
}
