/**
 * POST /api/meta/pausar — Pausa anúncio/conjunto/campanha via Meta API.
 * Multi-tenant: busca token do companyId via session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const { tipo, objeto_id } = await req.json();

    if (!tipo || !objeto_id) {
      return NextResponse.json({ error: "tipo e objeto_id obrigatórios" }, { status: 400 });
    }
    if (!["ad", "adset", "campaign"].includes(tipo)) {
      return NextResponse.json({ error: "tipo deve ser ad, adset ou campaign" }, { status: 400 });
    }

    const res = await fetch(`${META_BASE}/${objeto_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED", access_token: auth.token }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || `Meta API ${res.status}`;
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const tipoLabel = tipo === "ad" ? "Anúncio" : tipo === "adset" ? "Conjunto" : "Campanha";
    return NextResponse.json({ success: true, message: `${tipoLabel} ${objeto_id} pausado com sucesso.` });
  } catch (e: any) {
    console.error("[api/meta/pausar]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
