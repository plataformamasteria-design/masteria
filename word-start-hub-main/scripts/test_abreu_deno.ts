const url = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY') || '';

async function main() {
  const orgRes = await fetch(`${url}/rest/v1/organizations?name=ilike.*Abreu*&select=id,slug,name`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  
  const org = await orgRes.json();
  console.log('Organization:', org);
  if (org && org.length > 0) {
    const orgId = org[0].id;
    const chatsRes = await fetch(`${url}/rest/v1/chats?organization_id=eq.${orgId}&select=id,channel,phone&limit=5`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const chats = await chatsRes.json();
    console.log('\nChats:', chats);
    
    // check webhooks
    const whRes = await fetch(`${url}/rest/v1/webhook_configs?organization_id=eq.${orgId}&select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const whs = await whRes.json();
    console.log('\nWebhooks:', whs);
  } else {
    // maybe try to list all
    const allRes = await fetch(`${url}/rest/v1/organizations?select=id,slug,name&limit=5`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log('Fallback first 5 orgs:', await allRes.json());
  }
}

main();
