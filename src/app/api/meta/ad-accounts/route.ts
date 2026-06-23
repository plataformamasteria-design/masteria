/**
 * GET /api/meta/ad-accounts — Lista contas de anúncio da empresa.
 * Multi-tenant: busca token do companyId via session.
 */
import { NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";
import { db } from "@/lib/db";
import { marketingCredentials } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getMetaAuthForSession();

    // Buscar contas via /me/adaccounts
    const qs = new URLSearchParams({
      access_token: auth.token,
      fields: "name,account_id,account_status,currency,business_name,amount_spent",
      limit: "50",
    });

    const res = await fetch(`${META_BASE}/me/adaccounts?${qs.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Meta API ${res.status}`);
    }

    const data = await res.json();
    const accounts = (data.data || []).map((acc: any) => ({
      id: acc.id, // "act_123456"
      name: acc.name || `Conta ${acc.account_id}`,
      currency: acc.currency || "BRL",
      business_name: acc.business_name || null,
      amount_spent: acc.amount_spent ? parseInt(acc.amount_spent) / 100 : null,
      is_default: acc.id === auth.accountId,
    }));

    return NextResponse.json({ data: accounts, default_account: auth.accountId });
  } catch (e: any) {
    if (e.message && e.message.includes("Meta não conectado")) {
      return NextResponse.json({ error: e.message, data: [] }, { status: 400 });
    }
    console.error("[api/meta/ad-accounts]", e);
    return NextResponse.json({ error: e.message || String(e), data: [] }, { status: 500 });
  }
}

/**
 * POST /api/meta/ad-accounts — Salva a conta selecionada no banco.
 */
export async function POST(req: Request) {
  try {
    const auth = await getMetaAuthForSession();
    const { account_id } = await req.json();

    if (!account_id) {
      return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });
    }

    // Atualizar marketing_credentials com o ad_account_id selecionado
    const [cred] = await db.select().from(marketingCredentials)
      .where(and(
        eq(marketingCredentials.companyId, auth.companyId),
        eq(marketingCredentials.platform, "meta"),
        eq(marketingCredentials.status, "connected")
      ))
      .limit(1);

    if (!cred) {
      return NextResponse.json({ error: "Meta não conectado" }, { status: 400 });
    }

    // external-api: untyped — Meta OAuth credentials
    const credentials = cred.credentials as any;
    await db.update(marketingCredentials)
      .set({ credentials: { ...credentials, ad_account_id: account_id } })
      .where(eq(marketingCredentials.id, cred.id));

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[api/meta/ad-accounts POST]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
