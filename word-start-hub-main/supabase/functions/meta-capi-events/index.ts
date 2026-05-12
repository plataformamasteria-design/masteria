import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Verify Auth
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
        }

        const { chat_id, organization_id, event_name = 'Purchase', value = 0, currency = 'BRL' } = await req.json()

        if (!chat_id || !organization_id) {
            return new Response(JSON.stringify({ error: 'Missing required params' }), { status: 400, headers: corsHeaders })
        }

        // 1. Fetch Chat Info (Phone & Ad Info)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: chat } = await supabaseAdmin
            .from('chats')
            .select('phone, ad_id, campaign_id')
            .eq('id', chat_id)
            .eq('organization_id', organization_id)
            .single()

        if (!chat || !chat.phone) {
            return new Response(JSON.stringify({ error: 'Chat or Phone not found' }), { status: 404, headers: corsHeaders })
        }

        // Prepare Phone (Meta requires strict format: digits only, including country code, no space/plus)
        const cleanPhone = chat.phone.replace(/\D/g, '')
        const hashedPhone = await sha256(cleanPhone)

        // 2. Fetch Meta Credentials & Pixel ID
        const { data: credRow } = await supabaseAdmin
            .from('marketing_credentials')
            .select('credentials')
            .eq('organization_id', organization_id)
            .eq('platform', 'meta')
            .eq('status', 'connected')
            .single()

        const creds = credRow?.credentials as Record<string, any>
        if (!creds || !creds.access_token || !creds.pixel_id) {
            // It's a silent fail. We just don't send if not configured.
            return new Response(JSON.stringify({ ok: true, skipped: 'Meta CAPI not configured for this org' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { access_token, pixel_id } = creds

        // 3. Assemble CAPI Payload
        const unixTime = Math.floor(Date.now() / 1000)

        const eventData: any = {
            event_name,
            event_time: unixTime,
            action_source: "system_generated",
            user_data: {
                ph: [hashedPhone],
            },
            custom_data: {
                value: typeof value === 'number' ? value : parseFloat(value || '0'),
                currency
            }
        }

        // If we have ad origin, we can pass it (CAPI supports external_id, or custom parameters)
        // There isn't an explicit standard field for campaign_id in standard offline events besides maybe custom_data,
        // but we can pass it to help Facebook attribute.
        if (chat.ad_id || chat.campaign_id) {
            eventData.custom_data.ad_id = chat.ad_id
            eventData.custom_data.campaign_id = chat.campaign_id
        }

        const fbPayload = {
            data: [eventData],
            access_token
        }

        // 4. Dispatch to Meta
        const fbRes = await fetch(`https://graph.facebook.com/v21.0/${pixel_id}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbPayload)
        })

        const fbData = await fbRes.json()

        if (fbData.error) {
            console.error('[Meta CAPI] Error:', fbData.error)
            return new Response(JSON.stringify({ ok: false, error: fbData.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ ok: true, fb_response: fbData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
        console.error('Error in meta-capi-events:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    }
})
