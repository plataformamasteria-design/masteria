/**
 * GET /api/meta/campaign-tree — Carrega adsets + ads de uma campanha (lazy load).
 * Multi-tenant: busca token/account do companyId via session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE, extractActionsData, injectDerivedMetrics } from "@/lib/meta-ads";
import { getCachedMetaData, TTL_STRUCTURE, clearMetaCache } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";

type KPIMap = {
  spend: number; impressions: number; clicks: number; leads: number;
  reach: number; revenue: number; purchases: number; checkouts: number;
  inline_link_clicks: number; landing_page_views: number; total_actions: number;
};

const emptyKPI: KPIMap = { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0, revenue: 0, purchases: 0, checkouts: 0, inline_link_clicks: 0, landing_page_views: 0, total_actions: 0 };

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const { searchParams } = new URL(req.url);
    const campaign_id = searchParams.get("campaign_id");
    const since = searchParams.get("since") || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const until = searchParams.get("until") || new Date().toISOString().slice(0, 10);

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    const tFlag = searchParams.get("t");
    if (tFlag) clearMetaCache();

    // 1. Busca conjuntos com anúncios aninhados
    const fields = [
      "id,name,status,effective_status,daily_budget,lifetime_budget,budget_remaining",
      "optimization_goal,billing_event,bid_strategy,start_time,end_time,targeting",
      "promoted_object,destination_type",
      "ads{id,name,status,effective_status,creative{id,name,thumbnail_url,image_url,video_id,object_story_spec}}",
    ].join(",");

    const cacheKey = `campaign-tree-${auth.companyId}-${campaign_id}`;
    const result = await getCachedMetaData(
      cacheKey,
      { campaign_id },
      TTL_STRUCTURE,
      async () => {
        const qs = new URLSearchParams({ access_token: auth.token, fields, limit: "100" });
        const res = await fetch(`${META_BASE}/${campaign_id}/adsets?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Meta API ${res.status}`);
        return data;
      }
    );
    const adsets = (result.data as any)?.data || [];

    // 2. Busca insights nível ad para essa campanha
    const insightsParams = new URLSearchParams({
      access_token: auth.token,
      fields: "adset_id,ad_id,spend,impressions,clicks,reach,inline_link_clicks,actions,action_values",
      time_range: JSON.stringify({ since, until }),
      level: "ad",
      limit: "500",
    });

    const insightsRes = await fetch(`${META_BASE}/${campaign_id}/insights?${insightsParams.toString()}`);
    const insightsData = insightsRes.ok ? await insightsRes.json() : { data: [] };
    const insightsList = insightsData.data || [];

    // 3. Aggregation
    const adKPIs = new Map<string, KPIMap>();
    const adsetKPIs = new Map<string, KPIMap>();

    for (const row of insightsList) {
      const sp = parseFloat(row.spend || "0");
      const im = parseInt(row.impressions || "0");
      const cl = parseInt(row.clicks || "0");
      const re = parseInt(row.reach || "0");
      const ilc = parseInt(row.inline_link_clicks || "0");
      const { ld, pur, rev, chk, lpv, total_actions } = extractActionsData(row.actions || [], row.action_values || []);

      if (row.ad_id) {
        adKPIs.set(row.ad_id, {
          spend: sp, impressions: im, clicks: cl, leads: ld, reach: re, revenue: rev, purchases: pur, checkouts: chk,
          inline_link_clicks: ilc, landing_page_views: lpv, total_actions
        });
      }

      if (row.adset_id) {
        const cur = adsetKPIs.get(row.adset_id) || { ...emptyKPI };
        adsetKPIs.set(row.adset_id, {
          spend: cur.spend + sp, impressions: cur.impressions + im, clicks: cur.clicks + cl,
          leads: cur.leads + ld, reach: cur.reach + re, revenue: cur.revenue + rev,
          purchases: cur.purchases + pur, checkouts: cur.checkouts + chk,
          inline_link_clicks: cur.inline_link_clicks + ilc,
          landing_page_views: cur.landing_page_views + lpv,
          total_actions: cur.total_actions + total_actions
        });
      }
    }

    // 4. Mapear para estrutura normalizada
    const mappedAdsets = adsets.map((as: any) => ({
      id: as.id,
      name: as.name,
      status: as.status,
      effective_status: as.effective_status || as.status,
      daily_budget: as.daily_budget ? parseInt(as.daily_budget) / 100 : null,
      lifetime_budget: as.lifetime_budget ? parseInt(as.lifetime_budget) / 100 : null,
      budget_remaining: as.budget_remaining ? parseInt(as.budget_remaining) / 100 : null,
      optimization_goal: as.optimization_goal || null,
      destination_type: as.destination_type || null,
      promoted_object: as.promoted_object || null,
      bid_strategy: as.bid_strategy || null,
      targeting: as.targeting || null,
      start_time: as.start_time || null,
      end_time: as.end_time || null,
      ...injectDerivedMetrics(adsetKPIs.get(as.id) || emptyKPI),
      ads: {
        data: (as.ads?.data || []).map((ad: any) => ({
          id: ad.id,
          name: ad.name,
          status: ad.status,
          effective_status: ad.effective_status || ad.status,
          creative: {
            id: ad.creative?.id || null,
            name: ad.creative?.name || null,
            thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url || null,
            video_id: ad.creative?.video_id || null,
            object_story_spec: ad.creative?.object_story_spec || null,
          },
          ...injectDerivedMetrics(adKPIs.get(ad.id) || emptyKPI),
        })),
      },
    }));

    return NextResponse.json({ data: mappedAdsets });
  } catch (e: any) {
    console.error("[api/meta/campaign-tree]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
