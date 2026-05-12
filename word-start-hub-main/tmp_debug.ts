import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const envText = await Deno.readTextFile('.env');
const SUPABASE_URL = envText.match(/SUPABASE_URL=([^\r\n]+)/)?.[1] || "";
const SUPABASE_SERVICE_ROLE_KEY = envText.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1] || envText.match(/SUPABASE_ACCESS_TOKEN=([^\r\n]+)/)?.[1] || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data: logs, error } = await supabase
  .from('ghl_sync_logs')
  .select('created_at, status, message, endpoint, payload')
  .order('created_at', { ascending: false })
  .limit(5);

if (error) {
  console.error("DB Error:", error);
} else {
  console.log("Recent GHL Sync Logs:", JSON.stringify(logs, null, 2));
}

// Check recent messages
const { data: messages } = await supabase
  .from('messages')
  .select('id, content, file_url, message_type, created_at, is_from_user')
  .order('created_at', { ascending: false })
  .limit(3);

console.log("\nRecent Messages:", JSON.stringify(messages, null, 2));
