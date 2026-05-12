import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { transcribeAudio, describeImage, extractPdfText } from "../_shared/ai-media.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { messageIds, credentialId, organizationId } = await req.json();

        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return new Response(JSON.stringify({ success: true, message: "No messages to parse" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: messages, error } = await supabase
            .from("messages")
            .select("id, message_type, content, file_url, file_name")
            .in("id", messageIds)
            .eq("organization_id", organizationId);

        if (error || !messages) {
            throw new Error(error?.message || "Erro ao buscar mensagens");
        }

        let parsedCount = 0;

        for (const m of messages) {
            if (m.content && m.content.trim() !== "") continue; // Already has content
            if (!m.file_url) continue;

            let extractedText: string | null = null;
            let prefix = "";

            if (m.message_type === "audio") {
                extractedText = await transcribeAudio(m.file_url, credentialId, organizationId, supabase);
                prefix = "[Áudio transcrito]: ";
            } else if (m.message_type === "image") {
                extractedText = await describeImage(m.file_url, credentialId, organizationId, supabase);
                prefix = "[Imagem]: ";
            } else if (m.message_type === "document" && m.file_name?.toLowerCase().endsWith(".pdf")) {
                extractedText = await extractPdfText(m.file_url);
                prefix = "[PDF]: ";
            }

            if (extractedText) {
                const newContent = `${prefix}${extractedText}`;
                await supabase.from("messages").update({ content: newContent }).eq("id", m.id);
                parsedCount++;
            }
        }

        return new Response(JSON.stringify({ success: true, parsedCount }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("[parse-chat-media] error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
