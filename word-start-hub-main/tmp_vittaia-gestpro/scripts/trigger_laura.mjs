import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const phone = '557186257056';

    // 1. Get the chat
    const { data: chats, error: chatErr } = await supabase
        .from('chats')
        .select('id, organization_id, phone')
        .eq('phone', phone);

    if (chatErr || !chats || chats.length === 0) {
        console.error("Could not find chat for phone", phone, chatErr);
        return;
    }

    // Assume Vholi is the one we want. (Or we just use the first one if there are multiple)
    const chat = chats[0];
    console.log("Found chat:", chat.id, "Org:", chat.organization_id);

    // 2. Get the current funnel stage
    const { data: stages, error: stgErr } = await supabase
        .from('chat_funnel_stage')
        .select('funnel_id, stage_id')
        .eq('chat_id', chat.id)
        .eq('organization_id', chat.organization_id);

    if (stgErr || !stages || stages.length === 0) {
        console.error("No funnel stages found for this chat", stgErr);
        return;
    }

    // The user said "Lead Frio", let's just trigger for all active funnels on this chat
    for (const stage of stages) {
        console.log(`Triggering 'message_received' for chat ${chat.id} on funnel ${stage.funnel_id} stage ${stage.stage_id}...`);

        // 3. Invoke the edge function
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke('automation-executor', {
            body: {
                trigger_type: 'message_received',
                chat_id: chat.id,
                stage_id: stage.stage_id,
                funnel_id: stage.funnel_id,
                organization_id: chat.organization_id,
            },
        });

        if (invokeErr) {
            console.error("Failed to invoke automation-executor", invokeErr);
        } else {
            console.log("Successfully invoked automation-executor:", invokeRes);
        }
    }
}

main().catch(console.error);
