import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return String(n);
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function getMPAccessToken(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("mercadopago_config")
    .select("access_token_encrypted")
    .eq("active", true)
    .limit(1)
    .single();
  return data?.access_token_encrypted || null;
}

async function mpFetch(path: string, token: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(`https://api.mercadopago.com${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
        ...(options.headers || {}),
      },
    });

    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const text = await res.text();
      console.error("MP returned non-JSON:", text.substring(0, 300));
      throw new Error(`Mercado Pago returned non-JSON response (${res.status})`);
    }

    const data = await res.json();
    if (!res.ok) {
      console.error("MP API error:", JSON.stringify(data));
      throw new Error(data.message || `MP API error: ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// Recalculate current month's pending invoice for an org after module/connection/seat changes
async function recalculateCurrentInvoice(supabase: any, orgId: string) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get current pending invoice
  const { data: invoice } = await supabase
    .from("payment_history")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("reference_month", currentMonth)
    .limit(1)
    .single();

  if (!invoice || invoice.status === "paid") return;

  // Calculate new total
  const { data: modules } = await supabase
    .from("organization_modules")
    .select("module_key, price")
    .eq("organization_id", orgId)
    .eq("active", true);

  const { data: connections } = await supabase
    .from("organization_connections")
    .select("connection_key, price")
    .eq("organization_id", orgId)
    .eq("active", true);

  const { data: globalModules } = await supabase.from("global_module_prices").select("module_key, base_price");
  const { data: globalConnections } = await supabase.from("global_connection_prices").select("connection_key, base_price");

  const gModMap: Record<string, number> = {};
  for (const gm of globalModules || []) gModMap[gm.module_key] = Number(gm.base_price || 0);
  const gConnMap: Record<string, number> = {};
  for (const gc of globalConnections || []) gConnMap[gc.connection_key] = Number(gc.base_price || 0);

  const FREE_CONNECTIONS = ["whatsapp_nativo", "whatsapp"];
  let total = 0;
  for (const m of modules || []) {
    const p = Number(m.price ?? 0);
    total += p === -1 ? (gModMap[m.module_key] || 0) : Math.max(0, p);
  }
  for (const c of connections || []) {
    if (FREE_CONNECTIONS.includes(c.connection_key)) continue;
    const p = Number(c.price ?? 0);
    total += p === -1 ? (gConnMap[c.connection_key] || 0) : Math.max(0, p);
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

  // Update invoice amount
  await supabase.from("payment_history").update({ amount: total }).eq("id", invoice.id);
  console.log(`[recalculate] Updated invoice for org ${orgId} month ${currentMonth}: R$${total}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ===== Webhook from Mercado Pago (no auth required) =====
    if (req.method === "POST" && !action) {
      const body = await req.json();
      console.log("MP Webhook received:", JSON.stringify(body));

      // Handle both v2 webhook format AND IPN (topic/resource) format
      const paymentId = body.data?.id || (body.topic === "payment" ? body.resource : null);

      if ((body.type === "payment" || body.topic === "payment") && paymentId) {
        const token = await getMPAccessToken(supabase);
        if (!token) throw new Error("MP not configured");

        const payment = await mpFetch(`/v1/payments/${paymentId}`, token);
        console.log("Payment details:", JSON.stringify(payment));

        const externalRef = payment.external_reference;
        if (!externalRef) {
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const status = payment.status === "approved" ? "paid" : payment.status === "rejected" ? "failed" : "pending";

        // Handle subscription payments (new org creation)
        if (externalRef.startsWith("sub_")) {
          const subId = externalRef.replace("sub_", "");

          if (status === "paid") {
            console.log(`[webhook] Subscription payment approved for sub ${subId}`);

            // Get pending subscription
            const { data: sub } = await supabase
              .from("pending_subscriptions")
              .select("*")
              .eq("id", subId)
              .eq("status", "pending")
              .single();

            if (sub) {
              try {
                // Create organization
                const today = new Date();
                const billingDay = today.getDate();
                const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

                const { data: org, error: orgError } = await supabase
                  .from("organizations")
                  .insert({
                    name: sub.org_name,
                    slug: sub.org_slug,
                    plan: "plataforma",
                    active: true,
                    billing_day: billingDay,
                    settings: { auto_grant_permissions: true },
                  })
                  .select("id")
                  .single();

                if (orgError) throw orgError;

                // Activate selected modules
                if (sub.selected_modules && sub.selected_modules.length > 0) {
                  const modulesToUpsert = sub.selected_modules.map((moduleKey: string) => ({
                    organization_id: org.id,
                    module_key: moduleKey,
                    active: true,
                    price: -1,
                    updated_at: new Date().toISOString(),
                  }));
                  await supabase.from("organization_modules").upsert(modulesToUpsert, { onConflict: "organization_id,module_key" });
                }

                // Activate selected connections
                if (sub.selected_connections && sub.selected_connections.length > 0) {
                  const connectionsToUpsert = sub.selected_connections.map((connKey: string) => ({
                    organization_id: org.id,
                    connection_key: connKey,
                    active: true,
                    price: -1,
                    updated_at: new Date().toISOString(),
                  }));
                  await supabase.from("organization_connections").upsert(connectionsToUpsert, { onConflict: "organization_id,connection_key" });
                }

                // Always activate whatsapp_nativo
                await supabase.from("organization_connections").upsert({
                  organization_id: org.id,
                  connection_key: "whatsapp_nativo",
                  active: true,
                  price: 0,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "organization_id,connection_key" });

                // Handle extra users
                if (sub.extra_users > 0) {
                  const { data: userConfig } = await supabase.from("global_user_config").select("*").limit(1).single();
                  const baseUsers = userConfig?.default_max_users || 3;
                  const pricePerExtra = Number(userConfig?.default_price_per_extra_user || 0);
                  await supabase.from("organizations").update({
                    max_users: baseUsers + sub.extra_users,
                    price_per_extra_user: pricePerExtra,
                  }).eq("id", org.id);
                }

                // Create auth user
                const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                  email: sub.email,
                  password: sub.password_hash,
                  email_confirm: true,
                  user_metadata: {
                    full_name: sub.full_name,
                    requested_org_slug: sub.org_slug,
                  },
                });

                if (authError) throw authError;

                // Update profile
                await supabase.from("profiles").update({
                  organization_id: org.id,
                  approved: true,
                  pending_approval: false,
                }).eq("id", authUser.user.id);

                // Set admin role
                await supabase.from("user_roles").upsert({
                  user_id: authUser.user.id,
                  role: "admin",
                }, { onConflict: "user_id,role" });

                // Grant permissions
                const planPages = ["dashboard", "leads", "pipeline", "followup", "chat", "agenda", "teams", "financeiro", "commands"];
                if ((sub.selected_modules || []).includes("atendente_ia")) {
                  planPages.push("promptia", "developer");
                }
                for (const page of planPages) {
                  try {
                    await supabase.from("user_page_permissions").insert({
                      user_id: authUser.user.id,
                      page,
                    });
                  } catch { }
                }

                // Create first invoice (already paid)
                await supabase.from("payment_history").insert({
                  organization_id: org.id,
                  reference_month: currentMonth,
                  status: "paid",
                  amount: Number(sub.total_amount),
                  mercadopago_payment_id: String(payment.id),
                  payment_method: payment.payment_method_id || "pix",
                  payment_date: new Date().toISOString(),
                  due_date: new Date().toISOString(),
                });

                // Mark subscription as completed
                await supabase.from("pending_subscriptions")
                  .update({ status: "completed", mercadopago_payment_id: String(payment.id) })
                  .eq("id", subId);

                console.log(`[webhook] Org ${org.id} created from subscription ${subId}`);
              } catch (err) {
                console.error(`[webhook] Error creating org from sub ${subId}:`, err);
                await supabase.from("pending_subscriptions")
                  .update({ status: "error" })
                  .eq("id", subId);
              }
            }
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Handle token purchases
        if (externalRef.startsWith("token_")) {
          // Format: token_{purchaseId}
          const purchaseId = externalRef.replace("token_", "");

          if (status === "paid") {
            console.log(`[webhook] Token purchase payment approved for purchase ${purchaseId}`);

            const { data: purchase } = await supabase
              .from("pending_token_purchases")
              .select("*")
              .eq("id", purchaseId)
              .eq("status", "pending")
              .single();

            if (purchase) {
              // Credit tokens to organization
              const { data: currentBalance } = await supabase
                .from("organization_token_balances")
                .select("*")
                .eq("organization_id", purchase.organization_id)
                .eq("provider", purchase.provider)
                .maybeSingle();

              if (currentBalance) {
                await supabase.from("organization_token_balances")
                  .update({ total_tokens: (currentBalance.total_tokens || 0) + purchase.token_amount })
                  .eq("id", currentBalance.id);
              } else {
                await supabase.from("organization_token_balances")
                  .insert({ organization_id: purchase.organization_id, provider: purchase.provider, total_tokens: purchase.token_amount, used_tokens: 0 });
              }

              // Record transaction
              await supabase.from("token_transactions").insert({
                organization_id: purchase.organization_id,
                provider: purchase.provider,
                transaction_type: "purchase",
                amount: purchase.token_amount,
                description: `Compra: ${formatTokens(purchase.token_amount)} tokens ${purchase.provider === "openai" ? "ChatGPT" : "Gemini"} — R$ ${Number(purchase.price).toFixed(2)}`,
                created_by: purchase.created_by,
              });

              // Record in payment_history for unified billing view
              const now = new Date();
              const refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              await supabase.from("payment_history").insert({
                organization_id: purchase.organization_id,
                amount: Number(purchase.price),
                status: "paid",
                reference_month: refMonth,
                payment_type: purchase.provider === "openai" ? "token_chatgpt" : "token_gemini",
                payment_method: "pix",
                payment_date: new Date().toISOString(),
                mercadopago_payment_id: String(payment.id),
                mercadopago_external_reference: externalRef,
                notes: `Compra de ${formatTokens(purchase.token_amount)} tokens ${purchase.provider === "openai" ? "ChatGPT" : "Gemini"}`,
              });

              // Mark purchase as paid
              await supabase.from("pending_token_purchases")
                .update({ status: "paid", paid_at: new Date().toISOString(), mercadopago_payment_id: String(payment.id) })
                .eq("id", purchaseId);

              console.log(`[webhook] ${purchase.token_amount} tokens credited to org ${purchase.organization_id} (${purchase.provider})`);
            }
          } else {
            // Update status for non-paid statuses
            await supabase.from("pending_token_purchases")
              .update({ status: status === "failed" ? "cancelled" : "pending", mercadopago_payment_id: String(payment.id) })
              .eq("id", purchaseId);
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Handle contract payments (module/connection/user_seat)
        if (externalRef.startsWith("contract_")) {
          // Format: contract_{type}_{orgId}_{itemKey}_{timestamp}
          const contractParts = externalRef.split("_");
          const contractType = contractParts[1]; // module, connection, userseat
          const contractOrgId = contractParts[2];
          const contractItemKey = contractParts.slice(3, -1).join("_"); // item key (may contain underscores)

          if (status === "paid") {
            console.log(`[webhook] Contract payment approved: ${contractType} ${contractItemKey} for org ${contractOrgId}`);

            if (contractType === "module") {
              await supabase.from("organization_modules").upsert({
                organization_id: contractOrgId,
                module_key: contractItemKey,
                active: true,
                updated_at: new Date().toISOString(),
              }, { onConflict: "organization_id,module_key" });
              console.log(`[webhook] Module ${contractItemKey} activated for org ${contractOrgId}`);
            } else if (contractType === "connection") {
              await supabase.from("organization_connections").upsert({
                organization_id: contractOrgId,
                connection_key: contractItemKey,
                active: true,
                updated_at: new Date().toISOString(),
              }, { onConflict: "organization_id,connection_key" });
              console.log(`[webhook] Connection ${contractItemKey} activated for org ${contractOrgId}`);
            } else if (contractType === "userseat") {
              // Increase max_users by 1
              const { data: orgData } = await supabase
                .from("organizations")
                .select("max_users")
                .eq("id", contractOrgId)
                .single();
              const currentMax = orgData?.max_users || 3;
              await supabase.from("organizations").update({
                max_users: currentMax + 1,
              }).eq("id", contractOrgId);
              console.log(`[webhook] User seat added for org ${contractOrgId}: ${currentMax} -> ${currentMax + 1}`);
            }

            // Recalculate and update pending invoices for current month
            await recalculateCurrentInvoice(supabase, contractOrgId);
            await supabase.from("organizations").update({ active: true }).eq("id", contractOrgId);
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Standard invoice payment: format org_{orgId}_{refMonth}
        const parts = externalRef.split("_");
        const orgId = parts[1];
        const refMonth = parts[2];

        const updateData: any = {
          status,
          amount: payment.transaction_amount || 0,
          mercadopago_payment_id: String(payment.id),
          payment_method: payment.payment_method_id || null,
          payment_date: status === "paid" ? (payment.date_approved || new Date().toISOString()) : null,
          metadata: {
            mp_status: payment.status,
            mp_status_detail: payment.status_detail,
            payment_type: payment.payment_type_id,
            payer_email: payment.payer?.email,
          },
        };

        const { data: existingRecord } = await supabase
          .from("payment_history")
          .select("id")
          .eq("organization_id", orgId)
          .eq("reference_month", refMonth)
          .limit(1)
          .single();

        if (existingRecord) {
          await supabase.from("payment_history").update(updateData).eq("id", existingRecord.id);
        } else {
          await supabase.from("payment_history").insert({
            organization_id: orgId,
            reference_month: refMonth,
            ...updateData,
          });
        }

        if (status === "paid") {
          // Clear trial_ends_at on first payment - org officially exits trial
          await supabase.from("organizations").update({ active: true, trial_ends_at: null }).eq("id", orgId);
          console.log(`[webhook] Org ${orgId} reactivated/trial ended after payment`);
        }

        await supabase.rpc("check_overdue_payments");
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Authenticated actions =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userSupabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub;
    let body: any = {};
    if (req.method === "POST") {
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    // ===== Test Connection =====
    if (action === "test_connection") {
      const mpToken = await getMPAccessToken(supabase);
      if (!mpToken) {
        return new Response(JSON.stringify({ connected: false, error: "Access Token não configurado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const me = await mpFetch("/users/me", mpToken);
        return new Response(JSON.stringify({
          connected: true,
          account: {
            id: me.id,
            email: me.email,
            first_name: me.first_name,
            last_name: me.last_name,
            site_id: me.site_id,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ connected: false, error: err.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== Create Payment (Pix, Boleto, Card) =====
    if (action === "create_payment") {
      const { organization_id, amount, reference_month, description, payment_method, payer_email, payer_doc_type, payer_doc_number, payer_first_name, payer_last_name, card_token, installments } = body;

      const mpToken = await getMPAccessToken(supabase);
      if (!mpToken) throw new Error("Mercado Pago não configurado");

      const externalRef = `org_${organization_id}_${reference_month}`;
      const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

      const paymentBody: any = {
        transaction_amount: Number(amount),
        description: description || `Assinatura ${reference_month}`,
        external_reference: externalRef,
        notification_url: webhookUrl,
        payer: {
          email: payer_email || "cliente@email.com",
        },
      };

      // Add payer identification if provided
      if (payer_doc_type && payer_doc_number) {
        paymentBody.payer.identification = {
          type: payer_doc_type || "CPF",
          number: payer_doc_number,
        };
      }
      if (payer_first_name) paymentBody.payer.first_name = payer_first_name;
      if (payer_last_name) paymentBody.payer.last_name = payer_last_name;

      // Configure payment method
      if (payment_method === "pix") {
        paymentBody.payment_method_id = "pix";
      } else if (payment_method === "boleto") {
        paymentBody.payment_method_id = "bolbradesco";
      } else if (payment_method === "credit_card" || payment_method === "debit_card") {
        if (!card_token) throw new Error("Token do cartão é obrigatório");
        paymentBody.token = card_token;
        paymentBody.installments = installments || 1;
        paymentBody.payment_method_id = payment_method === "debit_card" ? "debvisa" : undefined;
      }

      console.log("Creating payment:", JSON.stringify(paymentBody));
      const payment = await mpFetch("/v1/payments", mpToken, {
        method: "POST",
        body: JSON.stringify(paymentBody),
      });

      console.log("Payment created:", JSON.stringify(payment));

      const status = payment.status === "approved" ? "paid" : payment.status === "rejected" ? "failed" : "pending";

      // Check if invoice is already paid - don't overwrite
      const { data: existingInvoice } = await supabase
        .from("payment_history")
        .select("id, status")
        .eq("organization_id", organization_id)
        .eq("reference_month", reference_month)
        .limit(1)
        .single();

      if (existingInvoice?.status === "paid") {
        // Already paid, just return payment data without overwriting
        return new Response(JSON.stringify({
          payment_id: payment.id,
          status: payment.status,
          already_paid: true,
          pix_qr_code: payment.point_of_interaction?.transaction_data?.qr_code || null,
          pix_qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
          pix_ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url || null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save to payment_history (only if not already paid)
      const upsertData: any = {
        organization_id,
        reference_month,
        status,
        amount: Number(amount),
        mercadopago_payment_id: String(payment.id),
        payment_method: payment.payment_method_id || payment_method,
        payment_date: status === "paid" ? new Date().toISOString() : null,
        due_date: existingInvoice?.id ? undefined : new Date().toISOString(),
        metadata: {
          mp_status: payment.status,
          mp_status_detail: payment.status_detail,
          payment_type: payment.payment_type_id,
          pix_qr_code: payment.point_of_interaction?.transaction_data?.qr_code || null,
          pix_qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
          pix_ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url || null,
          boleto_url: payment.transaction_details?.external_resource_url || null,
          boleto_barcode: payment.barcode?.content || null,
          date_of_expiration: payment.date_of_expiration || null,
        },
      };

      if (existingInvoice) {
        await supabase.from("payment_history").update(upsertData).eq("id", existingInvoice.id);
      } else {
        upsertData.due_date = new Date().toISOString();
        await supabase.from("payment_history").insert(upsertData);
      }

      if (status === "paid") {
        await supabase.from("organizations").update({ active: true }).eq("id", organization_id);
      }

      return new Response(JSON.stringify({
        payment_id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        payment_method: payment.payment_method_id,
        // Pix
        pix_qr_code: payment.point_of_interaction?.transaction_data?.qr_code || null,
        pix_qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        pix_ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url || null,
        // Boleto
        boleto_url: payment.transaction_details?.external_resource_url || null,
        boleto_barcode: payment.barcode?.content || null,
        // Card
        installments: payment.installments || null,
        date_of_expiration: payment.date_of_expiration || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Validate / Check Payment Status =====
    if (action === "validate_payment") {
      const paymentId = url.searchParams.get("payment_id") || body.payment_id;
      if (!paymentId) throw new Error("payment_id é obrigatório");

      const mpToken = await getMPAccessToken(supabase);
      if (!mpToken) throw new Error("Mercado Pago não configurado");

      const payment = await mpFetch(`/v1/payments/${paymentId}`, mpToken);

      const status = payment.status === "approved" ? "paid" : payment.status === "rejected" ? "failed" : payment.status === "cancelled" ? "cancelled" : "pending";

      // Update in DB if we have external_reference
      if (payment.external_reference) {
        const parts = payment.external_reference.split("_");
        if (parts.length >= 3) {
          const orgId = parts[1];
          const refMonth = parts[2];

          await supabase.from("payment_history").upsert(
            {
              organization_id: orgId,
              reference_month: refMonth,
              status,
              amount: payment.transaction_amount || 0,
              mercadopago_payment_id: String(payment.id),
              payment_method: payment.payment_method_id || null,
              payment_date: status === "paid" ? (payment.date_approved || new Date().toISOString()) : null,
              metadata: {
                mp_status: payment.status,
                mp_status_detail: payment.status_detail,
                payment_type: payment.payment_type_id,
                validated_at: new Date().toISOString(),
              },
            },
            { onConflict: "organization_id,reference_month" }
          );

          if (status === "paid") {
            // End trial when first payment is confirmed
            await supabase.from("organizations").update({ active: true, trial_ends_at: null }).eq("id", orgId);
          }
        }
      }

      return new Response(JSON.stringify({
        payment_id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        amount: payment.transaction_amount,
        payment_method: payment.payment_method_id,
        date_approved: payment.date_approved,
        date_created: payment.date_created,
        payer_email: payment.payer?.email,
        external_reference: payment.external_reference,
        db_status: status,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Create Preference (checkout link) =====
    if (action === "create_preference") {
      const { organization_id, amount, reference_month, description } = body;
      const mpToken = await getMPAccessToken(supabase);
      if (!mpToken) throw new Error("Mercado Pago não configurado");

      const externalRef = `org_${organization_id}_${reference_month}`;
      const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

      const preference = await mpFetch("/checkout/preferences", mpToken, {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              title: description || `Assinatura ${reference_month}`,
              quantity: 1,
              unit_price: Number(amount),
              currency_id: "BRL",
            },
          ],
          external_reference: externalRef,
          notification_url: webhookUrl,
          payment_methods: {
            excluded_payment_types: [],
            installments: 12,
          },
          back_urls: {
            success: `${req.headers.get("origin") || ""}/profile?tab=plano&status=success`,
            failure: `${req.headers.get("origin") || ""}/profile?tab=plano&status=failure`,
            pending: `${req.headers.get("origin") || ""}/profile?tab=plano&status=pending`,
          },
          auto_return: "approved",
        }),
      });

      await supabase.from("payment_history").upsert(
        {
          organization_id,
          reference_month,
          status: "pending",
          amount: Number(amount),
          mercadopago_preference_id: preference.id,
          mercadopago_external_reference: externalRef,
          due_date: new Date().toISOString(),
        },
        { onConflict: "organization_id,reference_month" }
      );

      return new Response(JSON.stringify({ preference_url: preference.init_point, preference_id: preference.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Payment Status (legacy) =====
    if (action === "payment_status") {
      const paymentId = url.searchParams.get("payment_id");
      const mpToken = await getMPAccessToken(supabase);
      if (!mpToken) throw new Error("Mercado Pago não configurado");

      const payment = await mpFetch(`/v1/payments/${paymentId}`, mpToken);

      return new Response(JSON.stringify(payment), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Generate Invoices (super admin) — delegates to auto-billing-generator =====
    if (action === "generate_invoices") {
      const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
      if (!isSA) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }

      const targetMonth = body.reference_month || new Date().toISOString().slice(0, 7);
      const mpToken = await getMPAccessToken(supabase);
      const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

      const { data: orgs } = await supabase.from("organizations").select("id, name, billing_day, settings, created_at").eq("active", true);

      // Get global prices for fallback
      const { data: globalModules } = await supabase.from("global_module_prices").select("module_key, base_price");
      const { data: globalConnections } = await supabase.from("global_connection_prices").select("connection_key, base_price");

      const globalModuleMap: Record<string, number> = {};
      for (const gm of globalModules || []) globalModuleMap[gm.module_key] = Number(gm.base_price || 0);
      const globalConnMap: Record<string, number> = {};
      for (const gc of globalConnections || []) globalConnMap[gc.connection_key] = Number(gc.base_price || 0);

      // Helper: generate list of months from org creation to target month
      function getMonthRange(startDate: string, endMonth: string): string[] {
        const months: string[] = [];
        const [endY, endM] = endMonth.split("-").map(Number);
        const start = new Date(startDate);
        let y = start.getFullYear();
        let m = start.getMonth() + 1; // 1-indexed
        while (y < endY || (y === endY && m <= endM)) {
          months.push(`${y}-${String(m).padStart(2, "0")}`);
          m++;
          if (m > 12) { m = 1; y++; }
        }
        return months;
      }

      let created = 0;
      for (const org of orgs || []) {
        // Get all months from org creation to target month
        const orgCreated = org.created_at || new Date().toISOString();
        const monthsToGenerate = getMonthRange(orgCreated, targetMonth);

        // Get existing invoices for this org
        const { data: existingInvoices } = await supabase
          .from("payment_history")
          .select("reference_month")
          .eq("organization_id", org.id);
        const existingMonths = new Set((existingInvoices || []).map((e: any) => e.reference_month));

        // Calculate total for this org
        const { data: modules } = await supabase
          .from("organization_modules")
          .select("module_key, price")
          .eq("organization_id", org.id)
          .eq("active", true);
        const { data: connections } = await supabase
          .from("organization_connections")
          .select("connection_key, price")
          .eq("organization_id", org.id)
          .eq("active", true);

        const FREE_CONNECTIONS = ["whatsapp_nativo", "whatsapp"];
        let total = 0;
        for (const m of modules || []) {
          const p = Number(m.price ?? 0);
          if (p === -1) {
            total += globalModuleMap[m.module_key] || 0;
          } else {
            total += Math.max(0, p);
          }
        }
        for (const c of connections || []) {
          if (FREE_CONNECTIONS.includes(c.connection_key)) continue;
          const p = Number(c.price ?? 0);
          if (p === -1) {
            total += globalConnMap[c.connection_key] || 0;
          } else {
            total += Math.max(0, p);
          }
        }

        if (total <= 0) continue;

        for (const referenceMonth of monthsToGenerate) {
          if (existingMonths.has(referenceMonth)) continue;

          const billingDay = org.billing_day || 10;
          const [year, month] = referenceMonth.split("-").map(Number);
          const maxDay = new Date(year, month, 0).getDate();
          const effectiveDay = Math.min(billingDay, maxDay);
          const dueDate = new Date(year, month - 1, effectiveDay);
          const now = new Date();
          if (dueDate < now) {
            // Keep the original due date for past months
          }

          const payerEmail = org.settings?.email || "cliente@vitta.com";

          let pixData: any = {};
          let mpPaymentId: string | null = null;
          // Only generate PIX for current/future months
          const isCurrentOrFuture = referenceMonth >= now.toISOString().slice(0, 7);
          if (mpToken && isCurrentOrFuture) {
            try {
              const externalRef = `org_${org.id}_${referenceMonth}`;
              const pixPayment = await mpFetch("/v1/payments", mpToken, {
                method: "POST",
                body: JSON.stringify({
                  transaction_amount: total,
                  description: `Assinatura Vitta - ${referenceMonth}`,
                  payment_method_id: "pix",
                  external_reference: externalRef,
                  notification_url: webhookUrl,
                  payer: { email: payerEmail },
                }),
              });
              mpPaymentId = String(pixPayment.id);
              pixData = {
                pix_qr_code: pixPayment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
                pix_copy_paste: pixPayment.point_of_interaction?.transaction_data?.qr_code || null,
                payment_link: pixPayment.point_of_interaction?.transaction_data?.ticket_url || null,
              };
              console.log(`[generate_invoices] PIX created for ${org.name} ${referenceMonth}: #${mpPaymentId}`);
            } catch (e) {
              console.error(`[generate_invoices] PIX error for ${org.id} ${referenceMonth}:`, e);
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
          if (!error) created++;
        }
      }

      await supabase.rpc("check_overdue_payments");

      return new Response(JSON.stringify({ created, month: targetMonth }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Contract Item (module/connection/user_seat) =====
    if (action === "contract_item") {
      const { organization_id, item_type, item_key, item_label, amount } = body;
      if (!organization_id || !item_type || !item_key) {
        throw new Error("organization_id, item_type, item_key são obrigatórios");
      }

      const numAmount = Number(amount || 0);

      // If free, activate directly
      if (numAmount <= 0) {
        if (item_type === "module") {
          await supabase.from("organization_modules").upsert({
            organization_id,
            module_key: item_key,
            active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "organization_id,module_key" });
        } else if (item_type === "connection") {
          await supabase.from("organization_connections").upsert({
            organization_id,
            connection_key: item_key,
            active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "organization_id,connection_key" });
        } else if (item_type === "user_seat") {
          const { data: orgData } = await supabase.from("organizations").select("max_users").eq("id", organization_id).single();
          await supabase.from("organizations").update({ max_users: (orgData?.max_users || 3) + 1 }).eq("id", organization_id);
        }
        await recalculateCurrentInvoice(supabase, organization_id);
        return new Response(JSON.stringify({ activated: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate PIX payment for contracting
      const mpToken = await getMPAccessToken(supabase);
      if (!mpToken) throw new Error("Mercado Pago não configurado");

      const timestamp = Date.now();
      const contractType = item_type === "user_seat" ? "userseat" : item_type;
      const externalRef = `contract_${contractType}_${organization_id}_${item_key}_${timestamp}`;
      const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

      const pixPayment = await mpFetch("/v1/payments", mpToken, {
        method: "POST",
        body: JSON.stringify({
          transaction_amount: numAmount,
          description: `Contratação: ${item_label || item_key}`,
          payment_method_id: "pix",
          external_reference: externalRef,
          notification_url: webhookUrl,
          payer: { email: "cliente@vitta.com" },
        }),
      });

      return new Response(JSON.stringify({
        payment_id: pixPayment.id,
        status: pixPayment.status,
        pix_qr_code: pixPayment.point_of_interaction?.transaction_data?.qr_code || null,
        pix_qr_code_base64: pixPayment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        pix_ticket_url: pixPayment.point_of_interaction?.transaction_data?.ticket_url || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Token Purchase (PIX payment) =====
    if (action === "token_purchase") {
      const { organization_id, provider, token_amount, price, package_name } = body;
      if (!organization_id || !provider || !token_amount || !price) {
        throw new Error("organization_id, provider, token_amount, price são obrigatórios");
      }

      // Create pending purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from("pending_token_purchases")
        .insert({
          organization_id,
          provider,
          token_amount: Number(token_amount),
          price: Number(price),
          created_by: userId,
          status: "pending",
        })
        .select("id")
        .single();

      if (purchaseError) throw purchaseError;

      const mpToken = await getMPAccessToken(supabase);
      if (!mpToken) throw new Error("Mercado Pago não configurado");

      const externalRef = `token_${purchase.id}`;
      const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;
      const providerLabel = provider === "openai" ? "ChatGPT" : "Gemini";

      const pixPayment = await mpFetch("/v1/payments", mpToken, {
        method: "POST",
        body: JSON.stringify({
          transaction_amount: Number(price),
          description: `Recarga Tokens ${providerLabel}: ${package_name || `${token_amount} tokens`}`,
          payment_method_id: "pix",
          external_reference: externalRef,
          notification_url: webhookUrl,
          payer: { email: "cliente@vitta.com" },
        }),
      });

      // Update purchase with MP data
      await supabase.from("pending_token_purchases").update({
        mercadopago_payment_id: String(pixPayment.id),
        mercadopago_external_reference: externalRef,
        pix_qr_code: pixPayment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        pix_copy_paste: pixPayment.point_of_interaction?.transaction_data?.qr_code || null,
        payment_link: pixPayment.point_of_interaction?.transaction_data?.ticket_url || null,
      }).eq("id", purchase.id);

      return new Response(JSON.stringify({
        purchase_id: purchase.id,
        payment_id: pixPayment.id,
        status: pixPayment.status,
        pix_qr_code: pixPayment.point_of_interaction?.transaction_data?.qr_code || null,
        pix_qr_code_base64: pixPayment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        pix_ticket_url: pixPayment.point_of_interaction?.transaction_data?.ticket_url || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Check Token Purchase Status =====
    if (action === "token_purchase_status") {
      const purchaseId = url.searchParams.get("purchase_id") || body.purchase_id;
      if (!purchaseId) throw new Error("purchase_id é obrigatório");

      const { data: purchase } = await supabase
        .from("pending_token_purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();

      if (!purchase) throw new Error("Compra não encontrada");

      // If still pending and has MP payment ID, check with MP
      if (purchase.status === "pending" && purchase.mercadopago_payment_id) {
        const mpToken = await getMPAccessToken(supabase);
        if (mpToken) {
          try {
            const payment = await mpFetch(`/v1/payments/${purchase.mercadopago_payment_id}`, mpToken);
            if (payment.status === "approved" && purchase.status === "pending") {
              // Process payment inline (same as webhook)
              const { data: currentBalance } = await supabase
                .from("organization_token_balances")
                .select("*")
                .eq("organization_id", purchase.organization_id)
                .eq("provider", purchase.provider)
                .maybeSingle();

              if (currentBalance) {
                await supabase.from("organization_token_balances")
                  .update({ total_tokens: (currentBalance.total_tokens || 0) + purchase.token_amount })
                  .eq("id", currentBalance.id);
              } else {
                await supabase.from("organization_token_balances")
                  .insert({ organization_id: purchase.organization_id, provider: purchase.provider, total_tokens: purchase.token_amount, used_tokens: 0 });
              }

              await supabase.from("token_transactions").insert({
                organization_id: purchase.organization_id,
                provider: purchase.provider,
                transaction_type: "purchase",
                amount: purchase.token_amount,
                description: `Compra: ${formatTokens(purchase.token_amount)} tokens ${purchase.provider === "openai" ? "ChatGPT" : "Gemini"} — R$ ${Number(purchase.price).toFixed(2)}`,
                created_by: purchase.created_by,
              });

              // Record in payment_history
              const now2 = new Date();
              const refMonth2 = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`;
              await supabase.from("payment_history").insert({
                organization_id: purchase.organization_id,
                amount: Number(purchase.price),
                status: "paid",
                reference_month: refMonth2,
                payment_type: purchase.provider === "openai" ? "token_chatgpt" : "token_gemini",
                payment_method: "pix",
                payment_date: new Date().toISOString(),
                mercadopago_payment_id: String(payment.id),
                notes: `Compra de ${formatTokens(purchase.token_amount)} tokens ${purchase.provider === "openai" ? "ChatGPT" : "Gemini"}`,
              });

              await supabase.from("pending_token_purchases")
                .update({ status: "paid", paid_at: new Date().toISOString(), mercadopago_payment_id: String(payment.id) })
                .eq("id", purchaseId);

              return new Response(JSON.stringify({ status: "paid", token_amount: purchase.token_amount }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } catch (e) {
            console.error("Error checking MP payment:", e);
          }
        }
      }

      return new Response(JSON.stringify({ status: purchase.status, token_amount: purchase.token_amount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("MP Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
