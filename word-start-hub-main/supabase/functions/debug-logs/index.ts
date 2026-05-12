import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: logs } = await supabase
            .from("ghl_sync_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);

        const { data: msgs } = await supabase
            .from("messages")
            .select("id, content, sync_source, file_url, created_at, message_type, chat_id")
            .order("created_at", { ascending: false })
            .limit(50);

        const chatIds = Array.from(new Set(msgs?.map(m => m.chat_id).filter(Boolean)));
        let mappings = [];
        if (chatIds.length > 0) {
            const { data } = await supabase
                .from("ghl_sync_mappings")
                .select("*")
                .in("vitta_id", chatIds)
                .eq("resource_type", "contact");
            mappings = data || [];
        }

        const { data: conns } = await supabase
            .from("ghl_connections")
            .select("*")
            .limit(100);

        const { data: deividChats } = await supabase
            .from("chats")
            .select("*")
            .ilike("wa_name", "%Deivid%");

        let deividMsgs = [];
        if (deividChats && deividChats.length > 0) {
            const chatIds = deividChats.map(c => c.id);
            const { data } = await supabase
                .from("messages")
                .select("*")
                .in("chat_id", chatIds)
                .order("created_at", { ascending: false })
                .limit(50);
            deividMsgs = data;
        }

        return new Response(
            JSON.stringify({ logs, msgs, mappings, conns, deividChats, deividMsgs }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (e: any) {
        return new Response(
            JSON.stringify({ error: e.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
