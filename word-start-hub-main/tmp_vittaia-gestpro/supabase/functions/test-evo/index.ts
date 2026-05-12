import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req: Request) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const orgId = "1edb57f6-8c4d-40e7-839b-f9776cd73c98";

    // Find any automation executions between 09:00 and 09:35 BRT (12:00 to 12:35 UTC)
    const { data: execs, error } = await supabase.from('automation_executions')
        .select('*')
        .eq('organization_id', orgId)
        .gte('created_at', '2026-04-11T12:00:00.000Z')
        .lte('created_at', '2026-04-11T12:35:00.000Z');

    return new Response(JSON.stringify({
        msg: "Execution Check",
        execs,
        error
    }, null, 2), { headers: { 'Content-Type': 'application/json' } })
})
