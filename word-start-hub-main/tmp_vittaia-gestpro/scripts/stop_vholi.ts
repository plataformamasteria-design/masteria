import { createClient } from '@supabase/supabase-js';

(async () => {
    const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

    // 1. Get All Orgs
    const { data: orgs, error: orgErr } = await supabase.from('organizations').select('id, name');
    if (orgErr || !orgs) {
        console.error("Orgs not found", orgErr);
        return;
    }
    console.log("All orgs:", orgs.map((o: any) => o.name));

    const org = orgs.find((o: any) => o.name.toLowerCase().includes('vholi'));
    if (!org) {
        console.error("Vholi not found in list");
        return;
    }
    console.log("Found org:", org.name);

    // 2. Get Automations "Follow Up" for Vholi
    const { data: automations, error: autErr } = await supabase.from('automations')
        .select('id, name, active')
        .eq('organization_id', org.id)
        .ilike('name', '%Follow Up%');

    if (autErr || !automations?.length) {
        console.error("No automations found", autErr);
        return;
    }

    console.log("Found Automations:");
    automations.forEach(a => console.log(`- ${a.name} (${a.id}) - active: ${a.active}`));

    for (const aut of automations) {
        const { data: states, error: stateErr } = await supabase.from('lead_automation_state')
            .select('id, chat_id, status, error_message')
            .eq('automation_id', aut.id)
            .in('status', ['waiting', 'running']);

        console.log(`Active leads in ${aut.name}: ${states?.length || 0}`);

        if (states && states.length > 0) {
            const stateIds = states.map(s => s.id);
            const { error: updErr } = await supabase.from('lead_automation_state')
                .update({ status: 'error', error_message: 'Interrompido manualmente' })
                .in('id', stateIds);

            if (updErr) console.error("Error updating:", updErr);
            else console.log(`Successfully stopped ${states.length} leads in ${aut.name}`);
        }
    }
})();
