import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL="(.+?)"/)?.[1];
const supabaseKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.+?)"/)?.[1];
const serviceKey = env.match(/SUPABASE_ACCESS_TOKEN="(.+?)"/)?.[1]; 

(async () => {
  // Wait, serviceKey is SBP token, it doesn't work for REST API.
  // I will just use the anon key.
  const resLogs = await fetch(`${supabaseUrl}/rest/v1/ghl_sync_logs?select=*&order=created_at.desc&limit=5`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  console.log("LOGS:", JSON.stringify(await resLogs.json(), null, 2));
})();
