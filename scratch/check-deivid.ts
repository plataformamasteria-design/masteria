import { supabaseAdmin } from '../src/lib/supabase-admin';

async function check() {
  const { data: leads } = await supabaseAdmin.from('contacts').select('*').ilike('name', '%Deivid Rodrigues%');
  console.log('Leads:', leads);
  
  if (leads && leads.length > 0) {
    const leadIds = leads.map((l: any) => l.id);
    const { data: logs } = await supabaseAdmin.from('automation_logs').select('*').in('contact_id', leadIds).order('created_at', { ascending: false }).limit(20);
    console.log('Logs for Deivid:', logs);

    const { data: executions } = await supabaseAdmin.from('automation_executions').select('*').in('contact_id', leadIds).order('created_at', { ascending: false }).limit(20);
    console.log('Executions for Deivid:', executions);
  }
}

check();
