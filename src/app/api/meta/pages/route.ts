/**
 * GET /api/meta/pages — Lista páginas do Facebook da conta do usuário.
 * Multi-tenant.
 */
import { NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getMetaAuthForSession();

    const qs = new URLSearchParams({
      access_token: auth.token,
      fields: "id,name,access_token,picture{url}",
      limit: "50",
    });

    const res = await fetch(`${META_BASE}/me/accounts?${qs.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Meta API ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({
      data: (data.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        picture_url: p.picture?.data?.url || null,
      })),
    });
  } catch (e: any) {
    console.error("[api/meta/pages]", e);
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 });
  }
}
