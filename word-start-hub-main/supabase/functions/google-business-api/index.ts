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

    const { action, organization_id, ...params } = await req.json()

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get global Google credentials from environment variables (fallback)
    let clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    // Or get from global_config
    if (organization_id) {
      const { data: globalConfigData } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['google_ads_client_id', 'google_ads_client_secret'])

      const configClientId = globalConfigData?.find(c => c.key === 'google_ads_client_id')?.value
      const configClientSecret = globalConfigData?.find(c => c.key === 'google_ads_client_secret')?.value

      if (configClientId && configClientSecret) {
        clientId = configClientId
        clientSecret = configClientSecret
      }
    }

    switch (action) {
      case 'check_connection': {
        const { data: conn } = await supabase
          .from('google_connections')
          .select('*')
          .eq('organization_id', organization_id)
          .eq('service_type', 'google_business')
          .single()

        return new Response(JSON.stringify({
          connected: conn?.is_connected || false,
          account_name: conn?.connected_account_name || '',
          email: conn?.connected_email || '',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'get_auth_url': {
        if (!clientId) {
          return new Response(JSON.stringify({ error: 'Google Client ID não configurado para esta organização' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const scopes = params.scopes || ['https://www.googleapis.com/auth/business.manage']
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
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get account info
        let accountName = ''
        let email = ''
        try {
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
          })
          const userInfo = await userInfoRes.json()
          email = userInfo.email || ''
          accountName = userInfo.name || userInfo.email || ''
        } catch { /* ignore */ }

        // Upsert connection
        await supabase
          .from('google_connections')
          .upsert({
            organization_id,
            service_type: 'google_business',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
            connected_email: email,
            connected_account_name: accountName,
            is_connected: true,
          }, { onConflict: 'organization_id,service_type' })

        return new Response(JSON.stringify({ success: true, email, account_name: accountName }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'disconnect': {
        await supabase
          .from('google_connections')
          .update({ is_connected: false, access_token: null, refresh_token: null })
          .eq('organization_id', organization_id)
          .eq('service_type', 'google_business')

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'list_reviews':
      case 'reply_review':
      case 'list_posts':
      case 'create_post':
      case 'get_insights':
      case 'get_business_info': {
        const token = await getValidToken(supabase, organization_id, 'google_business')
        if (!token) {
          return new Response(JSON.stringify({ error: 'Não conectado ao Google Meu Negócio' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        // Buscando a primeira conta e o primeiro local vinculado à conta
        const accountRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers });
        const accountData = await accountRes.json();
        const account = accountData.accounts?.[0];

        if (!account) {
          return new Response(JSON.stringify({ error: 'Nenhuma conta do Google Meu Negócio encontrada.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const locationRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storeCode,regularHours,languageCode,phoneNumbers,categories,storefrontAddress,websiteUri,profile,metadata`, { headers });
        const locationData = await locationRes.json();
        const location = locationData.locations?.[0];

        if (!location) {
          return new Response(JSON.stringify({ error: 'Nenhum local configurado no Google Meu Negócio encontrado para esta conta.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const locationName = location.name; // ex: accounts/123/locations/456

        if (action === 'get_business_info') {
          return new Response(JSON.stringify({
            name: location.title,
            address: location.storefrontAddress?.addressLines?.join(', ') || '',
            phone: location.phoneNumbers?.primaryPhone || '',
            category: location.categories?.primaryCategory?.displayName || '',
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        else if (action === 'get_insights') {
          // Simplified insights fetch
          const locationIdOnly = locationName.split('/')[3];
          const end = new Date();
          const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          const insightsRes = await fetch(`https://businessprofileperformance.googleapis.com/v1/locations/${locationIdOnly}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=BUSINESS_PROFILE_VIEWS,BUSINESS_DIRECTION_REQUESTS,CALL_CLICKS,WEBSITE_CLICKS&dailyRange.start_date.year=${start.getFullYear()}&dailyRange.start_date.month=${start.getMonth() + 1}&dailyRange.start_date.day=${start.getDate()}&dailyRange.end_date.year=${end.getFullYear()}&dailyRange.end_date.month=${end.getMonth() + 1}&dailyRange.end_date.day=${end.getDate()}`, { headers });

          let views = 0, searches = 0, calls = 0;
          try {
            const d = await insightsRes.json();
            d.multiDailyMetricTimeSeries?.forEach((t: any) => {
              const sum = t.timeSeries?.timeDatedValues?.reduce((s: number, v: any) => s + (parseInt(v.value) || 0), 0) || 0;
              if (t.dailyMetric === 'BUSINESS_PROFILE_VIEWS') views = sum;
              if (t.dailyMetric === 'CALL_CLICKS') calls = sum;
              if (t.dailyMetric === 'WEBSITE_CLICKS') searches = sum;
            });
          } catch (e) { }

          return new Response(JSON.stringify({ views, searches, calls, averageRating: 5 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        else if (action === 'list_reviews') {
          const revRes = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`, { headers });
          const revData = await revRes.json();
          const reviews = (revData.reviews || []).map((r: any) => ({
            id: r.reviewId,
            author: r.reviewer?.displayName,
            rating: r.starRating === 'FIVE' ? 5 : r.starRating === 'FOUR' ? 4 : r.starRating === 'THREE' ? 3 : r.starRating === 'TWO' ? 2 : 1,
            date: r.createTime ? new Date(r.createTime).toLocaleDateString() : '',
            comment: r.comment || '',
            reply: r.reviewReply?.comment || ''
          }));
          return new Response(JSON.stringify({ reviews }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        else if (action === 'reply_review') {
          const revId = params.review_id;
          const revRes = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/reviews/${revId}/reply`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ comment: params.reply })
          });
          const revData = await revRes.json();
          return new Response(JSON.stringify({ success: true, data: revData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        else if (action === 'create_post') {
          const postRes = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              languageCode: 'pt-BR',
              summary: params.content,
              state: 'PUBLISHED'
            })
          });
          const postData = await postRes.json();
          if (postData.error) throw new Error(postData.error.message);
          return new Response(JSON.stringify({ success: true, post: postData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: `Not implemented action: ${action}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (err) {
    console.error('google-business-api error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getValidToken(supabase: any, orgId: string, serviceType: string): Promise<string | null> {
  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')
    .eq('organization_id', orgId)
    .in('service_type', ['ecosystem', serviceType]);

  const conn = connections?.find((c: any) => c.service_type === 'ecosystem') || connections?.find((c: any) => c.service_type === serviceType);

  if (!conn?.is_connected || !conn?.access_token) return null;

  // Check if token is expired
  if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
    if (!conn.refresh_token) return null

    // Get credentials for refresh
    let clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    const { data: globalConfigData } = await supabase
      .from('global_config')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret'])

    const configClientId = globalConfigData?.find(c => c.key === 'google_ads_client_id')?.value
    const configClientSecret = globalConfigData?.find(c => c.key === 'google_ads_client_secret')?.value

    if (configClientId && configClientSecret) {
      clientId = configClientId
      clientSecret = configClientSecret
    }

    if (!clientId || !clientSecret) return null

    // Refresh the token
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    })

    const data = await res.json()
    if (data.error) return null

    await supabase
      .from('google_connections')
      .update({
        access_token: data.access_token,
        token_expiry: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
      })
      .eq('organization_id', orgId)
      .eq('service_type', serviceType)

    return data.access_token
  }

  return conn.access_token
}
