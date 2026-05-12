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

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: chats, error } = await supabase
        .from('chats')
        .select('id, phone, wa_name, created_at, organization_id')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching chat:', error);
        return;
    }

    console.log('--- Last 10 chats in DB ---');
    for (const chat of chats || []) {
        console.log(`Chat: ${chat.id} | Phone: ${chat.phone} | Name: ${chat.wa_name} | Created: ${chat.created_at}`);
    }
}

main();
