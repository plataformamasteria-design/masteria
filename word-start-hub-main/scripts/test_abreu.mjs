import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envLines = fs.readFileSync('.env', 'utf-8').split('\n');
const env = {};
envLines.forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/"/g, '');
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'] || env['SUPABASE_URL'];
const SUPABASE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, slug, name')
    .ilike('name', '%Abreu%');
    
  console.log("Orgs:", orgs, error);
  
  if (orgs && orgs.length > 0) {
    const { data: chats } = await supabase
      .from('chats')
      .select('id, channel')
      .eq('organization_id', orgs[0].id)
      .limit(5);
    console.log("Chats channel sample:", chats);
  }
}

check();
