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
  let ld = 0, pur = 0, rev = 0, chk = 0, lpv = 0, msg = 0, thruplay = 0, profile_visits = 0, link_clicks = 0, total_actions = 0;
  for (const a of (actions || [])) {
    const val = parseFloat(a.value || "0");
    total_actions += val;
    
    if (a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead") ld += val;
    else if (a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase") pur += val;
    else if (a.action_type === "initiate_checkout") chk += val;
    else if (a.action_type === "landing_page_view" || a.action_type === "offsite_conversion.custom.landing_page_view") lpv += val;
    else if (a.action_type === "onsite_conversion.messaging_conversation_started_7d" || a.action_type === "onsite_conversion.messaging_first_reply" || a.action_type === "messaging_conversation_started_7d" || a.action_type === "onsite_conversion.messaging_conversation_started_14d") msg += val;
    else if (a.action_type === "thruplay" || a.action_type === "video_view_thruplay") thruplay += val;
    else if (a.action_type === "onsite_conversion.ig_profile_visits" || a.action_type === "instagram_profile_visits" || a.action_type === "profile_visit") profile_visits += val;
    else if (a.action_type === "link_click") link_clicks += val;
  }
  for (const v of (actionValues || [])) {
    if (v.action_type === "purchase" || v.action_type === "offsite_conversion.fb_pixel_purchase") rev += parseFloat(v.value || "0");
  }
  return { ld, pur, rev, chk, lpv, msg, thruplay, profile_visits, link_clicks, total_actions };
}

/**
 * Calcula métricas derivadas (CPL, CPM, CTR, ROAS, etc.) de KPIs brutos.
 */
export function injectDerivedMetrics(kpi: {
  spend: number; impressions: number; clicks: number; leads: number;
  reach: number; revenue: number; purchases: number; checkouts: number;
  inline_link_clicks: number; landing_page_views: number; total_actions: number;
  messages?: number; thruplays?: number; profile_visits?: number; link_clicks?: number;
}) {
  const { spend: sp, leads: ld, impressions: im, clicks: cl, reach: re,
    purchases: pur, revenue: rev, inline_link_clicks: ilc,
    landing_page_views: lpv, total_actions: acts,
    messages: msg = 0, thruplays: thru = 0, profile_visits: pv = 0, link_clicks: lc = 0 } = kpi;

  const actual_link_clicks = ilc > 0 ? ilc : lc;

  return {
    ...kpi,
    actions: acts,
    messages: msg,
    thruplays: thru,
    profile_visits: pv,
    link_clicks: actual_link_clicks,
    cpl: ld > 0 ? sp / ld : null,
    cpm: im > 0 ? (sp / im) * 1000 : null,
    cpc: cl > 0 ? sp / cl : null,
    ctr: im > 0 ? (cl / im) * 100 : null,
    frequency: re > 0 ? im / re : null,
    cpp: pur > 0 ? sp / pur : null,
    roas: sp > 0 ? rev / sp : null,
    cpc_link: actual_link_clicks > 0 ? sp / actual_link_clicks : null,
    ctr_link: im > 0 && actual_link_clicks > 0 ? (actual_link_clicks / im) * 100 : null,
    cost_per_lpv: lpv > 0 ? sp / lpv : null,
    cost_per_message: msg > 0 ? sp / msg : null,
    cost_per_thruplay: thru > 0 ? sp / thru : null,
    cost_per_profile_visit: pv > 0 ? sp / pv : null,
  };
}
