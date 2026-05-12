import { createClient } from "npm:@supabase/supabase-js@2.45.6";
import twilio from "npm:twilio@4.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) throw new Error("Unauthorized");

    // Fetch Global Config containing Twilio keys
    const { data: globalData, error: globalError } = await supabase
      .from("global_config")
      .select("*")
      .in('key', [
        'twilio_account_sid',
        'twilio_api_key_sid',
        'twilio_api_key_secret',
        'twilio_twiml_app_sid'
      ]);

    if (globalError) throw new Error("Database error while fetching global config");

    const configMap = globalData?.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {}) || {};

    const accountSid = configMap['twilio_account_sid'];
    const apiKeySid = configMap['twilio_api_key_sid'];
    const apiKeySecret = configMap['twilio_api_key_secret'];
    const twimlAppSid = configMap['twilio_twiml_app_sid'];

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      throw new Error("Twilio configuration is incomplete in Global Settings");
    }

    // Generate Twilio Access Token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Use the user's ID as the Twilio Client identity
    const identity = `vitta_agent_${user.id}`;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    const token = new AccessToken(
      accountSid,
      apiKeySid,
      apiKeySecret,
      { identity }
    );
    token.addGrant(voiceGrant);

    return new Response(
      JSON.stringify({ token: token.toJwt(), identity }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Twilio Token Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
