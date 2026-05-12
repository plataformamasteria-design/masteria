import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
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
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `MP API error: ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ===== Get public prices =====
    if (action === "get_prices") {
      const { data: modules } = await supabase.from("global_module_prices").select("module_key, base_price");
      const { data: connections } = await supabase.from("global_connection_prices").select("connection_key, base_price");
      const { data: userConfig } = await supabase.from("global_user_config").select("*").limit(1).single();

      return new Response(JSON.stringify({ modules, connections, userConfig }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Check slug availability =====
    if (action === "check_slug") {
      const slug = url.searchParams.get("slug");
      if (!slug) throw new Error("slug is required");
      const { data } = await supabase.from("organizations").select("id").eq("slug", slug.toLowerCase()).limit(1);
      return new Response(JSON.stringify({ available: !data || data.length === 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: corsHeaders,
      });
    }

    const body = await req.json();

    // ===== Create paid subscription =====
    if (action === "create_subscription") {
      const { email, password, full_name, org_name, org_slug, selected_modules, selected_connections, extra_users } = body;

      if (!email || !password || !full_name || !org_name || !org_slug) {
        throw new HttpError("Todos os campos são obrigatórios", 400);
      }

      // Verify slug is available
      const { data: existingOrg } = await supabase.from("organizations").select("id").eq("slug", org_slug.toLowerCase()).limit(1);
      if (existingOrg && existingOrg.length > 0) {
        throw new HttpError("Este slug já está em uso", 409);
      }

      // Verify email not taken
      const { data: profileWithEmail } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .limit(1);
      if (profileWithEmail && profileWithEmail.length > 0) {
        throw new HttpError("Este email já está cadastrado. Faça login ou use outro email.", 409);
      }

      // Calculate total
      const { data: globalModules } = await supabase.from("global_module_prices").select("module_key, base_price");
      const { data: globalConnections } = await supabase.from("global_connection_prices").select("connection_key, base_price");
      const { data: userConfig } = await supabase.from("global_user_config").select("*").limit(1).single();

      const modMap: Record<string, number> = {};
      for (const m of globalModules || []) modMap[m.module_key] = Number(m.base_price);
      const connMap: Record<string, number> = {};
      for (const c of globalConnections || []) connMap[c.connection_key] = Number(c.base_price);

      const FREE_CONNECTIONS = ["whatsapp_nativo", "whatsapp"];
      let total = 0;

      // Always include padrao
      const allModules = [...new Set(["padrao", ...(selected_modules || [])])];
      for (const mk of allModules) {
        total += modMap[mk] || 0;
      }
      for (const ck of (selected_connections || [])) {
        if (FREE_CONNECTIONS.includes(ck)) continue;
        total += connMap[ck] || 0;
      }

      const extraUsersCount = extra_users || 0;
      const pricePerExtra = Number(userConfig?.default_price_per_extra_user || 0);
      total += extraUsersCount * pricePerExtra;

      if (total <= 0) throw new HttpError("Valor total inválido", 400);

      // Create pending subscription
      const { data: pendingSub, error: subError } = await supabase
        .from("pending_subscriptions")
        .insert({
          email: email.toLowerCase(),
          full_name,
          password_hash: password, // Will be used to create auth user after payment
          org_name,
          org_slug: org_slug.toLowerCase(),
          selected_modules: allModules,
          selected_connections: selected_connections || [],
          extra_users: extraUsersCount,
          total_amount: total,
          status: "pending",
        })
        .select("id")
        .single();

      if (subError) throw new Error("Erro ao criar assinatura: " + subError.message);

      // Generate Mercado Pago preference (checkout link)
      const mpToken = await getMPAccessToken(supabase);
      if (!mpToken) throw new Error("Mercado Pago não configurado");

      const origin = req.headers.get("origin") || SUPABASE_URL;
      const externalRef = `sub_${pendingSub.id}`;
      const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

      const preference = await mpFetch("/checkout/preferences", mpToken, {
        method: "POST",
        body: JSON.stringify({
          items: [{
            title: `Assinatura Vitta - ${org_name}`,
            quantity: 1,
            unit_price: Number(total),
            currency_id: "BRL",
          }],
          external_reference: externalRef,
          notification_url: webhookUrl,
          back_urls: {
            success: `${origin}/contratar?status=success&sub=${pendingSub.id}`,
            failure: `${origin}/contratar?status=failure`,
            pending: `${origin}/contratar?status=pending&sub=${pendingSub.id}`,
          },
          auto_return: "approved",
        }),
      });

      // Update pending subscription with preference ID
      await supabase.from("pending_subscriptions")
        .update({ mercadopago_preference_id: preference.id })
        .eq("id", pendingSub.id);

      return new Response(JSON.stringify({
        subscription_id: pendingSub.id,
        payment_url: preference.init_point,
        total_amount: total,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Create trial =====
    if (action === "create_trial") {
      const { email, password, full_name, org_name, org_slug } = body;

      if (!email || !password || !full_name || !org_name || !org_slug) {
        throw new HttpError("Todos os campos são obrigatórios", 400);
      }

      const slugLower = org_slug.toLowerCase();

      // Verify slug
      const { data: existingOrg } = await supabase.from("organizations").select("id").eq("slug", slugLower).limit(1);
      if (existingOrg && existingOrg.length > 0) {
        throw new HttpError("Este slug já está em uso", 409);
      }

      // Check if user already exists — try profile first, then auth
      let existingUserId: string | null = null;

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email.toLowerCase())
        .limit(1)
        .maybeSingle();

      if (existingProfile) {
        existingUserId = existingProfile.id;
      } else {
        // Profile might not exist but auth user might — check auth
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
        const existingAuthUser = (authUsers || []).find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (existingAuthUser) {
          existingUserId = existingAuthUser.id;
        }
      }

      // Create organization with trial
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: org_name,
          slug: slugLower,
          plan: "plataforma",
          active: true,
          trial_ends_at: trialEndsAt.toISOString(),
          settings: { auto_grant_permissions: true },
        })
        .select("id")
        .single();

      if (orgError) throw new Error("Erro ao criar organização: " + orgError.message);

      // Activate modules: padrao + automacao_simples
      for (const moduleKey of ["padrao", "automacao_simples"]) {
        await supabase.from("organization_modules").upsert({
          organization_id: org.id,
          module_key: moduleKey,
          active: true,
          price: -1,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,module_key" });
      }

      // Activate whatsapp_nativo connection (free)
      await supabase.from("organization_connections").upsert({
        organization_id: org.id,
        connection_key: "whatsapp_nativo",
        active: true,
        price: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,connection_key" });

      let userId: string;

      if (existingUserId) {
        // *** MULTI-ORG: User already exists — link to new org ***
        userId = existingUserId;

        // Grant admin role if not already
        await supabase.from("user_roles").upsert({
          user_id: userId,
          role: "admin",
        }, { onConflict: "user_id,role" });

        // Grant page permissions
        const pages = ["dashboard", "leads", "pipeline", "followup", "chat", "agenda", "teams", "financeiro", "commands"];
        for (const page of pages) {
          await supabase.from("user_page_permissions").upsert({
            user_id: userId,
            page,
          }).select();
        }
      } else {
        // New user — create auth user
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: email.toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: {
            full_name,
            requested_org_slug: slugLower,
          },
        });

        if (authError) {
          // If "already registered", try to find the user anyway
          const authMessage = (authError.message || "").toLowerCase();
          if (
            authMessage.includes("already") ||
            authMessage.includes("registered") ||
            authMessage.includes("duplicate")
          ) {
            // Find the auth user
            const { data: { users: fallbackUsers } } = await supabase.auth.admin.listUsers();
            const fallbackUser = (fallbackUsers || []).find(
              (u: any) => u.email?.toLowerCase() === email.toLowerCase()
            );
            if (fallbackUser) {
              userId = fallbackUser.id;
              // Ensure profile exists
              await supabase.from("profiles").upsert({
                id: userId,
                email: email.toLowerCase(),
                full_name,
                approved: true,
                pending_approval: false,
              }, { onConflict: "id" });

              await supabase.from("user_roles").upsert({
                user_id: userId,
                role: "admin",
              }, { onConflict: "user_id,role" });

              const pages = ["dashboard", "leads", "pipeline", "followup", "chat", "agenda", "teams", "financeiro", "commands"];
              for (const page of pages) {
                await supabase.from("user_page_permissions").upsert({ user_id: userId, page }).select();
              }
            } else {
              await supabase.from("organizations").delete().eq("id", org.id);
              throw new HttpError("Este email já está cadastrado mas não foi possível vincular. Faça login e tente novamente.", 409);
            }
          } else {
            await supabase.from("organizations").delete().eq("id", org.id);
            throw new Error("Erro ao criar usuário: " + authError.message);
          }
        } else {
          userId = authUser.user.id;

          // Update profile with org
          await supabase.from("profiles").update({
            organization_id: org.id,
            approved: true,
            pending_approval: false,
          }).eq("id", userId);

          // Set admin role
          await supabase.from("user_roles").upsert({
            user_id: userId,
            role: "admin",
          }, { onConflict: "user_id,role" });

          // Grant permissions
          const pages = ["dashboard", "leads", "pipeline", "followup", "chat", "agenda", "teams", "financeiro", "commands"];
          for (const page of pages) {
            await supabase.from("user_page_permissions").upsert({
              user_id: userId,
              page,
            }).select();
          }
        }
      }

      // *** MULTI-ORG: Always add to user_organizations pivot table ***
      await supabase.from("user_organizations").upsert({
        user_id: userId,
        organization_id: org.id,
        role: "admin",
        is_admin: true,
      }, { onConflict: "user_id,organization_id" });

      // Create default tags
      await supabase.from("tags").insert([
        { name: "Lead Frio", color: "#60A5FA", organization_id: org.id, icon: "Tag", order_position: 0 },
        { name: "Cliente", color: "#10B981", organization_id: org.id, icon: "User", order_position: 1 },
      ]);

      return new Response(JSON.stringify({
        success: true,
        organization_id: org.id,
        trial_ends_at: trialEndsAt.toISOString(),
        existing_user: !!existingProfile,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Check subscription status =====
    if (action === "check_subscription") {
      const subId = body.subscription_id;
      if (!subId) throw new Error("subscription_id required");

      const { data: sub } = await supabase
        .from("pending_subscriptions")
        .select("*")
        .eq("id", subId)
        .single();

      if (!sub) throw new Error("Subscription not found");

      return new Response(JSON.stringify({ status: sub.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Activate plan (choose modules/connections, generate invoice, keep trial until paid) =====
    if (action === "activate_plan") {
      const { organization_id, selected_modules, selected_connections, extra_seats } = body;
      if (!organization_id) throw new HttpError("organization_id é obrigatório", 400);

      // Verify org exists and is in trial
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .select("id, name, trial_ends_at, billing_day, max_users")
        .eq("id", organization_id)
        .single();

      if (orgErr || !org) throw new HttpError("Organização não encontrada", 404);
      if (!org.trial_ends_at) throw new HttpError("Esta organização não está em período de teste", 400);

      // Set billing_day but keep trial_ends_at (only removed when first invoice is paid)
      const today = new Date();
      const billingDay = today.getDate();

      await supabase.from("organizations").update({
        billing_day: billingDay,
        updated_at: new Date().toISOString(),
      }).eq("id", organization_id);

      // Activate selected modules (always include padrao)
      const allModules = [...new Set(["padrao", ...(selected_modules || [])])];
      // Deactivate all modules first, then activate selected
      await supabase.from("organization_modules")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("organization_id", organization_id);

      const modulesToUpsert = allModules.map(moduleKey => ({
        organization_id,
        module_key: moduleKey,
        active: true,
        price: -1,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from("organization_modules").upsert(modulesToUpsert, { onConflict: "organization_id,module_key" });

      // Activate selected connections (always include whatsapp_nativo)
      const allConnections = [...new Set(["whatsapp_nativo", ...(selected_connections || [])])];
      await supabase.from("organization_connections")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("organization_id", organization_id);

      const connectionsToUpsert = allConnections.map(connKey => ({
        organization_id,
        connection_key: connKey,
        active: true,
        price: ["whatsapp_nativo", "whatsapp"].includes(connKey) ? 0 : -1,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from("organization_connections").upsert(connectionsToUpsert, { onConflict: "organization_id,connection_key" });

      // Calculate invoice amount
      const { data: globalModules } = await supabase.from("global_module_prices").select("module_key, base_price");
      const { data: globalConnections } = await supabase.from("global_connection_prices").select("connection_key, base_price");
      const { data: userConfig } = await supabase.from("global_user_config").select("*").limit(1).single();

      const modMap: Record<string, number> = {};
      for (const m of globalModules || []) modMap[m.module_key] = Number(m.base_price);
      const connMap: Record<string, number> = {};
      for (const c of globalConnections || []) connMap[c.connection_key] = Number(c.base_price);

      const FREE_CONNECTIONS = ["whatsapp_nativo", "whatsapp"];
      let total = 0;

      for (const mk of allModules) {
        total += modMap[mk] || 0;
      }
      for (const ck of allConnections) {
        if (FREE_CONNECTIONS.includes(ck)) continue;
        total += connMap[ck] || 0;
      }

      // Extra users cost (from dialog selection)
      const requestedExtraSeats = Number(extra_seats || 0);
      const globalBaseUsers = Number(userConfig?.default_max_users || 10);
      const pricePerExtra = Number(userConfig?.default_price_per_extra_user || 0);
      total += requestedExtraSeats * pricePerExtra;

      // Update org max_users if extra seats requested
      if (requestedExtraSeats > 0) {
        await supabase.from("organizations").update({
          max_users: globalBaseUsers + requestedExtraSeats,
        }).eq("id", organization_id);
      }

      // Generate or update first invoice
      const referenceMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 5);

      // Check if an unpaid invoice already exists for this month
      const { data: existingInvoice } = await supabase
        .from("payment_history")
        .select("id, status")
        .eq("organization_id", organization_id)
        .eq("reference_month", referenceMonth)
        .in("status", ["pending", "failed"])
        .limit(1)
        .single();

      if (existingInvoice) {
        // Update existing invoice with new amount
        await supabase.from("payment_history").update({
          amount: total,
          due_date: dueDate.toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
          pix_qr_code: null,
          pix_copy_paste: null,
          boleto_url: null,
          payment_link: null,
        }).eq("id", existingInvoice.id);
      } else {
        await supabase.from("payment_history").insert({
          organization_id,
          reference_month: referenceMonth,
          amount: total,
          status: "pending",
          due_date: dueDate.toISOString().split("T")[0],
        });
      }

      return new Response(JSON.stringify({
        success: true,
        total_amount: total,
        reference_month: referenceMonth,
        billing_day: billingDay,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const isBusinessError = err instanceof HttpError;
    const status = isBusinessError ? 200 : 500;
    console.error("Subscription API error:", err);
    return new Response(JSON.stringify({ error: err.message, ok: false }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
