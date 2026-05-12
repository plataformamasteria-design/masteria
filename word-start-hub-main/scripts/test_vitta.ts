import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    env[key.trim()] = values.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const url = env['VITE_SUPABASE_URL'] || '';
const key = env['SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'] || '';

async function main() {
  console.log('Checking Vitta IA...');
  
  const orgRes = await fetch(`${url}/rest/v1/organizations?slug=eq.vitta-ia&select=id,slug,instance_name,evolution_api_url,evolution_api_key,evolution_webhook_url`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  
  const org = await orgRes.json();
  console.log('Organization:', org);
  
  if (org && org.length > 0) {
    const orgId = org[0].id;
    const connRes = await fetch(`${url}/rest/v1/whatsapp_connections?organization_id=eq.${orgId}&select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    
    const conns = await connRes.json();
    console.log('\nConnections:');
    console.log(JSON.stringify(conns, null, 2));
  }
}

main();
