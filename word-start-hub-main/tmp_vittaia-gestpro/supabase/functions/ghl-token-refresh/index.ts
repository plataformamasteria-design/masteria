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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get global GHL config (client_id + client_secret)
    const { data: config, error: configError } = await supabase
      .from("ghl_global_config")
      .select("client_id, client_secret")
      .limit(1)
      .single();

    if (configError || !config) {
      console.log("No GHL global config found, skipping refresh.");
      return new Response(JSON.stringify({ skipped: true, reason: "no_config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find connections expiring in the next 2 hours (or already expired)
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data: connections, error: connError } = await supabase
      .from("ghl_connections")
      .select("id, organization_id, refresh_token, token_expires_at")
      .not("refresh_token", "is", null)
      .lte("token_expires_at", twoHoursFromNow);

    if (connError) {
      console.error("Error fetching connections:", connError);
      throw connError;
    }

    if (!connections || connections.length === 0) {
      console.log("No GHL tokens need refreshing.");
      return new Response(JSON.stringify({ refreshed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let refreshed = 0;
    let failed = 0;

    for (const conn of connections) {
      try {
        const tokenResponse = await fetch(
          "https://services.leadconnectorhq.com/oauth/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: config.client_id,
              client_secret: config.client_secret,
              grant_type: "refresh_token",
              refresh_token: conn.refresh_token,
            }),
          }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenData.access_token) {
          console.error(`Failed to refresh token for org ${conn.organization_id}:`, tokenData);
          failed++;

          await supabase.from("ghl_sync_logs").insert({
            organization_id: conn.organization_id,
            direction: "ghl_to_vitta",
            resource_type: "token_refresh",
            status: "error",
            message: `Token refresh failed: ${tokenData.error || tokenData.error_message || "unknown"}`,
          });
          continue;
        }

        const expiresAt = new Date(
          Date.now() + (tokenData.expires_in || 86400) * 1000
        ).toISOString();

        const { error: updateError } = await supabase
          .from("ghl_connections")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || conn.refresh_token,
            token_expires_at: expiresAt,
          })
          .eq("id", conn.id);

        if (updateError) {
          console.error(`Error updating token for org ${conn.organization_id}:`, updateError);
          failed++;
        } else {
          refreshed++;
          console.log(`Token refreshed for org ${conn.organization_id}, expires at ${expiresAt}`);
        }
      } catch (err) {
        console.error(`Exception refreshing token for org ${conn.organization_id}:`, err);
        failed++;
      }
    }

    await supabase.from("ghl_sync_logs").insert({
      organization_id: connections[0].organization_id,
      direction: "ghl_to_vitta",
      resource_type: "token_refresh",
      status: "success",
      message: `Batch refresh: ${refreshed} ok, ${failed} failed out of ${connections.length}`,
    });

    return new Response(
      JSON.stringify({ refreshed, failed, total: connections.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("GHL token refresh error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
