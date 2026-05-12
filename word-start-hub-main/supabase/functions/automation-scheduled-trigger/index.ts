import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log('[automation-scheduled-trigger] Polling scheduled automations...');

        const now = new Date();

        const { data: automations, error: fetchErr } = await supabase
            .from('automations')
            .select('id, organization_id, schedule_config')
            .eq('status', 'active')
            .eq('trigger_type', 'scheduled');

        if (fetchErr) throw fetchErr;

        if (!automations || automations.length === 0) {
            console.log('No active scheduled automations found.');
            return new Response(JSON.stringify({ success: true, message: 'No scheduled automations' }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        for (const auto of automations) {
            try {
                const config = typeof auto.schedule_config === 'string' ? JSON.parse(auto.schedule_config) : (auto.schedule_config || {});
                const interval = parseInt(config.interval) || 1;
                const unit = config.unit || 'minutes';
                const lastRunStr = config.last_run;

                let shouldRun = false;

                if (!lastRunStr) {
                    shouldRun = true;
                } else {
                    const lastRun = new Date(lastRunStr);
                    const nextRun = new Date(lastRun);

                    if (unit === 'seconds') nextRun.setSeconds(nextRun.getSeconds() + interval);
                    else if (unit === 'minutes') nextRun.setMinutes(nextRun.getMinutes() + interval);
                    else if (unit === 'hours') nextRun.setHours(nextRun.getHours() + interval);
                    else if (unit === 'days') nextRun.setDate(nextRun.getDate() + interval);

                    if (now >= nextRun) shouldRun = true;
                }

                if (shouldRun) {
                    console.log(`[automation-scheduled-trigger] Firing scheduled automation ${auto.id}`);

                    await supabase.from('automations').update({
                        schedule_config: { ...config, last_run: now.toISOString() }
                    }).eq('id', auto.id);

                    fetch(`${supabaseUrl}/functions/v1/automation-executor`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                        body: JSON.stringify({
                            trigger_type: 'scheduled',
                            automation_id: auto.id,
                            organization_id: auto.organization_id,
                        })
                    }).catch(e => console.error('Error invoking automation-executor:', e));
                }
            } catch (err) {
                console.error(`[automation-scheduled-trigger] Error evaluating auto ${auto.id}:`, err);
            }
        }

        return new Response(JSON.stringify({ success: true, message: 'CRON ran successfully' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error('Error in automation-scheduled-trigger:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
