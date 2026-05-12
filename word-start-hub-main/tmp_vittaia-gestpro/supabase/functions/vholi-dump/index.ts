import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req: Request) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all AI Agent nodes from Vitta IA / Roberta / Vholi
    const { data: nodes, error } = await supabase
        .from('automation_nodes')
        .select('id, node_type, config, organization_id, automations!inner(name, organization_id, organizations(name))')
        .eq('node_type', 'ai_agent');

    if (error) {
        return new Response(JSON.stringify({ error }), { status: 500 });
    }

    // Map to a readable format
    const mapped = nodes.map(n => ({
        node_id: n.id,
        automation_name: n.automations?.name,
        org_name: n.automations?.organizations?.name,
        prompt: n.config?.prompt || n.config?.system_prompt || n.config || 'NO PROMPT'
    })).filter(n => {
        const org = n.org_name?.toLowerCase() || '';
        return org.includes('roberta') || org.includes('vitta') || org.includes('vholi');
    });

    return new Response(JSON.stringify(mapped, null, 2), { headers: { 'Content-Type': 'application/json' } })
})
