import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);

const { data: chats } = await supabase.from('chats').select('id, channel, phone, wa_name, custom_name').ilike('phone', '%8893648545%');
console.log("Chats:");
console.log(JSON.stringify(chats, null, 2));

const { data: conns } = await supabase.from('whatsapp_connections').select('id, instance_name, display_name, ghl_user_id');
console.log("\nConnections:");
console.log(JSON.stringify(conns, null, 2));

if (chats && chats.length > 0) {
  const { data: mappings } = await supabase.from('ghl_sync_mappings').select('vitta_id, ghl_id').in('vitta_id', chats.map(c => c.id));
  console.log("\nMappings:");
  console.log(JSON.stringify(mappings, null, 2));
}
