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
const supabaseToken = env['SUPABASE_ACCESS_TOKEN'];

async function main() {
    // using postgres meta endpoint if possible, but edge function rest is better
    const query = `
      SELECT polname, qual, with_check 
      FROM pg_policy 
      WHERE polrelid = 'chats'::regclass;
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
    // This may fail if there is no exec_sql_secret endpoint
    // An alternative is using supersonic or a similar tool.
    const data = await res.text();
    console.log(data);
}
main();
