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
    const account = accountParam ? (accountParam.startsWith("act_") ? accountParam : `act_${accountParam}`) : auth.accountId;

    const insightsParams = new URLSearchParams({
      access_token: auth.token,
      fields: "spend,impressions,clicks,reach,inline_link_clicks,actions,action_values",
      time_range: JSON.stringify({ since, until }),
      level: "account",
      limit: "1",
    });

    const cacheKey = `account-insights-${auth.companyId}-${since}-${until}`;
    const result = await getCachedMetaData<{ data: any[] }>(
      cacheKey,
      { since, until },
      TTL_REALTIME,
      async () => {
        const r = await fetch(`${META_BASE}/${account}/insights?${insightsParams.toString()}`);
        if (!r.ok) return { data: [] };
        return r.json();
      }
    );

    const row = result.data?.data?.[0];
    if (!row) {
      return NextResponse.json({ totals: { spend: 0, leads: 0, impressions: 0, clicks: 0, reach: 0, inline_link_clicks: 0 } });
    }

    const { ld } = extractActionsData(row.actions || [], row.action_values || []);

    return NextResponse.json({
      totals: {
        spend: parseFloat(row.spend || "0"),
        leads: ld,
        impressions: parseInt(row.impressions || "0"),
        clicks: parseInt(row.clicks || "0"),
        reach: parseInt(row.reach || "0"),
        inline_link_clicks: parseInt(row.inline_link_clicks || "0"),
      }
    });
  } catch (e: any) {
    console.error("[api/meta/insights]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
