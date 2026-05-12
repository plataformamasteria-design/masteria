import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getMPAccessToken(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("mercadopago_config")
    .select("access_token_encrypted")
    .eq("active", true)
    .limit(1)
    .single();
  return data?.access_token_encrypted || null;
}

async function getOrgEmail(supabase: any, orgId: string): Promise<string> {
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single();
  return data?.settings?.email || "cliente@vitta.com";
}

async function calculateOrgTotal(supabase: any, orgId: string, referenceMonth: string): Promise<number> {
  const [year, month] = referenceMonth.split("-").map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  const totalDaysInMonth = endOfMonth.getDate();

  // Get org modules with prices
  const { data: modules } = await supabase
    .from("organization_modules")
    .select("module_key, price, active, updated_at")
    .eq("organization_id", orgId);

  // Get org connections with prices
  const { data: connections } = await supabase
    .from("organization_connections")
    .select("connection_key, price, active, updated_at")
    .eq("organization_id", orgId);

  // Get global prices for fallback
  const { data: globalModules } = await supabase.from("global_module_prices").select("module_key, base_price");
  const { data: globalConnections } = await supabase.from("global_connection_prices").select("connection_key, base_price");

  const globalModuleMap: Record<string, number> = {};
  for (const gm of globalModules || []) {
    globalModuleMap[gm.module_key] = Number(gm.base_price || 0);
  }
  const globalConnMap: Record<string, number> = {};
  for (const gc of globalConnections || []) {
    globalConnMap[gc.connection_key] = Number(gc.base_price || 0);
  }

  const FREE_CONNECTIONS = ["whatsapp_nativo", "whatsapp"];
  let total = 0;

  // Pro-rata logic helper
  const getProRataFactor = (updatedAt: string, isActive: boolean) => {
    const updateDate = new Date(updatedAt);

    // If deactivated before this month, cost is 0
    if (!isActive && updateDate < startOfMonth) return 0;

    // If activated before this month and still active, cost is 100%
    if (isActive && updateDate < startOfMonth) return 1;

    // If change happened within this month
    if (updateDate >= startOfMonth && updateDate <= endOfMonth) {
      const dayOfChange = updateDate.getDate();
      if (isActive) {
        // Activated during month: charge from activation to end
        return (totalDaysInMonth - dayOfChange + 1) / totalDaysInMonth;
      } else {
        // Deactivated during month: charge from start to deactivation
        return dayOfChange / totalDaysInMonth;
      }
    }

    // If activated after this month (future billing), cost is 0
    if (isActive && updateDate > endOfMonth) return 0;

    return isActive ? 1 : 0;
  };

  for (const m of modules || []) {
    if (!m.active && new Date(m.updated_at) < startOfMonth) continue;

    const basePrice = Number(m.price === -1 ? (globalModuleMap[m.module_key] || 0) : m.price);
    const factor = getProRataFactor(m.updated_at, m.active);
    total += basePrice * factor;
  }

  for (const c of connections || []) {
    if (FREE_CONNECTIONS.includes(c.connection_key)) continue;
    if (!c.active && new Date(c.updated_at) < startOfMonth) continue;

    const basePrice = Number(c.price === -1 ? (globalConnMap[c.connection_key] || 0) : c.price);
    const factor = getProRataFactor(c.updated_at, c.active);
    total += basePrice * factor;
  }

  // Add extra user costs
  const { data: org } = await supabase
    .from("organizations")
    .select("max_users, price_per_extra_user")
    .eq("id", orgId)
    .single();

  if (org) {
    const maxUsers = org.max_users || 3;
    const pricePerExtra = Number(org.price_per_extra_user || 0);
    if (pricePerExtra > 0) {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("approved", true);
      const extraUsers = Math.max(0, (count || 0) - maxUsers);
      total += extraUsers * pricePerExtra;
    }
  }

  return total;
}

async function createPixPayment(token: string, amount: number, orgId: string, refMonth: string, webhookUrl: string, payerEmail: string) {
  try {
    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Assinatura Vitta - ${refMonth}`,
        payment_method_id: "pix",
        external_reference: `org_${orgId}_${refMonth}`,
        notification_url: webhookUrl,
        payer: { email: payerEmail },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[auto-billing] PIX creation failed for ${orgId}:`, err);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[auto-billing] PIX error for ${orgId}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const now = new Date();
    const referenceMonth = now.toISOString().slice(0, 7); // YYYY-MM

    console.log(`[auto-billing] Generating invoices for ${referenceMonth}`);

    // Get all active organizations with billing_day
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name, billing_day, settings, lifetime")
      .eq("active", true)
      .eq("lifetime", false);

    if (orgsError) throw orgsError;

    const mpToken = await getMPAccessToken(supabase);
    const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

    let created = 0;
    let skipped = 0;

    for (const org of orgs || []) {
      // Check if invoice already exists for this month
      const { data: existing } = await supabase
        .from("payment_history")
        .select("id")
        .eq("organization_id", org.id)
        .eq("reference_month", referenceMonth)
        .limit(1)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Calculate total with global fallback (using pro-rata)
      const total = await calculateOrgTotal(supabase, org.id, referenceMonth);

      if (total <= 0) {
        skipped++;
        continue;
      }

      // Calculate due date based on org's billing_day
      const billingDay = org.billing_day || 10;
      const [year, month] = referenceMonth.split("-").map(Number);
      const maxDay = new Date(year, month, 0).getDate();
      const effectiveDay = Math.min(billingDay, maxDay);
      const dueDate = new Date(year, month - 1, effectiveDay);
      if (dueDate < now) {
        const nextMonth = new Date(year, month, Math.min(billingDay, new Date(year, month + 1, 0).getDate()));
        dueDate.setTime(nextMonth.getTime());
      }

      // Get org email for payer
      const payerEmail = org.settings?.email || "cliente@vitta.com";

      // Try to create PIX payment automatically
      let pixData: any = {};
      let mpPaymentId: string | null = null;
      if (mpToken) {
        const pixResult = await createPixPayment(mpToken, total, org.id, referenceMonth, webhookUrl, payerEmail);
        if (pixResult) {
          mpPaymentId = String(pixResult.id);
          pixData = {
            pix_qr_code: pixResult.point_of_interaction?.transaction_data?.qr_code_base64 || null,
            pix_copy_paste: pixResult.point_of_interaction?.transaction_data?.qr_code || null,
            payment_link: pixResult.point_of_interaction?.transaction_data?.ticket_url || null,
          };
        }
      }

      const { error } = await supabase.from("payment_history").insert({
        organization_id: org.id,
        reference_month: referenceMonth,
        status: "pending",
        amount: total,
        due_date: dueDate.toISOString(),
        mercadopago_payment_id: mpPaymentId,
        payment_method: mpPaymentId ? "pix" : null,
        ...pixData,
      });

      if (!error) {
        created++;
        console.log(`[auto-billing] Invoice created for org ${org.name} (${org.id}): R$${total}, due: ${dueDate.toISOString().slice(0, 10)}, PIX: ${mpPaymentId ? 'yes' : 'no'}`);
      } else {
        console.error(`[auto-billing] Error creating invoice for ${org.id}:`, error);
      }
    }

    // Check overdue payments and deactivate orgs
    await supabase.rpc("check_overdue_payments");

    console.log(`[auto-billing] Done. Created: ${created}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({ created, skipped, month: referenceMonth }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[auto-billing] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
