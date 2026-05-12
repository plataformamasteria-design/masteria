import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { payload } = await req.json()
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Payload missing' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Fetch SSO Shared Secret
        const { data: globalConfig } = await supabase
            .from('ghl_global_config')
            .select('sso_shared_secret')
            .limit(1)
            .single()

        if (!globalConfig?.sso_shared_secret) {
            return new Response(JSON.stringify({ error: 'SSO Shared Secret not configured by Admin' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            })
        }

        // Decrypt payload
        let userData;
        try {
            const decrypted = CryptoJS.AES.decrypt(payload, globalConfig.sso_shared_secret).toString(CryptoJS.enc.Utf8)
            userData = JSON.parse(decrypted)
        } catch (e) {
            console.error('Decryption failed', e)
            return new Response(JSON.stringify({ error: 'Invalid or malformed SSO payload' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        const { email, locationId, userId, name } = userData

        if (!email || !locationId || !userId) {
            return new Response(JSON.stringify({ error: 'Missing required fields in SSO payload' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        // Find Organization matching this Location ID
        const { data: ghlConnection } = await supabase
            .from('ghl_connections')
            .select('organization_id')
            .eq('location_id', locationId)
            .limit(1)
            .maybeSingle()

        if (!ghlConnection) {
            return new Response(JSON.stringify({ error: 'Location not connected to Vitta IA OAuth' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403
            })
        }

        const orgId = ghlConnection.organization_id

        // Check if user exists in profiles
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, ghl_user_id')
            .eq('email', email)
            .limit(1)
            .maybeSingle()

        let authUserId = null;

        if (existingProfile) {
            authUserId = existingProfile.id
            if (existingProfile.ghl_user_id !== userId) {
                // Link GHL mapping
                await supabase.from('profiles').update({
                    ghl_user_id: userId,
                    ghl_location_id: locationId
                }).eq('id', authUserId)
            }
        } else {
            // Auto-create user
            const { data: authData, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true,
                password: crypto.randomUUID(), // Random secure password (SSO only)
                user_metadata: { full_name: name || email.split('@')[0] }
            })

            if (createError || !authData.user) {
                throw new Error(createError?.message || 'Failed to create auto user')
            }

            authUserId = authData.user.id

            // Create profile
            await supabase.from('profiles').insert({
                id: authUserId,
                email,
                full_name: name || email.split('@')[0],
                organization_id: orgId,
                approved: true, // Auto-approve SSO users
                ghl_user_id: userId,
                ghl_location_id: locationId
            })
        }

        // Generate magic link session for seamless redirect
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: {
                redirectTo: `${Deno.env.get('SUPABASE_PUBLISHABLE_KEY')}` // Workaround string flag?
            }
        })

        if (linkError) throw linkError

        // Properties.action_link contains the token
        const actionLink = linkData.properties.action_link

        return new Response(JSON.stringify({ success: true, redirect_url: actionLink }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (err: any) {
        console.error('SSO Edge Error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
