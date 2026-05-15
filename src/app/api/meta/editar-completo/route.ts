/**
 * POST /api/meta/editar-completo — Edita entity via Graph API (POST update).
 * Multi-tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";
import { clearMetaCache } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const { id, type, payload } = await req.json();

    if (!id || !type || !payload) {
      return NextResponse.json({ error: "id, type e payload obrigatórios" }, { status: 400 });
    }

    // Para ads com creative, precisamos criar o creative primeiro
    let finalPayload = { ...payload, access_token: auth.token };

    if (type === "ad" && payload.creative) {
      // Criar novo creative via Graph API
      const creativeRes = await fetch(`${META_BASE}/${auth.accountId}/adcreatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: auth.token,
          name: `Creative ${payload.name || id} - ${Date.now()}`,
          object_story_spec: payload.creative.object_story_spec,
        }),
      });
      const creativeData = await creativeRes.json();
      if (!creativeRes.ok) {
        throw new Error(creativeData.error?.message || "Erro ao criar creative");
      }
      finalPayload = {
        access_token: auth.token,
        name: payload.name,
        status: payload.status,
        creative: { creative_id: creativeData.id },
      };
    }

    const res = await fetch(`${META_BASE}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Meta API ${res.status}`);
    }

    clearMetaCache();
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error("[api/meta/editar-completo]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
