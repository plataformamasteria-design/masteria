/**
 * GET /api/meta/campanhas — Lista campanhas com métricas para o período.
 * Multi-tenant: busca token/account do companyId via session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE, extractActionsData, injectDerivedMetrics } from "@/lib/meta-ads";
import { getCachedMetaData, TTL_REALTIME, TTL_STRUCTURE } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";

interface AdInsightRow {
  campaign_id: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

type KPIMap = {
  spend: number; impressions: number; clicks: number; leads: number;
  reach: number; revenue: number; purchases: number; checkouts: number;
  inline_link_clicks: number; landing_page_views: number; total_actions: number;
};

const emptyKPI: KPIMap = { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0, revenue: 0, purchases: 0, checkouts: 0, inline_link_clicks: 0, landing_page_views: 0, total_actions: 0 };

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.accountId) {
      return NextResponse.json({ error: "Conta de anúncios não selecionada" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since") || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const until = searchParams.get("until") || new Date().toISOString().slice(0, 10);
    const accountParam = searchParams.get("account_id");
    const account = accountParam ? (accountParam.startsWith("act_") ? accountParam : `act_${accountParam}`) : auth.accountId;

    // 1. Estrutura de campanhas
    const campaignFields = "id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time";
    const structureRes = await getCachedMetaData<{ data: any[] }>(
      `campaigns-structure-${auth.companyId}`,
      { account, limit: "500" },
      TTL_STRUCTURE,
      async () => {
        const qs = new URLSearchParams({ access_token: auth.token, fields: campaignFields, limit: "500" });
        const r = await fetch(`${META_BASE}/${account}/campaigns?${qs.toString()}`);
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err?.error?.message || `Meta API ${r.status}`);
        }
        return r.json();
      },
    );

    // 2. Insights por período (nível campanha)
    const insightsParams = new URLSearchParams({
      access_token: auth.token,
      fields: "campaign_id,spend,impressions,clicks,reach,inline_link_clicks,actions,action_values",
      time_range: JSON.stringify({ since, until }),
      level: "campaign",
      limit: "500",
    });

    const insightsCacheKey = `camp-insights-${auth.companyId}-${since}-${until}`;
    const insightsRes = await getCachedMetaData<{ data: AdInsightRow[] }>(
      insightsCacheKey,
      { since, until },
      TTL_REALTIME,
      async () => {
        const r = await fetch(`${META_BASE}/${account}/insights?${insightsParams.toString()}`);
        if (!r.ok) return { data: [] };
        return r.json();
      },
    );

    // 3. Aggregation map
    const campMap = new Map<string, KPIMap>();

    for (const row of (insightsRes.data?.data || [])) {
      const sp = parseFloat(row.spend || "0");
      const im = parseInt(row.impressions || "0");
      const cl = parseInt(row.clicks || "0");
      const re = parseInt(row.reach || "0");
      const ilc = parseInt(row.inline_link_clicks || "0");
      const { ld, pur, rev, chk, lpv, total_actions } = extractActionsData(row.actions || [], row.action_values || []);
      const id = row.campaign_id;
      const cur = campMap.get(id) || { ...emptyKPI };
      campMap.set(id, {
        spend: cur.spend + sp, impressions: cur.impressions + im, clicks: cur.clicks + cl,
        leads: cur.leads + ld, reach: cur.reach + re, revenue: cur.revenue + rev,
        purchases: cur.purchases + pur, checkouts: cur.checkouts + chk,
        inline_link_clicks: cur.inline_link_clicks + ilc,
        landing_page_views: cur.landing_page_views + lpv,
        total_actions: cur.total_actions + total_actions,
      });
    }

    // 4. Pacing calculation
    const now = new Date();
    const nowBR = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const startOfDayBR = new Date(nowBR); startOfDayBR.setHours(0, 0, 0, 0);
    const elapsedPct = (nowBR.getTime() - startOfDayBR.getTime()) / 86400000;
    const todayStr = nowBR.toISOString().slice(0, 10);

    const todayInsightsParams = new URLSearchParams({
      access_token: auth.token,
      fields: "campaign_id,spend",
      time_range: JSON.stringify({ since: todayStr, until: todayStr }),
      level: "campaign",
      limit: "500",
    });
    const todayInsightsRes = await getCachedMetaData<{ data: { campaign_id: string; spend: string }[] }>(
      `camp-today-spend-${auth.companyId}-${todayStr}`,
      { since: todayStr, until: todayStr },
      TTL_REALTIME,
      async () => {
        const r = await fetch(`${META_BASE}/${account}/insights?${todayInsightsParams.toString()}`);
        if (!r.ok) return { data: [] };
        return r.json();
      },
    );
    const todaySpendMap = new Map<string, number>();
    for (const row of (todayInsightsRes.data?.data || [])) {
      todaySpendMap.set(row.campaign_id, parseFloat(row.spend || "0"));
    }

    // 5. Build response
    const campaigns = ((structureRes.data as any)?.data || []).map((c: any) => {
      const kpi = campMap.get(c.id) || emptyKPI;
      const cMetrics = injectDerivedMetrics(kpi);
      const dailyBudget = c.daily_budget ? parseInt(c.daily_budget) / 100 : null;
      const spendToday = todaySpendMap.get(c.id) || 0;
      const expToday = dailyBudget ? dailyBudget * elapsedPct : null;
      const paceStatus = dailyBudget && expToday !== null && expToday > 0
        ? spendToday > expToday * 1.2 ? "overpacing"
          : spendToday < expToday * 0.8 ? "underpacing"
          : "no_pace"
        : "unknown";

      return {
        id: c.id, name: c.name, status: c.status,
        effective_status: c.effective_status || c.status,
        objective: c.objective, buying_type: c.buying_type,
        daily_budget: dailyBudget,
        lifetime_budget: c.lifetime_budget ? parseInt(c.lifetime_budget) / 100 : null,
        budget_remaining: c.budget_remaining ? parseInt(c.budget_remaining) / 100 : null,
        start_time: c.start_time || null, stop_time: c.stop_time || null,
        created_time: c.created_time || null,
        pace_status: paceStatus, expected_spend_today: expToday, spend_today: spendToday,
        adsets: null,
        ...cMetrics,
      };
    });

    return NextResponse.json({ data: campaigns, since, until });
  } catch (e: any) {
    console.error("[api/meta/campanhas]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
