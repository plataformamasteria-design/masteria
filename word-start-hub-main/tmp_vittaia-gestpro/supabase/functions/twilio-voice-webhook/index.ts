import { createClient } from "npm:@supabase/supabase-js@2.45.6";

function generateTwiML(to: string, callerId: string) {
  // Ensure strict E.164 formatting for outbound routing
  let formattedTo = to.trim();
  if (!formattedTo.startsWith('+')) {
    formattedTo = '+' + formattedTo;
  }

  let formattedCallerId = callerId.trim();
  if (!formattedCallerId.startsWith('+')) {
    formattedCallerId = '+' + formattedCallerId;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${formattedCallerId}">
    <Number>${formattedTo}</Number>
  </Dial>
</Response>`;
}

Deno.serve(async (req) => {
  let formData;
  try {
    formData = await req.formData();
  } catch (e) {
    console.error("No form data found", e);
    return new Response("<Response><Reject/></Response>", {
      headers: { "Content-Type": "text/xml" }
    });
  }

  const to = formData.get("To") || formData.get("dest");

  if (!to) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Destino não identificado pelo sistema.</Say></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Extract Caller ID from Database
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from("global_config")
    .select("value")
    .eq("key", "twilio_phone_number")
    .single();

  const callerId = data?.value || "";

  if (!callerId) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Número de origem não foi configurado.</Say></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  const xml = generateTwiML(to.toString(), callerId);

  return new Response(xml, {
    headers: { "Content-Type": "text/xml" }
  });
});
