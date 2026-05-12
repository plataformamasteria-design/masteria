import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log("[initialize-project] Starting project initialization...");

    // 1. Criar configuração de bot_settings se não existir
    const { data: botSettings, error: botError } = await supabaseClient.from("bot_settings").select("id").limit(1);

    if (botError) {
      console.error("[initialize-project] Error checking bot_settings:", botError);
    } else if (!botSettings || botSettings.length === 0) {
      console.log("[initialize-project] Creating default bot_settings...");
      const { error: insertBotError } = await supabaseClient.from("bot_settings").insert({ global_bot_enabled: true });

      if (insertBotError) {
        console.error("[initialize-project] Error creating bot_settings:", insertBotError);
      } else {
        console.log("[initialize-project] ✓ Bot settings created");
      }
    }

    // 2. Criar webhooks padrão se não existirem
    const webhooksToCreate = [
      {
        name: "Follow Up Webhook",
        description: "Webhook para envio de mensagens de follow-up automatizadas",
        webhook_type: "follow_up",
        url: "https://workflow-priscilla.agenciamdsolution.com/webhook/priscila-follow-up",
        active: false,
      },
      {
        name: "Message Sent Webhook",
        description: "Webhook para notificação quando mensagens são enviadas",
        webhook_type: "sent",
        url: "https://workflow-priscilla.agenciamdsolution.com/webhook/priscila-sent",
        active: false,
      },
    ];

    for (const webhook of webhooksToCreate) {
      const { data: existing, error: checkError } = await supabaseClient
        .from("webhook_configs")
        .select("id")
        .eq("webhook_type", webhook.webhook_type)
        .limit(1);

      if (checkError) {
        console.error(`[initialize-project] Error checking webhook ${webhook.webhook_type}:`, checkError);
        continue;
      }

      if (!existing || existing.length === 0) {
        console.log(`[initialize-project] Creating ${webhook.webhook_type} webhook...`);
        const { error: insertError } = await supabaseClient.from("webhook_configs").insert(webhook);

        if (insertError) {
          console.error(`[initialize-project] Error creating webhook ${webhook.webhook_type}:`, insertError);
        } else {
          console.log(`[initialize-project] ✓ Webhook ${webhook.webhook_type} created`);
        }
      }
    }

    // 3. Criar configuração de analytics se não existir
    const { data: analyticsConfig, error: analyticsError } = await supabaseClient
      .from("analytics_config")
      .select("id")
      .limit(1);

    if (analyticsError) {
      console.error("[initialize-project] Error checking analytics_config:", analyticsError);
    } else if (!analyticsConfig || analyticsConfig.length === 0) {
      console.log("[initialize-project] Creating default analytics_config...");
      const { error: insertAnalyticsError } = await supabaseClient.from("analytics_config").insert({});

      if (insertAnalyticsError) {
        console.error("[initialize-project] Error creating analytics_config:", insertAnalyticsError);
      } else {
        console.log("[initialize-project] ✓ Analytics config created");
      }
    }

    // 4. Criar configuração do sistema se não existir
    const { data: systemConfig, error: systemConfigError } = await supabaseClient
      .from("system_config")
      .select("id")
      .limit(1);

    if (systemConfigError) {
      console.error("[initialize-project] Error checking system_config:", systemConfigError);
    } else if (!systemConfig || systemConfig.length === 0) {
      console.log("[initialize-project] Creating default system_config...");
      const { error: insertSystemConfigError } = await supabaseClient.from("system_config").insert({ logo_url: null });

      if (insertSystemConfigError) {
        console.error("[initialize-project] Error creating system_config:", insertSystemConfigError);
      } else {
        console.log("[initialize-project] ✓ System config created");
      }
    }

    console.log("[initialize-project] Project initialization complete");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Project initialized successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[initialize-project] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
