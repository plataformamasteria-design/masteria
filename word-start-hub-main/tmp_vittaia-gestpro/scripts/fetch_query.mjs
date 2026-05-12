import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
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
const supabase = createClient(supabaseUrl, env['SUPABASE_ACCESS_TOKEN'] || supabaseKey); // We'll just fetch via edge function anyway.

async function main() {
    const res = await fetch('https://jrxpjzgifyzhvwjfpofz.supabase.co/rest/v1/messages?chat_id=eq.4afb19e9-4164-4bc8-9462-9eb52a160368&order=created_at.desc&limit=20', {
        headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
        }
    });

    const data = await res.json();
    const interesting = data.filter((m: any) => m.created_at.includes('17:47') || m.created_at.includes('17:48'));
    console.log(JSON.stringify(interesting, null, 2));
}

main();
