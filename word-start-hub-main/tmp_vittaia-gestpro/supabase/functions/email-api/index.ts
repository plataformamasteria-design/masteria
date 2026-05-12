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
      case 'list_accounts': {
        const { data: connections } = await supabase
          .from('google_connections')
          .select('*')
          .eq('organization_id', organization_id)
          .eq('service_type', 'gmail')

        const accounts = (connections || [])
          .filter((c: any) => c.is_connected)
          .map((c: any) => ({
            id: c.id,
            provider: 'gmail',
            email: c.connected_email || '',
            name: c.connected_account_name || c.connected_email || '',
            connected: true,
          }))

        return new Response(JSON.stringify({ accounts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'check_connection': {
        const { data: conn } = await supabase
          .from('google_connections')
          .select('*')
          .eq('organization_id', organization_id)
          .eq('service_type', 'gmail')
          .single()

        return new Response(JSON.stringify({
          connected: conn?.is_connected || false,
          email: conn?.connected_email || '',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'get_auth_url': {
        if (!clientId) {
          return new Response(JSON.stringify({ error: 'Google Client ID não configurado para esta organização' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const scopes = params.scopes || [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
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

        // Get user email
        let email = ''
        try {
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
          })
          const userInfo = await userInfoRes.json()
          email = userInfo.email || ''
        } catch { /* ignore */ }

        // Upsert connection
        await supabase
          .from('google_connections')
          .upsert({
            organization_id,
            service_type: 'gmail',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
            connected_email: email,
            connected_account_name: email,
            is_connected: true,
          }, { onConflict: 'organization_id,service_type' })

        return new Response(JSON.stringify({ success: true, email }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'disconnect': {
        await supabase
          .from('google_connections')
          .update({ is_connected: false, access_token: null, refresh_token: null })
          .eq('organization_id', organization_id)
          .eq('service_type', 'gmail')

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'list_emails':
      case 'get_email':
      case 'send_email':
      case 'reply_email': {
        const token = await getValidToken(supabase, organization_id, 'gmail', clientId, clientSecret)
        if (!token) {
          return new Response(JSON.stringify({ error: 'Não conectado ao Gmail' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const headers = { Authorization: `Bearer ${token}` };

        if (action === 'list_emails') {
          const folder = params.folder === 'sent' ? 'SENT' : params.folder === 'trash' ? 'TRASH' : params.folder === 'starred' ? 'STARRED' : 'INBOX';
          const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:${folder}`, { headers });
          const listData = await listRes.json();

          if (!listData.messages) {
            return new Response(JSON.stringify({ emails: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          // Fetch details for each message
          const emails = await Promise.all(listData.messages.map(async (m: any) => {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers });
            const msg = await msgRes.json();

            const headersObj = msg.payload?.headers?.reduce((acc: any, h: any) => {
              acc[h.name.toLowerCase()] = h.value;
              return acc;
            }, {}) || {};

            // Get body part
            let bodyData = '';
            if (msg.payload?.parts) {
              const htmlPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/html');
              const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
              bodyData = htmlPart?.body?.data || textPart?.body?.data || '';
            } else if (msg.payload?.body?.data) {
              bodyData = msg.payload.body.data;
            }

            const decodedBody = bodyData ? atob(bodyData.replace(/-/g, '+').replace(/_/g, '/')) : '';

            return {
              id: msg.id,
              from: headersObj.from || '',
              to: headersObj.to || '',
              subject: headersObj.subject || '(Sem assunto)',
              date: headersObj.date || '',
              body: decodedBody,
              read: !msg.labelIds?.includes('UNREAD'),
              starred: msg.labelIds?.includes('STARRED'),
              folder: params.folder,
            };
          }));

          return new Response(JSON.stringify({ emails }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        else if (action === 'send_email') {
          const boundary = "vitta_mail_boundary_" + Date.now().toString(16);
          const message = [
            `To: ${params.to}`,
            `Subject: ${params.subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            ``,
            `--${boundary}`,
            `Content-Type: text/plain; charset="UTF-8"`,
            ``,
            params.body,
            ``,
            `--${boundary}`,
            `Content-Type: text/html; charset="UTF-8"`,
            ``,
            `<html><body>${params.body.replace(/\n/g, '<br/>')}</body></html>`,
            ``,
            `--${boundary}--`
          ].join('\r\n');

          const encodedMessage = btoa(unescape(encodeURIComponent(message)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          const sendRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: encodedMessage })
          });

          const sendData = await sendRes.json();
          if (sendData.error) throw new Error(sendData.error.message);

          return new Response(JSON.stringify({ success: true, messageId: sendData.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: `Not implemented action: ${action}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (err) {
    console.error('email-api error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getValidToken(supabase: any, orgId: string, serviceType: string, clientId: string, clientSecret: string): Promise<string | null> {
  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')
    .eq('organization_id', orgId)
    .in('service_type', ['ecosystem', serviceType]);

  const conn = connections?.find((c: any) => c.service_type === 'ecosystem') || connections?.find((c: any) => c.service_type === serviceType);

  if (!conn?.is_connected || !conn?.access_token) return null;

  if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
    if (!conn.refresh_token) return null

    // Get credentials for refresh
    let currentClientId = clientId
    let currentClientSecret = clientSecret

    if (!currentClientId || !currentClientSecret) {
      const { data: globalConfigData } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['google_ads_client_id', 'google_ads_client_secret'])

      const configClientId = globalConfigData?.find(c => c.key === 'google_ads_client_id')?.value
      const configClientSecret = globalConfigData?.find(c => c.key === 'google_ads_client_secret')?.value

      if (configClientId && configClientSecret) {
        currentClientId = configClientId
        currentClientSecret = configClientSecret
      }
    }

    if (!currentClientId || !currentClientSecret) return null

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: currentClientId,
        client_secret: currentClientSecret,
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
