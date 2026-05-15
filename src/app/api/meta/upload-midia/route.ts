/**
 * POST /api/meta/upload-midia — Upload de imagem para Meta Ads.
 * Multi-tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.accountId) return NextResponse.json({ error: "Conta não selecionada" }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file obrigatório" }, { status: 400 });

    const metaForm = new FormData();
    metaForm.append("access_token", auth.token);
    metaForm.append("filename", file.name);
    const bytes = await file.arrayBuffer();
    metaForm.append("bytes", new Blob([bytes]), file.name);

    const res = await fetch(`${META_BASE}/${auth.accountId}/adimages`, {
      method: "POST",
      body: metaForm,
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || `Meta API ${res.status}`);

    const images = data.images || {};
    const firstKey = Object.keys(images)[0];
    const img = firstKey ? images[firstKey] : null;

    return NextResponse.json({
      hash: img?.hash || "",
      url: img?.url || "",
      image: img,
    });
  } catch (e: any) {
    console.error("[api/meta/upload-midia]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
