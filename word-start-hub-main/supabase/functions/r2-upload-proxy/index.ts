/**
 * R2 Upload Proxy - Edge Function
 * Receives file uploads from the frontend (authenticated users only)
 * and uploads them to Cloudflare R2 storage.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { uploadToR2, isR2Configured } from "../_shared/r2-client.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-file-name, x-content-type, x-chat-id",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Authenticate user
        const authHeader = req.headers.get("authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Check R2 configuration
        if (!isR2Configured()) {
            return new Response(
                JSON.stringify({ error: "R2 storage not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get file metadata from headers
        const fileName = req.headers.get("x-file-name") || `${Date.now()}.bin`;
        const contentType = req.headers.get("x-content-type") || "application/octet-stream";
        const chatId = req.headers.get("x-chat-id") || "general";

        // Read file body
        const arrayBuffer = await req.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        if (bytes.length === 0) {
            return new Response(
                JSON.stringify({ error: "Empty file" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build storage path
        const fileExt = fileName.split(".").pop() || "bin";
        const storagePath = `${chatId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        // Upload to R2
        const publicUrl = await uploadToR2(bytes, storagePath, contentType);

        if (!publicUrl) {
            return new Response(
                JSON.stringify({ error: "Upload failed" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ publicUrl, storagePath, fileName }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[r2-upload-proxy] Error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
