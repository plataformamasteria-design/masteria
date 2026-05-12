import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req: Request) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const chatId = 'edd558ad-6dbf-49ed-a760-6acdfcb603b8';
    const orgId = 'b4bedd00-3a14-4b25-bd79-db508a3c26c9';

    const { data: chat } = await supabase.from('chats').select('agent_off, bot_permanently_stopped, status, resolved_at').eq('id', chatId).single();
    const { data: orgSettings } = await supabase.from('bot_settings').select('*').eq('organization_id', orgId).maybeSingle();

    const { data: executions } = await supabase.from('automation_executions').select('*').eq('chat_id', chatId).order('created_at', { ascending: false });
    const { data: logs } = await supabase.from('automation_execution_logs').select('status, message, created_at').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20);

    return new Response(JSON.stringify({
        chat_status: chat,
        global_bot_settings: orgSettings,
        executions,
        recent_logs: logs
    }, null, 2), { headers: { 'Content-Type': 'application/json' } })
})
