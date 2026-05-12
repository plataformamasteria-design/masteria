import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const envStr = await Deno.readTextFile('.env');
const url = envStr.match(/SUPABASE_URL=(.*?)\r?\n/)?.[1]?.trim();
const key = envStr.match(/SUPABASE_SERVICE_ROLE_KEY=(.*?)\r?\n/)?.[1]?.trim() || envStr.match(/SUPABASE_ACCESS_TOKEN=(.*?)\r?\n/)?.[1]?.trim();

const supabase = createClient(url, key);

const { data: logs, error } = await supabase.from('ghl_sync_logs').select('created_at, status, message, endpoint').order('created_at', { ascending: false }).limit(5);

if (error) {
  console.error(error);
} else {
  console.log("Recent GHL Sync Logs:");
  console.log(JSON.stringify(logs, null, 2));
}
