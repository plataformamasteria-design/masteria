import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const m = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (m) {
        let val = m[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        env[m[1]] = val;
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

async function main() {
    const query = `
      SELECT created_at, content, chat_id, organization_id, sender_id 
      FROM public.messages 
      ORDER BY created_at DESC 
      LIMIT 10;
    `;
    const res = await fetch('https://jrxpjzgifyzhvwjfpofz.supabase.co/rest/v1/rpc/exec_sql_secret', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ query })
    });
    const data = await res.text();
    console.log("MESSAGES (last 10):", data);

    const query2 = `
      SELECT id, phone, organization_id, channel, last_message_at, updated_at
      FROM public.chats 
      ORDER BY updated_at DESC 
      LIMIT 5;
    `;
    const res2 = await fetch('https://jrxpjzgifyzhvwjfpofz.supabase.co/rest/v1/rpc/exec_sql_secret', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
        },
        body: JSON.stringify({ query: query2 })
    });
    const data2 = await res2.text();
    console.log("CHATS (last 5):", data2);
}
main();
