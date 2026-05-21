import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.accountId) return NextResponse.json({ error: "No account" });

    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const account = auth.accountId;

    const insightsParams = new URLSearchParams({
      access_token: auth.token,
      fields: "campaign_id,campaign_name,objective,actions",
      time_range: JSON.stringify({ since, until }),
      level: "campaign",
      limit: "10",
    });

    const r = await fetch(`${META_BASE}/${account}/insights?${insightsParams.toString()}`);
    const data = await r.json();

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
