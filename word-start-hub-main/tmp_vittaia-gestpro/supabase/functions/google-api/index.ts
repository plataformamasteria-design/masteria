import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { action, organization_id, user_id, ...params } = await req.json()

        if (!organization_id || !user_id) {
            return new Response(JSON.stringify({ error: 'organization_id and user_id are required' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Get global Google credentials from environment variables (fallback)
        let clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

        // Or get from global_config
        const { data: globalConfigData } = await supabase
            .from('global_config')
            .select('key, value')
            .in('key', ['google_ads_client_id', 'google_ads_client_secret'])

        const configClientId = globalConfigData?.find((c: any) => c.key === 'google_ads_client_id')?.value
        const configClientSecret = globalConfigData?.find((c: any) => c.key === 'google_ads_client_secret')?.value

        if (configClientId && configClientSecret) {
            clientId = configClientId
            clientSecret = configClientSecret
        }

        switch (action) {
            case 'check_connection': {
                const { data, error } = await supabase
                    .from('google_connections')
                    .select('is_connected, connected_email')
                    .eq('organization_id', organization_id)
                    .eq('user_id', user_id)
                    .in('service_type', ['ecosystem', 'google_business', 'google_calendar'])
                    .eq('is_connected', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (error || !data) {
                    return new Response(JSON.stringify({ connected: false }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                return new Response(JSON.stringify({ connected: data.is_connected, email: data.connected_email }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            case 'get_auth_url': {
                if (!clientId) {
                    return new Response(JSON.stringify({ error: 'Google Client ID não configurado para esta plataforma' }), {
                        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                const scopes = params.scopes || [
                    'https://www.googleapis.com/auth/business.manage',
                    'https://www.googleapis.com/auth/gmail.readonly',
                    'https://www.googleapis.com/auth/gmail.send',
                    'https://www.googleapis.com/auth/gmail.modify',
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/calendar.events',
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/spreadsheets',
                ]
                const redirectUri = params.redirect_uri

                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                    `client_id=${encodeURIComponent(clientId)}` +
                    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                    `&response_type=code` +
                    `&scope=${encodeURIComponent(scopes.join(' '))}` +
                    `&access_type=offline` +
                    `&prompt=consent` +
                    `&state=${encodeURIComponent(organization_id)}`

                return new Response(JSON.stringify({ auth_url: authUrl }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            case 'exchange_code': {
                if (!clientId || !clientSecret) {
                    return new Response(JSON.stringify({ error: 'Credenciais Google não configuradas' }), {
                        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code: params.code,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: params.redirect_uri,
                        grant_type: 'authorization_code',
                    }),
                })

                const tokenData = await tokenRes.json()

                if (tokenData.error) {
                    return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
                        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // Get user email
                let email = ''
                try {
                    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: { Authorization: `Bearer ${tokenData.access_token}` }
                    })
                    const userInfo = await userInfoRes.json()
                    email = userInfo.email || ''
                } catch { /* ignore */ }

                // Upsert connection for 'ecosystem'
                await supabase
                    .from('google_connections')
                    .upsert({
                        organization_id,
                        user_id,
                        service_type: 'ecosystem',
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
                        connected_email: email,
                        connected_account_name: email,
                        is_connected: true,
                    }, { onConflict: 'organization_id,user_id,service_type' })

                return new Response(JSON.stringify({ success: true, email }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }



            case 'disconnect': {
                await supabase
                    .from('google_connections')
                    .update({ is_connected: false, access_token: null, refresh_token: null })
                    .eq('organization_id', organization_id)
                    .eq('user_id', user_id)
                    .in('service_type', ['ecosystem', 'google_business', 'google_calendar'])

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            default:
                return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
                    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
        }
    } catch (err: any) {
        console.error('google-api error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
