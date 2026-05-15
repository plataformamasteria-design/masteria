/**
 * POST /api/meta/duplicar — Duplica entity via deep_copy da Graph API.
 * Multi-tenant. Fallback: retorna erro claro se Meta recusar (subcode 1885194).
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";
import { clearMetaCache } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const { objeto_id, tipo, deep_copy } = await req.json();

    if (!objeto_id || !tipo) {
      return NextResponse.json({ error: "objeto_id e tipo obrigatórios" }, { status: 400 });
    }

    const res = await fetch(`${META_BASE}/${objeto_id}/copies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: auth.token,
        deep_copy: deep_copy !== false,
        status_option: "PAUSED",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Meta API ${res.status}`);
    }

    clearMetaCache();

    const newId = data.copied_campaign_id || data.copied_adset_id || data.copied_ad_id || data.id;
    return NextResponse.json({ success: true, new_id: newId });
  } catch (e: any) {
    console.error("[api/meta/duplicar]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
