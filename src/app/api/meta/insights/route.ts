/**
 * GET /api/meta/insights — Métricas consolidadas para o período.
 * Usado pelo hook useAccountSpend como fonte única de investimento total.
 * Multi-tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE, extractActionsData } from "@/lib/meta-ads";
import { getCachedMetaData, TTL_REALTIME } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";

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
    const level = searchParams.get("level") || "account";
    const breakdown = searchParams.get("breakdown") || "none";
    const account = accountParam ? (accountParam.startsWith("act_") ? accountParam : `act_${accountParam}`) : auth.accountId;

    const fields = level === "account" 
      ? "spend,impressions,clicks,reach,inline_link_clicks,actions,action_values"
      : "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,actions,action_values";

    const insightsParamsObj: any = {
      access_token: auth.token,
      fields,
      time_range: JSON.stringify({ since, until }),
      level,
      limit: level === "account" && breakdown !== "daily" ? "1" : "500",
    };

    if (breakdown === "daily") {
      insightsParamsObj.time_increment = "1";
    }

    const insightsParams = new URLSearchParams(insightsParamsObj);

    const cacheKey = `account-insights-${auth.companyId}-${account}-${since}-${until}-${level}-${breakdown}`;
    const result = await getCachedMetaData<{ data: any[] }>(
      cacheKey,
      { since, until, level, breakdown },
      TTL_REALTIME,
      async () => {
        const r = await fetch(`${META_BASE}/${account}/insights?${insightsParams.toString()}`);
        if (!r.ok) {
          const errBody = await r.text();
          throw new Error(`Meta API Error: ${r.status} - ${errBody}`);
        }
        return r.json();
      }
    );

    if (level === "account") {
      const row = result.data?.data?.[0];
      if (!row) {
        return NextResponse.json({ totals: { spend: 0, leads: 0, impressions: 0, clicks: 0, reach: 0, inline_link_clicks: 0, messages: 0, purchases: 0, thruplays: 0, profile_visits: 0 } });
      }

      const { ld, msg, pur, thruplay, profile_visits, link_clicks } = extractActionsData(row.actions || [], row.action_values || []);

      return NextResponse.json({
        totals: {
          spend: parseFloat(row.spend || "0"),
          leads: ld + msg,
          impressions: parseInt(row.impressions || "0"),
          clicks: parseInt(row.clicks || "0"),
          reach: parseInt(row.reach || "0"),
          inline_link_clicks: link_clicks > 0 ? link_clicks : parseInt(row.inline_link_clicks || "0"),
          messages: msg,
          purchases: pur,
          thruplays: thruplay,
          profile_visits: profile_visits,
        }
      });
    }

    // Se for campaign, adset, ad
    const mappedData = (result.data?.data || []).map((row: any) => {
      const { ld, msg } = extractActionsData(row.actions || [], row.action_values || []);
      const totalLeads = ld + msg;
      const spend = parseFloat(row.spend || "0");
      const cpl = totalLeads > 0 ? spend / totalLeads : null;
      const impressions = parseInt(row.impressions || "0");
      const clicks = parseInt(row.clicks || "0");
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
      
      const reach = parseInt(row.reach || "0");
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
      const frequency = reach > 0 ? impressions / reach : null;
      
      let id = "";
      let name = "";
      let parent_id = undefined;

      if (level === "campaign") {
        id = row.campaign_id;
        name = row.campaign_name;
      } else if (level === "adset") {
        id = row.adset_id;
        name = row.adset_name;
        parent_id = row.campaign_id;
      } else if (level === "ad") {
        id = row.ad_id;
        name = row.ad_name;
        parent_id = row.adset_id;
      }

      // Simple score math: just baseline for UI consistency
      let score = 50;
      if (cpl && cpl < 15) score += 30;
      else if (cpl && cpl > 50) score -= 20;
      if (ctr && ctr > 1.5) score += 10;
      if (score > 100) score = 100;
      if (score < 0) score = 0;

      return {
        id,
        name,
        status: row.status || "ACTIVE", // API might not return status properly in insights without ad-level request, fallback to ACTIVE
        spend,
        impressions,
        clicks,
        leads: totalLeads,
        cpl,
        ctr,
        cpm,
        reach,
        frequency,
        score,
        parent_id,
        date: row.date_start || undefined
      };
    });

    const totals = mappedData.reduce((acc: any, row: any) => {
      acc.spend += row.spend || 0;
      acc.leads += row.leads || 0;
      acc.impressions += row.impressions || 0;
      acc.clicks += row.clicks || 0;
      acc.reach += row.reach || 0;
      return acc;
    }, { spend: 0, leads: 0, impressions: 0, clicks: 0, reach: 0 });

    return NextResponse.json({ data: mappedData, totals });

  } catch (e: any) {
    console.error("[api/meta/insights]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
