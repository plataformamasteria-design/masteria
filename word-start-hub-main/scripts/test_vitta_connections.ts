import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function main() {
  console.log('Checking Vitta IA...');
  
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, slug, instance_name, evolution_api_url, evolution_api_key, settings')
    .eq('slug', 'vitta-ia');
    
  if (orgErr) { console.error('Org Error:', orgErr); return; }
  console.log('Organization:', org);
  
  if (org && org.length > 0) {
    const orgId = org[0].id;
    const { data: connections, error: connErr } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('organization_id', orgId);
      
    if (connErr) { console.error('Connection Error:', connErr); return; }
    console.log('\nConnections:');
    console.log(JSON.stringify(connections, null, 2));
  }
}

main();
