/**
 * Meta Ads Adapter — MasterIA (multi-tenant).
 * Server-side only. Busca token e account_id do banco com base no companyId.
 *
 * API: Meta Marketing API
 * Base URL: https://graph.facebook.com/v21.0
 * Auth: Bearer token armazenado em marketing_credentials
 * Versão: v21.0
 * Campos críticos: access_token, ad_account_id
 * Erros conhecidos: 429 (rate limit), 190 (token expirado), 100 (permissions)
 */

import { db } from "@/lib/db";
import { marketingCredentials } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCompanyIdFromSession } from "@/app/actions";

export const META_BASE = "https://graph.facebook.com/v21.0";

export interface MetaAuth {
  token: string;
  accountId: string;  // "act_123456"
  companyId: string;
}

/**
 * Busca as credenciais Meta para a empresa da sessão atual.
 * Throws se não conectado ou token ausente.
 */
export async function getMetaAuthForSession(): Promise<MetaAuth> {
  const companyId = await getCompanyIdFromSession();
  if (!companyId) throw new Error("Sessão não identificada");

  const [cred] = await db.select().from(marketingCredentials)
    .where(and(
      eq(marketingCredentials.companyId, companyId),
      eq(marketingCredentials.platform, "meta"),
      eq(marketingCredentials.status, "connected")
    ))
    .limit(1);

  if (!cred?.credentials) {
    throw new Error("Meta não conectado. Vá em Integrações para conectar sua conta.");
  }

  // external-api: untyped — Meta OAuth credentials
  const credentials = cred.credentials as any;
  const token = credentials.access_token;
  const accountId = credentials.ad_account_id;

  if (!token) throw new Error("Token Meta ausente. Reconecte em Integrações.");

  return {
    token,
    accountId: accountId ? (accountId.startsWith("act_") ? accountId : `act_${accountId}`) : "",
    companyId,
  };
}

/**
 * Formata account_id garantindo prefixo "act_".
 */
export function formatAccountId(raw: string): string {
  if (!raw) return "";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

/**
 * Helper para extrair leads de actions da Meta API.
 */
export function extractActionsData(actions: any[], actionValues: any[]) {
  let ld = 0, pur = 0, rev = 0, chk = 0, lpv = 0, total_actions = 0;
  for (const a of (actions || [])) {
    total_actions += parseFloat(a.value || "0");
    if (a.action_type === "lead") ld += parseFloat(a.value || "0");
    if (a.action_type === "purchase") pur += parseFloat(a.value || "0");
    if (a.action_type === "initiate_checkout") chk += parseFloat(a.value || "0");
    if (a.action_type === "landing_page_view" || a.action_type === "offsite_conversion.custom.landing_page_view") {
      lpv += parseFloat(a.value || "0");
    }
  }
  for (const v of (actionValues || [])) {
    if (v.action_type === "purchase") rev += parseFloat(v.value || "0");
  }
  return { ld, pur, rev, chk, lpv, total_actions };
}

/**
 * Calcula métricas derivadas (CPL, CPM, CTR, ROAS, etc.) de KPIs brutos.
 */
export function injectDerivedMetrics(kpi: {
  spend: number; impressions: number; clicks: number; leads: number;
  reach: number; revenue: number; purchases: number; checkouts: number;
  inline_link_clicks: number; landing_page_views: number; total_actions: number;
}) {
  const { spend: sp, leads: ld, impressions: im, clicks: cl, reach: re,
    purchases: pur, revenue: rev, inline_link_clicks: ilc,
    landing_page_views: lpv, total_actions: acts } = kpi;

  return {
    ...kpi,
    actions: acts,
    cpl: ld > 0 ? sp / ld : null,
    cpm: im > 0 ? (sp / im) * 1000 : null,
    cpc: cl > 0 ? sp / cl : null,
    ctr: im > 0 ? (cl / im) * 100 : null,
    frequency: re > 0 ? im / re : null,
    cpp: pur > 0 ? sp / pur : null,
    roas: sp > 0 ? rev / sp : null,
    cpc_link: ilc > 0 ? sp / ilc : null,
    ctr_link: im > 0 && ilc > 0 ? (ilc / im) * 100 : null,
    cost_per_lpv: lpv > 0 ? sp / lpv : null,
  };
}
