import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    try {
        console.log('Invoking test-evo...');
        const { data: testData, error: testErr } = await supabase.functions.invoke('test-evo', { method: 'POST' });
        console.log('Result:', testData);
        if (testErr) console.error('Error:', testErr);

    } catch (e) {
        console.error(e);
    }
}
main();
