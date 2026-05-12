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
    const res = await fetch('https://jrxpjzgifyzhvwjfpofz.supabase.co/rest/v1/chats?phone=eq.557191584740&organization_id=eq.a35f0d29-7002-4ca3-99d9-4f7b29ca7f14', {
        headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
        }
    });

    const data = await res.json();
    console.log('Chats found in Vholi org for 557191584740:', JSON.stringify(data, null, 2));
}

main();
