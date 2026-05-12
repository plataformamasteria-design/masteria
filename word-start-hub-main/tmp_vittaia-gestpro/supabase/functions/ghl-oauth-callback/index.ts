import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // organization_id

    if (!code || !state) {
      return new Response(
        `<html><body><h2>Erro: Código ou estado ausente</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get GHL global config
    const { data: config, error: configError } = await supabase
      .from("ghl_global_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !config) {
      console.error("GHL config not found:", configError);
      return new Response(
        `<html><body><h2>Erro: Configuração GHL não encontrada</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 500 }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://services.leadconnectorhq.com/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.client_id,
          client_secret: config.client_secret,
          grant_type: "authorization_code",
          code,
          redirect_uri: config.redirect_uri,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return new Response(
        `<html><body><h2>Erro ao obter token: ${tokenData.error || "desconhecido"}</h2><script>setTimeout(()=>window.close(),5000)</script></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 400 }
      );
    }

    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 86400) * 1000
    ).toISOString();

    // Try to reuse existing conversation provider ID from another connected org
    const { data: providerFallback } = await supabase
      .from("ghl_connections")
      .select("conversation_provider_id")
      .not("conversation_provider_id", "is", null)
      .limit(1)
      .maybeSingle();

    // Upsert connection
    const { error: upsertError } = await supabase
      .from("ghl_connections")
      .upsert(
        {
          organization_id: state,
          location_id: tokenData.locationId || tokenData.location_id || null,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
          scopes: tokenData.scope ? tokenData.scope.split(" ") : [],
          conversation_provider_id: providerFallback?.conversation_provider_id ?? undefined,
        },
        { onConflict: "organization_id" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        `<html><body><h2>Erro ao salvar conexão</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 500 }
      );
    }

    // Log
    await supabase.from("ghl_sync_logs").insert({
      organization_id: state,
      direction: "ghl_to_vitta",
      resource_type: "oauth",
      status: "success",
      message: `OAuth conectado. Location: ${tokenData.locationId || "N/A"}`,
    });

    return new Response(
      `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#fff">
        <div style="text-align:center">
          <h2 style="color:#22c55e">✅ GHL Conectado com Sucesso!</h2>
          <p style="color:#aaa">Esta janela será fechada automaticamente...</p>
          <script>setTimeout(()=>window.close(),2000)</script>
        </div>
      </body></html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("GHL OAuth callback error:", err);
    return new Response(
      `<html><body><h2>Erro interno</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 500 }
    );
  }
});
