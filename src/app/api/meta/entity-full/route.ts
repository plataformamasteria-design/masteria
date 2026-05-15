/**
 * GET /api/meta/entity-full — Carrega dados completos de um entity (campaign, adset, ad).
 * Multi-tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

const FIELDS: Record<string, string> = {
  campaign: "id,name,status,objective,daily_budget,lifetime_budget,bid_strategy,spend_cap,stop_time",
  adset: "id,name,status,daily_budget,lifetime_budget,budget_remaining,start_time,end_time,optimization_goal,billing_event,bid_strategy,bid_amount,targeting,promoted_object,destination_type",
  ad: "id,name,status,creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec}",
};

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type") as keyof typeof FIELDS;

    if (!id || !type || !FIELDS[type]) {
      return NextResponse.json({ error: "id e type obrigatórios" }, { status: 400 });
    }

    const qs = new URLSearchParams({ access_token: auth.token, fields: FIELDS[type] });
    const res = await fetch(`${META_BASE}/${id}?${qs.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || `Meta API ${res.status}`);
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/meta/entity-full]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
