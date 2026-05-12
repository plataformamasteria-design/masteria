import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://jrxpjzgifyzhvwjfpofz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyeHBqemdpZnl6aHZ3amZwb2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTU3ODIsImV4cCI6MjA4NTc5MTc4Mn0.qG2_ELLJaG863jqxjjqVahuDp5WO84U4Gs0UNq_Ff3I'
);

async function run() {
    console.log('Fetching all organizations matching Vholi...');
    const { data: orgs, error: orgErr } = await supabase
        .from('organizations')
        .select('id, name');

    if (orgErr) return console.error('Org err:', orgErr);

    const vholiOrgs = orgs.filter(o => o.name.toLowerCase().includes('vholi'));
    console.log('Vholi orgs:', vholiOrgs);

    if (vholiOrgs.length > 0) {
        const orgId = vholiOrgs[0].id;
        console.log('Using Org ID:', orgId);

        // let's check messages directly if they have organization_id
        const { data: msgLimit } = await supabase.from('messages').select('*').limit(1);
        console.log('Sample message columns:', Object.keys(msgLimit[0] || {}));

        const startOfDay = new Date('2026-04-10T00:00:00-03:00').toISOString();
        let msgs = [];
        if (msgLimit[0] && msgLimit[0].organization_id) {
            const { data, error } = await supabase.from('messages').select('*').eq('organization_id', orgId).gte('created_at', startOfDay);
            msgs = data || [];
            if (error) console.error(error);
        } else {
            const { data: chats } = await supabase.from('chats').select('id').eq('organization_id', orgId);
            const chatIds = chats.map(c => c.id);
            console.log(`Found ${chatIds.length} chats for org.`);
            if (chatIds.length > 0) {
                const { data, error } = await supabase.from('messages').select('*').in('chat_id', chatIds).gte('created_at', startOfDay);
                msgs = data || [];
                if (error) console.error(error);
            }
        }
        console.log(`Total messages today:`, msgs.length);
        const statuses = {};
        msgs.forEach(m => {
            const stat = m.status || 'null';
            statuses[stat] = (statuses[stat] || 0) + 1;
        });
        console.log('Statuses count:', statuses);
    }
}

run();
