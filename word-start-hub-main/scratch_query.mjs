import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

let env = process.env;
try {
  const envFile = readFileSync('./.env', 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length > 0) {
      let val = vals.join('=').trim().replace(/^"|"$/g, '');
      process.env[key.trim()] = val;
    }
  });
} catch(e) {}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  const { data: chats, error: chatErr } = await supabase.from('chats').select('*').limit(1);
  if (chatErr) {
    console.error('Error:', chatErr);
  } else {
    console.log('Chats rows:', chats.length);
    if (chats.length > 0) console.log('Sample chat keys:', Object.keys(chats[0]));
  }
}
run();
