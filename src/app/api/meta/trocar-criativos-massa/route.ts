/**
 * POST /api/meta/trocar-criativos-massa — Bulk creative swap.
 * Multi-tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";
import { clearMetaCache } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const { ad_ids, creative } = await req.json();

    if (!ad_ids?.length || !creative?.page_id) {
      return NextResponse.json({ error: "ad_ids e creative.page_id obrigatórios" }, { status: 400 });
    }

    const results: { ad_id: string; success: boolean; error?: string }[] = [];

    for (const adId of ad_ids) {
      try {
        const baseSpec = { page_id: creative.page_id };
        const oss = creative.video_id
          ? { ...baseSpec, video_data: { video_id: creative.video_id, message: creative.copy || "", title: creative.headline || "" } }
          : { ...baseSpec, link_data: { link: creative.url || "#", message: creative.copy || "", name: creative.headline || "", image_hash: creative.image_hash } };

        const crRes = await fetch(`${META_BASE}/${auth.accountId}/adcreatives`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: auth.token, name: `Swap-${adId}`, object_story_spec: oss }),
        });
        const crData = await crRes.json();
        if (!crRes.ok) throw new Error(crData.error?.message || "Creative error");

        const adRes = await fetch(`${META_BASE}/${adId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: auth.token, creative: { creative_id: crData.id } }),
        });
        if (!adRes.ok) { const d = await adRes.json(); throw new Error(d.error?.message || "Ad update error"); }

        results.push({ ad_id: adId, success: true });
      } catch (e: any) {
        results.push({ ad_id: adId, success: false, error: e.message });
      }
    }

    clearMetaCache();
    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    console.error("[api/meta/trocar-criativos-massa]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
