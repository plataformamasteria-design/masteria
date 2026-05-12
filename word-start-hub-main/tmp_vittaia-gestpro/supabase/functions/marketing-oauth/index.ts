import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    // ===================== META AUTH URL =====================
    if (action === 'meta-auth-url') {
      const body = await req.json()
      const { organization_id } = body

      if (!organization_id) {
        return new Response(JSON.stringify({ error: 'organization_id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: globalConfigData, error: globalConfigError } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['meta_app_id'])

      const metaAppId = globalConfigData?.find(c => c.key === 'meta_app_id')?.value
      if (!metaAppId || globalConfigError) {
        return new Response(JSON.stringify({ error: 'Meta App ID não configurado globalmente.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/marketing-oauth?action=meta-callback`
      const state = btoa(JSON.stringify({ organization_id }))

      const scopes = [
        'pages_show_list',
        'pages_read_engagement',
        'instagram_basic',
        'ads_read',
        'read_insights',
      ].join(',')

      const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=${scopes}&response_type=code`

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ===================== META CALLBACK =====================
    if (action === 'meta-callback') {
      const code = url.searchParams.get('code')
      const stateParam = url.searchParams.get('state')
      const errorParam = url.searchParams.get('error')

      // Determine frontend URL for redirect
      const frontendUrl = Deno.env.get('SITE_URL') || 'https://word-start-hub.lovable.app'

      if (errorParam) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?meta_error=${encodeURIComponent(errorParam)}` },
        })
      }

      if (!code || !stateParam) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?meta_error=missing_code` },
        })
      }

      let stateData: { organization_id: string }
      try {
        stateData = JSON.parse(atob(stateParam))
      } catch {
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?meta_error=invalid_state` },
        })
      }

      const { organization_id } = stateData

      const { data: globalConfigData } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['meta_app_id', 'meta_app_secret'])

      const metaAppId = globalConfigData?.find(c => c.key === 'meta_app_id')?.value
      const metaAppSecret = globalConfigData?.find(c => c.key === 'meta_app_secret')?.value

      if (!metaAppId || !metaAppSecret) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?meta_error=app_not_configured_globally` },
        })
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/marketing-oauth?action=meta-callback`

      // Exchange code for short-lived token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(callbackUrl)}&client_secret=${metaAppSecret}&code=${code}`
      )
      const tokenData = await tokenRes.json()

      if (tokenData.error) {
        console.error('[marketing-oauth] Token error:', tokenData.error)
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?meta_error=${encodeURIComponent(tokenData.error.message)}` },
        })
      }

      // Exchange for long-lived token
      const longLivedRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${tokenData.access_token}`
      )
      const longLivedData = await longLivedRes.json()

      if (longLivedData.error) {
        console.error('[marketing-oauth] Long-lived error:', longLivedData.error)
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?meta_error=${encodeURIComponent(longLivedData.error.message)}` },
        })
      }

      const accessToken = longLivedData.access_token

      // Get user's ad accounts
      let adAccountId = ''
      try {
        const adRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`)
        const adData = await adRes.json()
        if (adData.data?.length > 0) {
          adAccountId = adData.data[0].id.replace('act_', '')
        }
      } catch (e) {
        console.error('[marketing-oauth] Ad accounts error:', e)
      }

      // Get pages + Instagram
      let pageId = ''
      let instagramId = ''
      try {
        const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`)
        const pagesData = await pagesRes.json()
        if (pagesData.data?.length > 0) {
          pageId = pagesData.data[0].id
          if (pagesData.data[0].instagram_business_account?.id) {
            instagramId = pagesData.data[0].instagram_business_account.id
          }
        }
      } catch (e) {
        console.error('[marketing-oauth] Pages error:', e)
      }

      // Save to marketing_credentials
      await supabase.from('marketing_credentials').upsert({
        organization_id,
        platform: 'meta',
        credentials: {
          access_token: accessToken,
          ad_account_id: adAccountId,
          page_id: pageId,
          instagram_id: instagramId,
        },
        status: 'connected',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,platform' })

      return new Response(null, {
        status: 302,
        headers: { Location: `${frontendUrl}/marketing?meta_success=true` },
      })
    }

    // ===================== META MANUAL TOKEN =====================
    // Permite conectar com um token gerado manualmente no Graph API Explorer,
    // contornando a limitação de scopes do OAuth para apps Consumer.
    if (action === 'meta-manual-token') {
      const body = await req.json()
      const { organization_id, access_token: manualToken } = body

      if (!organization_id || !manualToken) {
        return new Response(JSON.stringify({ error: 'organization_id e access_token são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: globalConfigData } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['meta_app_id', 'meta_app_secret'])

      const metaAppId = globalConfigData?.find(c => c.key === 'meta_app_id')?.value
      const metaAppSecret = globalConfigData?.find(c => c.key === 'meta_app_secret')?.value

      if (!metaAppId || !metaAppSecret) {
        return new Response(JSON.stringify({ error: 'Meta App ID e Secret não configurados globalmente.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Validar o token verificando os dados do usuário
      const debugRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${manualToken}`)
      const debugData = await debugRes.json()

      if (debugData.error) {
        return new Response(JSON.stringify({ error: `Token inválido: ${debugData.error.message}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Trocar por long-lived token
      let accessToken = manualToken
      try {
        const longLivedRes = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${manualToken}`
        )
        const longLivedData = await longLivedRes.json()
        if (longLivedData.access_token) {
          accessToken = longLivedData.access_token
        }
      } catch (e) {
        console.error('[marketing-oauth] Long-lived exchange error (continuing with short-lived):', e)
      }

      // Buscar ad accounts
      let adAccountId = ''
      try {
        const adRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`)
        const adData = await adRes.json()
        if (adData.data?.length > 0) {
          adAccountId = adData.data[0].id.replace('act_', '')
        }
      } catch (e) {
        console.error('[marketing-oauth] Ad accounts error:', e)
      }

      // Buscar pages + Instagram
      let pageId = ''
      let instagramId = ''
      try {
        const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`)
        const pagesData = await pagesRes.json()
        if (pagesData.data?.length > 0) {
          pageId = pagesData.data[0].id
          if (pagesData.data[0].instagram_business_account?.id) {
            instagramId = pagesData.data[0].instagram_business_account.id
          }
        }
      } catch (e) {
        console.error('[marketing-oauth] Pages error:', e)
      }

      // Salvar em marketing_credentials
      await supabase.from('marketing_credentials').upsert({
        organization_id,
        platform: 'meta',
        credentials: {
          access_token: accessToken,
          ad_account_id: adAccountId,
          page_id: pageId,
          instagram_id: instagramId,
        },
        status: 'connected',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,platform' })

      return new Response(JSON.stringify({
        success: true,
        message: 'Meta conectado com sucesso via token manual!',
        data: { ad_account_id: adAccountId, page_id: pageId, instagram_id: instagramId },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ===================== GOOGLE AUTH URL =====================
    if (action === 'google-auth-url') {
      const body = await req.json()
      const { organization_id } = body

      if (!organization_id) {
        return new Response(JSON.stringify({ error: 'organization_id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: globalConfigData, error: globalConfigError } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['google_ads_client_id'])

      const clientId = globalConfigData?.find(c => c.key === 'google_ads_client_id')?.value
      if (!clientId || globalConfigError) {
        return new Response(JSON.stringify({ error: 'Google Client ID não configurado globalmente.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/marketing-oauth?action=google-callback`
      const state = btoa(JSON.stringify({ organization_id }))

      const scopes = [
        'https://www.googleapis.com/auth/adwords.readonly',
      ].join(' ')

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}&access_type=offline&prompt=consent`

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ===================== GOOGLE CALLBACK =====================
    if (action === 'google-callback') {
      const code = url.searchParams.get('code')
      const stateParam = url.searchParams.get('state')
      const errorParam = url.searchParams.get('error')

      const frontendUrl = Deno.env.get('SITE_URL') || 'https://word-start-hub.lovable.app'

      if (errorParam) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?google_error=${encodeURIComponent(errorParam)}` },
        })
      }

      if (!code || !stateParam) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?google_error=missing_code` },
        })
      }

      let stateData: { organization_id: string }
      try {
        stateData = JSON.parse(atob(stateParam))
      } catch {
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?google_error=invalid_state` },
        })
      }

      const { organization_id } = stateData

      const { data: globalConfigData } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token'])

      const clientId = globalConfigData?.find(c => c.key === 'google_ads_client_id')?.value
      const clientSecret = globalConfigData?.find(c => c.key === 'google_ads_client_secret')?.value
      const developerToken = globalConfigData?.find(c => c.key === 'google_ads_developer_token')?.value

      if (!clientId || !clientSecret) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?google_error=credentials_not_configured_globally` },
        })
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/marketing-oauth?action=google-callback`

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      })
      const tokenData = await tokenRes.json()

      if (tokenData.error) {
        console.error('[marketing-oauth] Google token error:', tokenData.error)
        return new Response(null, {
          status: 302,
          headers: { Location: `${frontendUrl}/marketing?google_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}` },
        })
      }

      // Try to get customer ID from Google Ads API
      let customerId = ''
      if (developerToken && tokenData.access_token) {
        try {
          const customerRes = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'developer-token': developerToken,
            },
          })
          const customerData = await customerRes.json()
          if (customerData.resourceNames?.length > 0) {
            customerId = customerData.resourceNames[0].replace('customers/', '')
          }
        } catch (e) {
          console.error('[marketing-oauth] Customer list error:', e)
        }
      }

      // Save to marketing_credentials
      await supabase.from('marketing_credentials').upsert({
        organization_id,
        platform: 'google',
        credentials: {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenData.refresh_token,
          developer_token: developerToken || '',
          customer_id: customerId,
        },
        status: 'connected',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,platform' })

      return new Response(null, {
        status: 302,
        headers: { Location: `${frontendUrl}/marketing?google_success=true` },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[marketing-oauth] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
