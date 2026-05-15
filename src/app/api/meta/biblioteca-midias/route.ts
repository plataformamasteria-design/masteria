/**
 * POST /api/meta/upload-midia — Upload de imagem para a Media Library do Meta.
 * GET /api/meta/biblioteca-midias — Lista imagens da biblioteca.
 * Multi-tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.accountId) return NextResponse.json({ error: "Conta não selecionada", data: [] }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "24";

    const qs = new URLSearchParams({
      access_token: auth.token,
      fields: "hash,name,url,permalink_url,width,height",
      limit,
    });

    const res = await fetch(`${META_BASE}/${auth.accountId}/adimages?${qs.toString()}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || `Meta API ${res.status}`);

    const images = Object.values(data.data?.images || data.data || {}).map((img: any) => ({
      hash: img.hash,
      name: img.name || "",
      url: img.url || img.permalink_url || "",
      width: img.width,
      height: img.height,
    }));

    return NextResponse.json({ data: images });
  } catch (e: any) {
    console.error("[api/meta/biblioteca-midias]", e);
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
  }
}
