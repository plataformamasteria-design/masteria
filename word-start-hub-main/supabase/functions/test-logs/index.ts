import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: msgs } = await supabase.from('messages')
        .select('*')
        .eq('organization_id', 'b4bedd00-3a14-4b25-bd79-db508a3c26c9')
        .in('message_type', ['audio', 'image', 'video', 'document'])
        .order('created_at', { ascending: false })
        .limit(5);

    return new Response(JSON.stringify({ msgs }, null, 2), { headers: { "Content-Type": "application/json" }});
});
