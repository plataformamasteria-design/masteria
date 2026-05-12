import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');

    const stateParamRaw = url.searchParams.get('state');
    if (stateParamRaw && !action) {
      try {
        const stateData = JSON.parse(atob(stateParamRaw));
        if (stateData.source === 'ig') action = 'ig-callback';
        else if (stateData.source === 'fb') action = 'callback';
      } catch (e) {
        // ignore
      }
    }

    // ===================== GENERATE AUTH URL =====================
    if (action === 'auth-url') {
      const body = await req.json();
      const { organization_id } = body;

      if (!organization_id) {
        return new Response(JSON.stringify({ error: 'organization_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch Meta App ID from global_config
      const { data: globalConfigData, error: globalConfigError } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['meta_app_id']);

      if (globalConfigError || !globalConfigData) {
        return new Response(JSON.stringify({ error: 'Global config not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const metaAppId = globalConfigData.find(c => c.key === 'meta_app_id')?.value;
      if (!metaAppId) {
        return new Response(JSON.stringify({ error: 'Meta App ID not configured. Go to Developer settings.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const origin = req.headers.get('origin') || url.origin;
      const callbackUrl = `${supabaseUrl}/functions/v1/meta-oauth-callback`; // Removing query param to avoid stripping issues
      const state = JSON.stringify({ organization_id, source: 'fb', origin });
      const stateEncoded = btoa(state);

      const scopes = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_messaging',
        'instagram_basic',
        'instagram_manage_messages',
        'instagram_manage_comments',
        'business_management'
      ].join(',');

      const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${stateEncoded}&scope=${scopes}&response_type=code`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===================== OAUTH CALLBACK =====================
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');
      const errorParam = url.searchParams.get('error');

      if (errorParam) {
        console.error('[meta-oauth] OAuth error:', errorParam);
        // Redirect to frontend with error
        return new Response(null, {
          status: 302,
          headers: { Location: `${url.origin}/organizations?meta_error=${errorParam}` },
        });
      }

      if (!code || !stateParam) {
        return new Response('Missing code or state', { status: 400, headers: corsHeaders });
      }

      let stateData: { organization_id: string };
      try {
        stateData = JSON.parse(atob(stateParam));
      } catch {
        return new Response('Invalid state', { status: 400, headers: corsHeaders });
      }

      const { organization_id } = stateData;

      // Fetch Meta App credentials from global_config
      const { data: globalConfigData } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['meta_app_id', 'meta_app_secret']);

      const metaAppId = globalConfigData?.find(c => c.key === 'meta_app_id')?.value;
      const metaAppSecret = globalConfigData?.find(c => c.key === 'meta_app_secret')?.value;

      if (!metaAppId || !metaAppSecret) {
        return new Response('Meta App credentials not configured', { status: 400, headers: corsHeaders });
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

      // Exchange code for short-lived token
      console.log('[meta-oauth] Exchanging code for token...');
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(callbackUrl)}&client_secret=${metaAppSecret}&code=${code}`
      );

      const tokenData = await tokenResponse.json();
      if (tokenData.error) {
        console.error('[meta-oauth] Token exchange error:', tokenData.error);
        return redirectWithError(url.origin, tokenData.error.message);
      }

      const shortLivedToken = tokenData.access_token;

      // Exchange for long-lived token
      console.log('[meta-oauth] Getting long-lived token...');
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${shortLivedToken}`
      );

      const longLivedData = await longLivedResponse.json();
      if (longLivedData.error) {
        console.error('[meta-oauth] Long-lived token error:', longLivedData.error);
        return redirectWithError(url.origin, longLivedData.error.message);
      }

      const longLivedToken = longLivedData.access_token;
      const expiresIn = longLivedData.expires_in || 5184000; // ~60 days default

      // Get pages the user manages
      console.log('[meta-oauth] Fetching user pages...');
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token,instagram_business_account`
      );

      const pagesData = await pagesResponse.json();
      if (pagesData.error) {
        console.error('[meta-oauth] Pages fetch error:', pagesData.error);
        return redirectWithError(url.origin, pagesData.error.message);
      }

      const pages = pagesData.data || [];
      if (pages.length === 0) {
        return redirectWithError(url.origin, 'No Facebook Pages found. You need at least one Page.');
      }

      console.log(`[meta-oauth] Found ${pages.length} pages`);

      // Store each page connection
      for (const page of pages) {
        let igAccountId: string | null = null;
        let igUsername: string | null = null;

        // Get Instagram business account details if available
        if (page.instagram_business_account?.id) {
          igAccountId = page.instagram_business_account.id;
          try {
            const igResponse = await fetch(
              `https://graph.facebook.com/v21.0/${igAccountId}?fields=username&access_token=${page.access_token}`
            );
            const igData = await igResponse.json();
            igUsername = igData.username || null;
          } catch (e) {
            console.error('[meta-oauth] Error fetching IG username:', e);
          }
        }

        // Upsert connection
        const { error: upsertError } = await supabase
          .from('meta_connections')
          .upsert({
            organization_id,
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
            instagram_business_account_id: igAccountId,
            instagram_username: igUsername,
            token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            is_active: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'organization_id,page_id',
          });

        if (upsertError) {
          console.error('[meta-oauth] Error saving connection:', upsertError);
        } else {
          console.log(`[meta-oauth] Saved page: ${page.name} (${page.id})`);
        }

        // Subscribe to webhooks for this page
        try {
          await fetch(
            `https://graph.facebook.com/v21.0/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_reads,message_deliveries&access_token=${page.access_token}`,
            { method: 'POST' }
          );
          console.log(`[meta-oauth] Subscribed webhooks for page: ${page.name}`);
        } catch (e) {
          console.error('[meta-oauth] Error subscribing webhooks:', e);
        }
      }

      // Redirect to frontend with success
      const frontendUrl = origin || url.origin;
      const redirectUrl = new URL('/organizations', frontendUrl);
      redirectUrl.searchParams.set('meta_connected', 'true');
      redirectUrl.searchParams.set('pages_count', String(pages.length));

      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl.toString() },
      });
    }

    // ===================== DISCONNECT =====================
    if (action === 'disconnect') {
      const body = await req.json();
      const { organization_id, connection_id } = body;

      if (!organization_id || !connection_id) {
        return new Response(JSON.stringify({ error: 'organization_id and connection_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('meta_connections')
        .delete()
        .eq('id', connection_id)
        .eq('organization_id', organization_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===================== GENERATE IG AUTH URL =====================
    if (action === 'ig-auth-url') {
      const body = await req.json();
      const { organization_id } = body;

      if (!organization_id) {
        return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: globalConfigData, error: globalConfigError } = await supabase.from('global_config').select('key, value').in('key', ['instagram_app_id']);
      if (globalConfigError || !globalConfigData) {
        return new Response(JSON.stringify({ error: 'Global config not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const igAppId = globalConfigData.find((c: any) => c.key === 'instagram_app_id')?.value;
      if (!igAppId) {
        return new Response(JSON.stringify({ error: 'Instagram App ID not configured. Go to Developer settings.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const origin = req.headers.get('origin') || url.origin;
      const callbackUrl = `${supabaseUrl}/functions/v1/meta-oauth-callback`; // Removing query param to avoid stripping issues
      const state = JSON.stringify({ organization_id, source: 'ig', origin });
      const stateEncoded = btoa(state);

      const scopes = [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
        'instagram_business_content_publish',
        'instagram_business_manage_insights'
      ].join(',');

      const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${igAppId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${scopes}&state=${stateEncoded}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===================== IG OAUTH CALLBACK =====================
    if (action === 'ig-callback') {
      const code = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');
      const errorParam = url.searchParams.get('error');

      if (errorParam) {
        console.error('[meta-oauth-ig] OAuth error:', errorParam);
        return redirectWithError(url.origin, errorParam);
      }

      if (!code || !stateParam) {
        return new Response('Missing code or state', { status: 400, headers: corsHeaders });
      }

      let stateData: { organization_id: string; origin?: string };
      try {
        stateData = JSON.parse(atob(stateParam));
      } catch {
        return new Response('Invalid state', { status: 400, headers: corsHeaders });
      }

      const { organization_id, origin } = stateData;

      const { data: globalConfigData } = await supabase.from('global_config').select('key, value').in('key', ['instagram_app_id', 'instagram_app_secret']);
      const igAppId = globalConfigData?.find((c: any) => c.key === 'instagram_app_id')?.value;
      const igAppSecret = globalConfigData?.find((c: any) => c.key === 'instagram_app_secret')?.value;

      if (!igAppId || !igAppSecret) {
        return redirectWithError(url.origin, 'Instagram App credentials not configured');
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/meta-oauth-callback`;

      // Form body for exact urlencoded payload
      const formData = new URLSearchParams();
      formData.append('client_id', igAppId);
      formData.append('client_secret', igAppSecret);
      formData.append('grant_type', 'authorization_code');
      formData.append('redirect_uri', callbackUrl);
      formData.append('code', code);

      console.log('[meta-oauth-ig] Exchanging code for short-lived token...');
      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      const tokenData = await tokenResponse.json();
      if (tokenData.error_message || !tokenData.access_token) {
        console.error('[meta-oauth-ig] Token exchange error:', tokenData);
        return redirectWithError(url.origin, tokenData.error_message || 'Failed code exchange');
      }

      const shortLivedToken = tokenData.access_token;
      const igUserId = tokenData.user_id;

      console.log('[meta-oauth-ig] Getting long-lived token...');
      const longLivedResponse = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${igAppSecret}&access_token=${shortLivedToken}`
      );

      const longLivedData = await longLivedResponse.json();
      if (longLivedData.error) {
        console.error('[meta-oauth-ig] Long-lived token error:', longLivedData.error);
        return redirectWithError(url.origin, longLivedData.error.message);
      }

      const longLivedToken = longLivedData.access_token;
      const expiresIn = longLivedData.expires_in || 5184000;

      // Get IG profile
      console.log('[meta-oauth-ig] Fetching user profile...');
      const profileResponse = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=id,username,name&access_token=${longLivedToken}`
      );
      const profileData = await profileResponse.json();

      const igAccountId = profileData.id || igUserId;
      const igName = profileData.name || profileData.username || `IG Profile ${igAccountId}`;
      const igUsername = profileData.username || null;

      // Fake page ID so our backend architecture keeps working unchanged 
      const fakePageId = `ig_only_${igAccountId}`;

      console.log(`[meta-oauth-ig] Saving isolated IG Account: @${igUsername} (${igAccountId})`);

      const { error: upsertError } = await supabase
        .from('meta_connections')
        .upsert({
          organization_id,
          page_id: fakePageId,
          page_name: `[IG] ${igName}`,
          page_access_token: longLivedToken,
          instagram_business_account_id: igAccountId,
          instagram_username: igUsername,
          token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,page_id',
        });

      if (upsertError) {
        console.error('[meta-oauth-ig] Error saving IG connection:', upsertError);
      }

      // Subscribe to webhooks for this IG account
      try {
        const subResponse = await fetch(
          `https://graph.instagram.com/v21.0/${igAccountId}/subscribed_apps?subscribed_fields=messages,message_reactions,messaging_postbacks,comments&access_token=${longLivedToken}`,
          { method: 'POST' }
        );
        const subData = await subResponse.json();
        console.log(`[meta-oauth-ig] Subscribed webhooks for IG Account: ${igName}`, subData);
      } catch (e) {
        console.error('[meta-oauth-ig] Error subscribing webhooks:', e);
      }

      const frontendUrl = origin || url.origin;
      const redirectUrl = new URL('/organizations', frontendUrl);
      redirectUrl.searchParams.set('meta_success', 'true');
      redirectUrl.searchParams.set('ig_direct', 'true');

      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl.toString() },
      });
    }

    // ===================== LIST CONNECTIONS =====================
    if (action === 'list') {
      const body = await req.json();
      const { organization_id } = body;

      const { data, error } = await supabase
        .from('meta_connections')
        .select('id, page_id, page_name, instagram_business_account_id, instagram_username, is_active, connected_at, token_expires_at')
        .eq('organization_id', organization_id)
        .eq('is_active', true);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ connections: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[meta-oauth] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function redirectWithError(origin: string, message: string) {
  const redirectUrl = new URL('/organizations', origin);
  redirectUrl.searchParams.set('meta_error', message);
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
}
