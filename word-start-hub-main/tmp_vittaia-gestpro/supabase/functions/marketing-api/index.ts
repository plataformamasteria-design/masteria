import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Resolve a date-range preset into { since, until } strings (YYYY-MM-DD)
function resolveDateRange(dateRange?: { start?: string; end?: string; preset?: string }): { since: string; until: string } {
  const now = new Date()
  const yyyy = (d: Date) => d.toISOString().split('T')[0]

  if (dateRange?.preset) {
    switch (dateRange.preset) {
      case 'today': {
        const today = yyyy(now)
        return { since: today, until: today }
      }
      case 'yesterday': {
        const y = new Date(now); y.setDate(y.getDate() - 1)
        const yd = yyyy(y)
        return { since: yd, until: yd }
      }
      case 'this_week': {
        const day = now.getDay()
        const diff = day === 0 ? 6 : day - 1 // Monday start
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - diff)
        return { since: yyyy(weekStart), until: yyyy(now) }
      }
      case 'this_month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        return { since: yyyy(monthStart), until: yyyy(now) }
      }
      case 'last_7d': {
        const d = new Date(now); d.setDate(d.getDate() - 7)
        return { since: yyyy(d), until: yyyy(now) }
      }
      case 'last_30d': {
        const d = new Date(now); d.setDate(d.getDate() - 30)
        return { since: yyyy(d), until: yyyy(now) }
      }
      case 'last_90d': {
        const d = new Date(now); d.setDate(d.getDate() - 90)
        return { since: yyyy(d), until: yyyy(now) }
      }
      case 'all_time': {
        return { since: '__maximum__', until: yyyy(now) }
      }
      default:
        break
    }
  }

  // Custom dates or fallback
  const since = dateRange?.start || yyyy(new Date(now.getTime() - 30 * 86400000))
  const until = dateRange?.end || yyyy(now)
  return { since, until }
}

// Sync campaign totals → lead_diagnostics for the given org
// Sums spend/impressions/clicks/conversions from marketing_campaigns
// and upserts into lead_diagnostics for each campaign month
async function syncDiagnosticsFromCampaigns(
  supabaseAdmin: any,
  organization_id: string
) {
  // 1. Read all campaigns for this org
  const { data: campaigns, error } = await supabaseAdmin
    .from('marketing_campaigns')
    .select('spend, impressions, clicks, conversions, date_start')
    .eq('organization_id', organization_id)

  if (error || !campaigns?.length) {
    console.log('[marketing-api] syncDiagnostics: no campaigns or error:', error?.message)
    return
  }

  // 2. Group by month (YYYY-MM) based on date_start
  const byMonth: Record<string, { spend: number; impressions: number; clicks: number; conversions: number }> = {}
  for (const c of campaigns) {
    // Use date_start from the campaign insight to determine the reporting month;
    // If date_start is missing or very old, use the synced_at month
    const m = (c.date_start || '').substring(0, 7)
    if (!m || m.length < 7) continue
    if (!byMonth[m]) byMonth[m] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
    byMonth[m].spend += c.spend || 0
    byMonth[m].impressions += c.impressions || 0
    byMonth[m].clicks += c.clicks || 0
    byMonth[m].conversions += c.conversions || 0
  }

  // If all campaigns map to the same old month (lifetime data), sum into a single entry
  // and use the current month instead
  const monthKeys = Object.keys(byMonth)
  let targetMonths = byMonth

  if (monthKeys.length === 1 || monthKeys.every(k => k < '2026-01')) {
    // All campaigns have old start dates, sum everything into one total
    const total = { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
    for (const v of Object.values(byMonth)) {
      total.spend += v.spend
      total.impressions += v.impressions
      total.clicks += v.clicks
      total.conversions += v.conversions
    }
    // Use current month as the target
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    targetMonths = { [currentMonth]: total }
  }

  // 3. Upsert lead_diagnostics for each month
  for (const [month, totals] of Object.entries(targetMonths)) {
    // Check if record exists
    const { data: existing } = await supabaseAdmin
      .from('lead_diagnostics')
      .select('id, ad_spend, campaign_impressions, campaign_clicks, campaign_conversions')
      .eq('organization_id', organization_id)
      .eq('reference_month', month)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin
        .from('lead_diagnostics')
        .update({
          ad_spend: Math.round(totals.spend * 100) / 100,
          campaign_impressions: totals.impressions,
          campaign_clicks: totals.clicks,
          campaign_conversions: totals.conversions,
        })
        .eq('id', existing.id)
      console.log(`[marketing-api] Updated lead_diagnostics for ${month}: spend=${totals.spend}`)
    } else {
      await supabaseAdmin
        .from('lead_diagnostics')
        .insert({
          organization_id,
          reference_month: month,
          ad_spend: Math.round(totals.spend * 100) / 100,
          campaign_impressions: totals.impressions,
          campaign_clicks: totals.clicks,
          campaign_conversions: totals.conversions,
          total_leads: 0,
          meetings_scheduled: 0,
          meetings_done: 0,
          no_show: 0,
          contracts_won: 0,
          ltv_total: 0,
          commission_rate: 10,
        })
      console.log(`[marketing-api] Inserted lead_diagnostics for ${month}: spend=${totals.spend}`)
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, organization_id, platform, credentials, date_range } = await req.json()

    // Bypassing auth temporarily for backfill
    if (action === 'backfill_ad_tags') {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      console.log('[marketing-api] Starting backfill for ad tags...');
      const orgId = organization_id;

      let { data: tagData } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', '%anúncio%')
        .maybeSingle();

      let tagId = tagData?.id;

      if (!tagId) {
        const { data: newTag, error: createTagErr } = await supabaseAdmin
          .from('tags')
          .insert({ organization_id: orgId, name: 'Anúncio', color: '#ef4444' })
          .select('id')
          .single();
        if (createTagErr) throw createTagErr;
        tagId = newTag.id;
      }

      const { data: chats, error: chatsErr } = await supabaseAdmin
        .from('chats')
        .select('id, ad_id, campaign_id')
        .eq('organization_id', orgId)
        .or('ad_id.not.is.null,campaign_id.not.is.null');

      if (chatsErr) throw chatsErr;

      let insertedCount = 0;
      const allRowsToInsert: any[] = [];

      // Check which ones already have the tag
      for (const chat of chats || []) {
        const { data: existingTag } = await supabaseAdmin
          .from('chat_tags')
          .select('id')
          .eq('chat_id', chat.id)
          .eq('tag_id', tagId)
          .maybeSingle();

        if (!existingTag) {
          allRowsToInsert.push({
            chat_id: chat.id,
            tag_id: tagId,
            organization_id: orgId
          });
        }
      }

      if (allRowsToInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < allRowsToInsert.length; i += batchSize) {
          await supabaseAdmin.from('chat_tags').insert(allRowsToInsert.slice(i, i + batchSize));
        }
        insertedCount = allRowsToInsert.length;
      }

      return new Response(JSON.stringify({ ok: true, insertedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const authHeader = req.headers.get('Authorization')
    const isServiceRole = authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;

    if (!isServiceRole && !authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let userId = null;

    if (!isServiceRole) {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user } } = await supabaseUser.auth.getUser()
      userId = user?.id

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), { status: 401, headers: corsHeaders })
      }
    }

    // Verify user belongs to org
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (!profile || (profile.organization_id !== organization_id)) {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'super_admin')
      if (!roles?.length) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
      }
    }

    switch (action) {
      case 'save_credentials': {
        const { data, error } = await supabaseAdmin
          .from('marketing_credentials')
          .upsert({
            organization_id,
            platform,
            credentials,
            status: 'connected',
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'organization_id,platform' })
          .select()
          .single()

        if (error) throw error
        return new Response(JSON.stringify({ ok: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'disconnect': {
        const { error } = await supabaseAdmin
          .from('marketing_credentials')
          .update({ status: 'disconnected', credentials: {}, updated_at: new Date().toISOString() })
          .eq('organization_id', organization_id)
          .eq('platform', platform)

        if (error) throw error
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // ====================================================================
      // LIST AD ACCOUNTS — discover all ad accounts (personal + BM)
      // ====================================================================
      case 'list_ad_accounts': {
        const { data: cred } = await supabaseAdmin
          .from('marketing_credentials')
          .select('credentials')
          .eq('organization_id', organization_id)
          .eq('platform', 'meta')
          .eq('status', 'connected')
          .single()

        if (!cred?.credentials) {
          return new Response(JSON.stringify({ ok: false, error: 'Meta não conectado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { access_token } = cred.credentials as any
        const adAccountsRes = await fetch(
          `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,business_name,account_status,currency,timezone_name&limit=50&access_token=${access_token}`
        )
        const adAccountsData = await adAccountsRes.json()

        if (adAccountsData.error) {
          return new Response(JSON.stringify({ ok: false, error: adAccountsData.error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const accounts = (adAccountsData.data || []).map((a: any) => ({
          id: a.id, // "act_XXXX"
          account_id: a.account_id, // "XXXX" (without prefix)
          name: a.name || 'Sem nome',
          business_name: a.business_name || null,
          account_status: a.account_status, // 1=Active, 2=Disabled, 3=Unsettled, ...
          currency: a.currency,
          timezone: a.timezone_name,
        }))

        return new Response(JSON.stringify({ ok: true, accounts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // ====================================================================
      // LIST META PAGES — discover all connected fb pages + ig accounts
      // ====================================================================
      case 'list_meta_pages': {
        const { data: cred } = await supabaseAdmin
          .from('marketing_credentials')
          .select('credentials')
          .eq('organization_id', organization_id)
          .eq('platform', 'meta')
          .eq('status', 'connected')
          .single()

        if (!cred?.credentials) {
          return new Response(JSON.stringify({ ok: false, error: 'Meta não conectado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { access_token } = cred.credentials as any
        const pagesRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username},picture{url}&limit=50&access_token=${access_token}`
        )
        const pagesData = await pagesRes.json()

        if (pagesData.error) {
          return new Response(JSON.stringify({ ok: false, error: pagesData.error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const pages = (pagesData.data || []).map((p: any) => ({
          page_id: p.id,
          page_name: p.name,
          page_picture: p.picture?.data?.url,
          instagram_id: p.instagram_business_account?.id || null,
          instagram_username: p.instagram_business_account?.username || null
        }))

        return new Response(JSON.stringify({ ok: true, pages }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // ====================================================================
      // SYNC META — Campaigns + Profile + Page Insights + IG Insights
      // ====================================================================
      case 'sync_meta': {
        const { data: cred } = await supabaseAdmin
          .from('marketing_credentials')
          .select('credentials')
          .eq('organization_id', organization_id)
          .eq('platform', 'meta')
          .eq('status', 'connected')
          .single()

        if (!cred?.credentials) {
          return new Response(JSON.stringify({ ok: false, error: 'Meta não conectado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { access_token, ad_account_id, page_id, instagram_id } = cred.credentials as any
        const { since: rawStartDate, until: endDate } = resolveDateRange(date_range)
        const isAllTime = rawStartDate === '__maximum__'
        // For IG/FB page insights: clamp to 37 months max (Meta limit)
        const maxBackDate = new Date(); maxBackDate.setMonth(maxBackDate.getMonth() - 37)
        const clampedStart = isAllTime ? maxBackDate.toISOString().split('T')[0] : rawStartDate
        const startDate = clampedStart

        // --- Calculate Previous Period (Historical Delta) ---
        let prevStartDate: string | null = null;
        let prevEndDate: string | null = null;
        if (!isAllTime && startDate && endDate) {
          const s = new Date(startDate);
          const e = new Date(endDate);
          const diffDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
          const pEnd = new Date(s);
          pEnd.setDate(pEnd.getDate() - 1);
          const pStart = new Date(pEnd);
          pStart.setDate(pStart.getDate() - diffDays);

          const yyyy = (d: Date) => d.toISOString().split('T')[0];
          prevEndDate = yyyy(pEnd);
          prevStartDate = yyyy(pStart);

          if (prevStartDate < yyyy(maxBackDate)) prevStartDate = yyyy(maxBackDate);
        }
        // ----------------------------------------------------

        console.log('[marketing-api] sync_meta:', { date_range, rawStartDate, startDate, endDate, isAllTime, ad_account_id: !!ad_account_id })

        // ---- Sync Instagram profile ----
        let igInsightsData: any[] = []
        if (instagram_id && access_token) {
          try {
            const igRes = await fetch(
              `https://graph.facebook.com/v21.0/${instagram_id}?fields=id,name,username,profile_picture_url,followers_count,follows_count,media_count&access_token=${access_token}`
            )
            const igData = await igRes.json()

            if (igData && !igData.error) {
              // Recent media
              const mediaRes = await fetch(
                `https://graph.facebook.com/v21.0/${instagram_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=12&access_token=${access_token}`
              )
              const mediaData = await mediaRes.json()

              const totalEngagement = (mediaData.data || []).reduce((sum: number, p: any) =>
                sum + (p.like_count || 0) + (p.comments_count || 0), 0)
              const engRate = igData.followers_count > 0 && mediaData.data?.length > 0
                ? (totalEngagement / mediaData.data.length / igData.followers_count) * 100 : 0

              // Instagram Insights by period
              try {
                const igInsightsRes = await fetch(
                  `https://graph.facebook.com/v21.0/${instagram_id}/insights?metric=impressions,reach&period=day&since=${startDate}&until=${endDate}&access_token=${access_token}`
                )
                const igInsightsRaw = await igInsightsRes.json()
                if (igInsightsRaw.data && !igInsightsRaw.error) {
                  igInsightsData = igInsightsRaw.data
                } else if (igInsightsRaw.error) {
                  console.error('[marketing-api] IG Insights Error (Core):', igInsightsRaw.error)
                }

                // Attempt to fetch extra metrics separately to avoid failing core metrics
                const igExtraRes = await fetch(
                  `https://graph.facebook.com/v21.0/${instagram_id}/insights?metric=profile_views&period=day&since=${startDate}&until=${endDate}&access_token=${access_token}`
                )
                const igExtraRaw = await igExtraRes.json()
                if (igExtraRaw.data && !igExtraRaw.error) {
                  igInsightsData = igInsightsData.concat(igExtraRaw.data)
                }
              } catch (e) {
                console.error('[marketing-api] IG insights error:', e)
              }

              // Compute totals from insights
              const insightsTotals: Record<string, number> = {}
              const insightsDaily: Record<string, Record<string, number>> = {}
              for (const metric of igInsightsData) {
                let total = 0
                for (const val of (metric.values || [])) {
                  total += val.value || 0
                  const day = val.end_time?.split('T')[0] || ''
                  if (day) {
                    if (!insightsDaily[day]) insightsDaily[day] = {}
                    insightsDaily[day][metric.name] = val.value || 0
                  }
                }
                insightsTotals[metric.name] = total
              }

              await supabaseAdmin.from('marketing_social_profiles').upsert({
                organization_id,
                platform: 'instagram',
                profile_id: igData.id,
                profile_name: igData.username || igData.name,
                profile_picture_url: igData.profile_picture_url,
                followers_count: igData.followers_count || 0,
                follows_count: igData.follows_count || 0,
                posts_count: igData.media_count || 0,
                engagement_rate: Math.round(engRate * 100) / 100,
                recent_posts: mediaData.data || [],
                raw_data: {
                  ...igData,
                  insights_totals: insightsTotals,
                  insights_daily: insightsDaily,
                  insights_period: { since: startDate, until: endDate },
                },
                synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'organization_id,platform' })
            }
          } catch (e) {
            console.error('[marketing-api] Instagram sync error:', e)
          }
        }

        // ---- Sync Facebook page + insights ----
        let fbInsightsData: any[] = []
        if (page_id && access_token) {
          try {
            // Get page token for insights access
            let pageToken = access_token
            try {
              const pageTokenRes = await fetch(
                `https://graph.facebook.com/v21.0/${page_id}?fields=access_token&access_token=${access_token}`
              )
              const pageTokenData = await pageTokenRes.json()
              if (pageTokenData.access_token) pageToken = pageTokenData.access_token
            } catch { }

            const fbRes = await fetch(
              `https://graph.facebook.com/v21.0/${page_id}?fields=id,name,fan_count,picture,followers_count&access_token=${pageToken}`
            )
            const fbData = await fbRes.json()

            if (fbData && !fbData.error) {
              // Page insights by period
              let pageReach = 0
              const pageInsightsDaily: Record<string, Record<string, number>> = {}
              const pageInsightsTotals: Record<string, number> = {}

              try {
                const metricsToFetch = [
                  'page_impressions',
                  'page_impressions_unique',
                  'page_engaged_users',
                  'page_fans',
                  'page_views_total',
                  'page_actions_post_reactions_total',
                ]
                const insightsRes = await fetch(
                  `https://graph.facebook.com/v21.0/${page_id}/insights?metric=${metricsToFetch.join(',')}&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`
                )
                const insightsRaw = await insightsRes.json()
                if (insightsRaw.data && !insightsRaw.error) {
                  fbInsightsData = insightsRaw.data
                  for (const metric of fbInsightsData) {
                    let total = 0
                    for (const val of (metric.values || [])) {
                      const v = typeof val.value === 'object' ? Object.values(val.value).reduce((s: number, n: any) => s + (Number(n) || 0), 0) : (val.value || 0)
                      total += v as number
                      const day = val.end_time?.split('T')[0] || ''
                      if (day) {
                        if (!pageInsightsDaily[day]) pageInsightsDaily[day] = {}
                        pageInsightsDaily[day][metric.name] = v as number
                      }
                    }
                    pageInsightsTotals[metric.name] = total
                    if (metric.name === 'page_impressions_unique') pageReach = total
                  }
                }
              } catch (e) {
                console.error('[marketing-api] FB page insights error:', e)
              }

              // Recent posts
              const postsRes = await fetch(
                `https://graph.facebook.com/v21.0/${page_id}/posts?fields=id,message,created_time,full_picture,shares,likes.summary(true),comments.summary(true)&limit=12&access_token=${pageToken}`
              )
              const postsData = await postsRes.json()

              await supabaseAdmin.from('marketing_social_profiles').upsert({
                organization_id,
                platform: 'facebook',
                profile_id: fbData.id,
                profile_name: fbData.name,
                profile_picture_url: fbData.picture?.data?.url,
                followers_count: fbData.followers_count || 0,
                page_likes: fbData.fan_count || 0,
                page_reach: pageReach,
                recent_posts: postsData.data || [],
                raw_data: {
                  ...fbData,
                  insights_totals: pageInsightsTotals,
                  insights_daily: pageInsightsDaily,
                  insights_period: { since: startDate, until: endDate },
                },
                synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'organization_id,platform' })
            }
          } catch (e) {
            console.error('[marketing-api] Facebook sync error:', e)
          }
        }

        // ---- Sync Meta Ads campaigns ----
        if (ad_account_id && access_token) {
          console.log(`[marketing-api] Syncing campaigns for ad_account_id=${ad_account_id}, isAllTime=${isAllTime}, startDate=${startDate}, endDate=${endDate}`)
          try {
            // Step 1: List all campaigns (basic fields only)
            const adsRes = await fetch(
              `https://graph.facebook.com/v21.0/act_${ad_account_id}/campaigns?fields=id,name,status,objective&limit=100&access_token=${access_token}`
            )
            const adsData = await adsRes.json()

            if (adsData.data && !adsData.error) {
              // Delete old campaigns for this org (we re-insert with current period data)
              await supabaseAdmin
                .from('marketing_campaigns')
                .delete()
                .eq('organization_id', organization_id)
                .eq('platform', 'meta_ads')

              const maxBack = new Date()
              maxBack.setMonth(maxBack.getMonth() - 37)
              const yyyy = (d: Date) => d.toISOString().split('T')[0]

              let dateParam = ''
              if (isAllTime) {
                const today = new Date();
                dateParam = `time_range=${encodeURIComponent(JSON.stringify({ since: yyyy(maxBack), until: yyyy(today) }))}`
              } else {
                const clampedSince = startDate < yyyy(maxBack) ? yyyy(maxBack) : startDate
                dateParam = `time_range=${encodeURIComponent(JSON.stringify({ since: clampedSince, until: endDate }))}`
              }

              let prevStartDate: string | null = null;
              let prevEndDate: string | null = null;
              let prevDateParam = ''
              if (!isAllTime && startDate && endDate) {
                const s = new Date(startDate);
                const e = new Date(endDate);
                const diffDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
                const pEnd = new Date(s);
                pEnd.setDate(pEnd.getDate() - 1);
                const pStart = new Date(pEnd);
                pStart.setDate(pStart.getDate() - diffDays);

                prevEndDate = yyyy(pEnd);
                prevStartDate = yyyy(pStart);

                if (prevStartDate < yyyy(maxBack)) prevStartDate = yyyy(maxBack);
                prevDateParam = `time_range=${encodeURIComponent(JSON.stringify({ since: prevStartDate, until: prevEndDate }))}`
              }

              const commonFields = 'impressions,clicks,spend,actions,ctr,cpc,cpm,cost_per_action_type,reach,frequency'

              // Helper to parse actions (Hoisted outside loop)
              const parseMetaActions = (item: any) => {
                const findAction = (types: string[]) => (item.actions || [])
                  .filter((a: any) => types.includes(a.action_type))
                  .reduce((sum: number, a: any) => sum + parseInt(a.value || '0'), 0);

                const conv = findAction(['lead', 'purchase', 'complete_registration', 'contact', 'submit_application', 'onsite_conversion.messaging_conversation_started_7d']);
                const messages_started = findAction(['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply', 'messages_started']);
                const video_views = findAction(['video_view', 'video_play', 'thruplay']);
                const link_clicks = findAction(['link_click']);
                const outbound_clicks = findAction(['outbound_click']);
                const landing_page_views = findAction(['landing_page_view']);
                const leads = findAction(['lead', 'submit_application', 'complete_registration']);

                const cpl = (item.cost_per_action_type || [])
                  .find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value

                return {
                  ...item,
                  impressions: parseInt(item.impressions || '0'),
                  clicks: parseInt(item.clicks || '0'),
                  spend: parseFloat(item.spend || '0'),
                  ctr: parseFloat(item.ctr || '0'),
                  cpc: parseFloat(item.cpc || '0'),
                  cpm: parseFloat(item.cpm || '0'),
                  reach: parseInt(item.reach || '0'),
                  frequency: parseFloat(item.frequency || '0'),
                  cost_per_lead: cpl ? parseFloat(cpl) : null,
                  conversions: conv,
                  messages_started,
                  video_views,
                  link_clicks,
                  outbound_clicks,
                  landing_page_views,
                  leads,
                }
              }

              const allRowsToInsert: any[] = [];

              // (ACCOUNT-LEVEL INSIGHTS) Fetch total account metrics for accurate global comparison
              try {
                const acctPromises = [
                  fetch(`https://graph.facebook.com/v21.0/act_${ad_account_id}/insights?fields=${commonFields}&${dateParam}&access_token=${access_token}`)
                ];
                if (prevDateParam) {
                  acctPromises.push(fetch(`https://graph.facebook.com/v21.0/act_${ad_account_id}/insights?fields=${commonFields}&${prevDateParam}&access_token=${access_token}`));
                }
                const acctResponses = await Promise.all(acctPromises);
                const acctJson = await Promise.all(acctResponses.map(r => r.json()));

                const acctInsights = acctJson[0]?.data?.[0] || {};
                const prevAcctInsights = acctJson[1]?.data?.[0] || {};

                if (Object.keys(acctInsights).length > 0 || Object.keys(prevAcctInsights).length > 0) {
                  const parsedAcct = parseMetaActions(acctInsights);
                  const parsedPrevAcct = Object.keys(prevAcctInsights).length > 0 ? parseMetaActions(prevAcctInsights) : null;
                  allRowsToInsert.push({
                    organization_id,
                    platform: 'meta_ads',
                    campaign_id: `account_total_${ad_account_id}`,
                    campaign_name: '[META ADS TOTAL]',
                    status: 'ACTIVE',
                    impressions: parsedAcct.impressions,
                    clicks: parsedAcct.clicks,
                    spend: parsedAcct.spend,
                    conversions: parsedAcct.conversions,
                    ctr: parsedAcct.ctr,
                    cpc: parsedAcct.cpc,
                    cpm: parsedAcct.cpm,
                    roas: parsedAcct.spend > 0 ? parsedAcct.conversions / parsedAcct.spend : 0,
                    date_start: startDate,
                    date_end: endDate,
                    raw_data: {
                      is_account_total: true,
                      reach: parsedAcct.reach,
                      frequency: parsedAcct.frequency,
                      cost_per_lead: parsedAcct.cost_per_lead,
                      messages_started: parsedAcct.messages_started,
                      video_views: parsedAcct.video_views,
                      link_clicks: parsedAcct.link_clicks,
                      outbound_clicks: parsedAcct.outbound_clicks,
                      landing_page_views: parsedAcct.landing_page_views,
                      leads: parsedAcct.leads,
                      previous_period: parsedPrevAcct
                    },
                    synced_at: new Date().toISOString()
                  });
                  console.log(`[marketing-api] Injected Account-Level total row. Current Spend: ${parsedAcct.spend}`);
                }
              } catch (e) {
                console.error('[marketing-api] Account insights error:', e);
              }

              const chunkSize = 10;
              for (let i = 0; i < adsData.data.length; i += chunkSize) {
                const chunk = adsData.data.slice(i, i + chunkSize);

                const chunkRows = await Promise.all(chunk.map(async (campaign: any) => {
                  let insights: any = {}
                  let dailyInsights: any[] = []
                  let adsets: any[] = []
                  let ads: any[] = []
                  let prevInsights: any = {}
                  try {
                    const promises = [
                      fetch(`https://graph.facebook.com/v21.0/${campaign.id}/insights?fields=${commonFields}&${dateParam}&access_token=${access_token}`),
                      fetch(`https://graph.facebook.com/v21.0/${campaign.id}/insights?level=adset&fields=adset_name,adset_id,${commonFields}&${dateParam}&limit=100&access_token=${access_token}`),
                      fetch(`https://graph.facebook.com/v21.0/${campaign.id}/insights?level=ad&fields=ad_name,ad_id,adset_name,adset_id,${commonFields}&${dateParam}&limit=200&access_token=${access_token}`),
                      fetch(`https://graph.facebook.com/v21.0/${campaign.id}/insights?fields=spend,clicks&${dateParam}&time_increment=1&limit=500&access_token=${access_token}`)
                    ];
                    if (prevDateParam) {
                      promises.push(fetch(`https://graph.facebook.com/v21.0/${campaign.id}/insights?fields=${commonFields}&${prevDateParam}&access_token=${access_token}`));
                    }

                    const [insightsRes, adsetsRes, adsRes, dailyRes, prevInsightsRes] = await Promise.all(promises);

                    const results = await Promise.all([
                      insightsRes.json(), adsetsRes.json(), adsRes.json(), dailyRes.json(), prevInsightsRes ? prevInsightsRes.json() : Promise.resolve({})
                    ]);

                    const insightsData = results[0];
                    const adsetsData = results[1];
                    const adsData = results[2];
                    const dailyData = results[3];
                    const prevInsightsRaw = results[4];

                    if (prevInsightsRaw?.data && prevInsightsRaw.data.length > 0) {
                      prevInsights = prevInsightsRaw.data[0];
                    }

                    if (insightsData.data && insightsData.data.length > 0) {
                      insights = insightsData.data[0]
                    }
                    if (dailyData.data && dailyData.data.length > 0) {
                      dailyInsights = dailyData.data;
                    } else if (dailyData.error) {
                      insights.daily_error = dailyData.error.message;
                    }
                    // EXPLICIT DUMP: Store exactly what Graph API returned for daily Insights
                    insights.daily_dump_raw = dailyData;

                    adsets = adsetsData.data || [];
                    ads = adsData.data || [];

                    // ---- Fetch Ad Creatives to extract autofill WhatsApp messages ----
                    try {
                      const adIds = ads.map((a: any) => a.ad_id).filter(Boolean)
                      if (adIds.length > 0) {
                        // Batch fetch creatives for all ads in this campaign (max 50 per call)
                        for (let ci = 0; ci < adIds.length; ci += 50) {
                          const batchIds = adIds.slice(ci, ci + 50)
                          const creativesPromises = batchIds.map((adIdStr: string) =>
                            fetch(`https://graph.facebook.com/v21.0/${adIdStr}?fields=creative{body,title,object_story_spec,thumbnail_url,image_url}&access_token=${access_token}`)
                              .then(r => r.json())
                              .catch(() => null)
                          )
                          const creativesResults = await Promise.all(creativesPromises)

                          for (const result of creativesResults) {
                            if (!result || result.error) continue
                            const creativeSpec = result?.creative?.object_story_spec
                            const mediaData = creativeSpec?.video_data || creativeSpec?.link_data
                            const pageWelcome = mediaData?.page_welcome_message
                            const headlineText = result?.creative?.title || mediaData?.name || mediaData?.title || null
                            const bodyText = result?.creative?.body || mediaData?.message || null

                            const matchedAd = ads.find((a: any) => String(a.ad_id) === String(result.id))
                            if (matchedAd) {
                              matchedAd.thumbnail_url = result?.creative?.thumbnail_url || result?.creative?.image_url || null;
                              matchedAd.headline = headlineText;
                              matchedAd.body_text = bodyText;

                              if (pageWelcome) {
                                try {
                                  const welcomeJson = typeof pageWelcome === 'string' ? JSON.parse(pageWelcome) : pageWelcome
                                  const autofillText =
                                    welcomeJson?.text_format?.message?.autofill_message?.content ||
                                    welcomeJson?.message?.autofill_message?.content ||
                                    welcomeJson?.message ||
                                    null

                                  if (autofillText && typeof autofillText === 'string') {
                                    matchedAd.autofill_message = autofillText
                                    console.log(`[marketing-api] Extracted autofill for ad ${result.id}: "${autofillText.substring(0, 60)}..."`)
                                  }
                                } catch (parseErr) {
                                  console.log(`[marketing-api] Could not parse page_welcome_message for ad ${result.id}`)
                                }
                              }
                            }
                          }
                        }
                      }
                    } catch (creativeErr) {
                      console.error(`[marketing-api] Ad creatives fetch error for campaign ${campaign.id}:`, creativeErr)
                    }

                  } catch (insightErr) {
                    console.error(`[marketing-api] Insights error for campaign ${campaign.id}:`, insightErr)
                  }


                  const parsedCampaign = parseMetaActions(insights);
                  const parsedPreviousCampaign = Object.keys(prevInsights).length > 0 ? parseMetaActions(prevInsights) : null;

                  return {
                    organization_id,
                    platform: 'meta_ads',
                    campaign_id: campaign.id,
                    campaign_name: campaign.name,
                    status: campaign.status,
                    impressions: parsedCampaign.impressions,
                    clicks: parsedCampaign.clicks,
                    spend: parsedCampaign.spend,
                    conversions: parsedCampaign.conversions,
                    ctr: parsedCampaign.ctr,
                    cpc: parsedCampaign.cpc,
                    cpm: parsedCampaign.cpm,
                    roas: parsedCampaign.spend > 0 ? parsedCampaign.conversions / parsedCampaign.spend : 0,
                    date_start: insights.date_start || startDate,
                    date_end: insights.date_stop || endDate,
                    raw_data: {
                      ...campaign,
                      reach: parsedCampaign.reach,
                      frequency: parsedCampaign.frequency,
                      cost_per_lead: parsedCampaign.cost_per_lead,
                      messages_started: parsedCampaign.messages_started,
                      video_views: parsedCampaign.video_views,
                      link_clicks: parsedCampaign.link_clicks,
                      outbound_clicks: parsedCampaign.outbound_clicks,
                      landing_page_views: parsedCampaign.landing_page_views,
                      leads: parsedCampaign.leads,
                      actions: insights.actions || [],
                      daily_insights: dailyInsights,
                      daily_dump_raw: insights.daily_dump_raw,
                      adsets: adsets.map(parseMetaActions),
                      ads: ads.map(parseMetaActions),
                      previous_period: parsedPreviousCampaign
                    },
                    synced_at: new Date().toISOString(),
                  };
                }));
                allRowsToInsert.push(...chunkRows);
              }

              // Bulk DB insert 
              if (allRowsToInsert.length > 0) {
                const batchSize = 100;
                for (let i = 0; i < allRowsToInsert.length; i += batchSize) {
                  await supabaseAdmin.from('marketing_campaigns').insert(allRowsToInsert.slice(i, i + batchSize));
                }
              }
            }
          } catch (e) {
            console.error('[marketing-api] Meta Ads sync error:', e)
          }
        } else if (!ad_account_id) {
          // No ad account selected — clear stale campaign data
          console.log('[marketing-api] No ad_account_id, clearing stale campaigns')
          await supabaseAdmin
            .from('marketing_campaigns')
            .delete()
            .eq('organization_id', organization_id)
            .eq('platform', 'meta_ads')
        }

        // ---- Auto-sync lead_diagnostics with campaign totals ----
        try {
          // GUARD: Only auto-sync diagnostics (which creates monthly totals) 
          // if we are explicitly pulling ALL TIME or THIS MONTH.
          // Otherwise, pulling a partial slice (e.g. 'yesterday') would OVERWRITE the entire month's spend with 1 day of spend!
          if (!date_range || date_range.preset === 'this_month' || date_range.preset === 'all_time') {
            await syncDiagnosticsFromCampaigns(supabaseAdmin, organization_id)
            console.log('[marketing-api] Diagnostics auto-sync completed for full month/all_time.')
          } else {
            console.log(`[marketing-api] Skipping Diagnostics auto-sync to protect monthly totals. (preset: ${date_range.preset})`)
          }
        } catch (e) {
          console.error('[marketing-api] Diagnostics auto-sync error:', e)
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // ====================================================================
      // SYNC GOOGLE ADS
      // ====================================================================
      case 'sync_google': {
        const { data: cred } = await supabaseAdmin
          .from('marketing_credentials')
          .select('credentials')
          .eq('organization_id', organization_id)
          .eq('platform', 'google')
          .eq('status', 'connected')
          .single()

        if (!cred?.credentials) {
          return new Response(JSON.stringify({ ok: false, error: 'Google Ads não conectado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { refresh_token, client_id, client_secret, developer_token, customer_id } = cred.credentials as any

        if (!refresh_token || !client_id || !client_secret || !developer_token || !customer_id) {
          return new Response(JSON.stringify({ ok: false, error: 'Credenciais Google incompletas' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Refresh access token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token,
            client_id,
            client_secret,
          }),
        })
        const tokenData = await tokenRes.json()

        if (!tokenData.access_token) {
          return new Response(JSON.stringify({ ok: false, error: 'Falha ao renovar token Google' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { since: startDate, until: endDate } = resolveDateRange(date_range)

        const query = `SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc, metrics.average_cpm FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`

        const gadsRes = await fetch(
          `https://googleads.googleapis.com/v18/customers/${customer_id.replace(/-/g, '')}/googleAds:searchStream`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'developer-token': developer_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          }
        )

        const gadsData = await gadsRes.json()

        if (Array.isArray(gadsData) && gadsData[0]?.results) {
          await supabaseAdmin
            .from('marketing_campaigns')
            .delete()
            .eq('organization_id', organization_id)
            .eq('platform', 'google_ads')

          for (const row of gadsData[0].results) {
            const c = row.campaign
            const m = row.metrics
            const spendBrl = (m.costMicros || 0) / 1000000

            await supabaseAdmin.from('marketing_campaigns').insert({
              organization_id,
              platform: 'google_ads',
              campaign_id: c.id,
              campaign_name: c.name,
              status: c.status,
              impressions: m.impressions || 0,
              clicks: m.clicks || 0,
              spend: spendBrl,
              conversions: Math.round(m.conversions || 0),
              ctr: (m.ctr || 0) * 100,
              cpc: (m.averageCpc || 0) / 1000000,
              cpm: (m.averageCpm || 0) / 1000000,
              date_start: startDate,
              date_end: endDate,
              raw_data: row,
              synced_at: new Date().toISOString(),
            })
          }
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // ====================================================================
      // GET DATA — returns all marketing data (optionally filtered by period)
      // ====================================================================
      case 'get_data': {
        let campaignQuery = supabaseAdmin
          .from('marketing_campaigns')
          .select('*')
          .eq('organization_id', organization_id)
          .order('spend', { ascending: false })

        const [credentialsRes, campaignsRes, profilesRes, diagnosticsRes] = await Promise.all([
          supabaseAdmin.from('marketing_credentials').select('*').eq('organization_id', organization_id),
          campaignQuery,
          supabaseAdmin.from('marketing_social_profiles').select('*').eq('organization_id', organization_id),
          supabaseAdmin.from('lead_diagnostics').select('*').eq('organization_id', organization_id).order('reference_month', { ascending: true }),
        ])

        return new Response(JSON.stringify({
          ok: true,
          credentials: credentialsRes.data || [],
          campaigns: campaignsRes.data || [],
          social_profiles: profilesRes.data || [],
          diagnostics: diagnosticsRes.data || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // ====================================================================
      // SYNC DIAGNOSTICS — auto-fill lead_diagnostics from campaign data
      // ====================================================================
      case 'sync_diagnostics': {
        await syncDiagnosticsFromCampaigns(supabaseAdmin, organization_id)
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // ====================================================================
      // BACKFILL AD TAGS — retroactively apply "Anúncio" tag to old leads
      // ====================================================================
      case 'backfill_ad_tags': {
        console.log('[marketing-api] Starting backfill for ad tags...');
        const orgId = organization_id;

        let { data: tagData } = await supabaseAdmin
          .from('tags')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('name', '%anúncio%')
          .maybeSingle();

        let tagId = tagData?.id;

        if (!tagId) {
          const { data: newTag, error: createTagErr } = await supabaseAdmin
            .from('tags')
            .insert({ organization_id: orgId, name: 'Anúncio', color: '#ef4444' })
            .select('id')
            .single();
          if (createTagErr) throw createTagErr;
          tagId = newTag.id;
        }

        const { data: chats, error: chatsErr } = await supabaseAdmin
          .from('chats')
          .select('id, ad_id, campaign_id')
          .eq('organization_id', orgId)
          .or('ad_id.not.is.null,campaign_id.not.is.null');

        if (chatsErr) throw chatsErr;

        let insertedCount = 0;
        const allRowsToInsert: any[] = [];

        // Check which ones already have the tag
        for (const chat of chats || []) {
          const { data: existingTag } = await supabaseAdmin
            .from('chat_tags')
            .select('id')
            .eq('chat_id', chat.id)
            .eq('tag_id', tagId)
            .maybeSingle();

          if (!existingTag) {
            allRowsToInsert.push({
              chat_id: chat.id,
              tag_id: tagId,
              organization_id: orgId
            });
          }
        }

        if (allRowsToInsert.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < allRowsToInsert.length; i += batchSize) {
            await supabaseAdmin.from('chat_tags').insert(allRowsToInsert.slice(i, i + batchSize));
          }
          insertedCount = allRowsToInsert.length;
        }

        return new Response(JSON.stringify({ ok: true, insertedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
    }
  } catch (error) {
    console.error('Marketing API error:', error)
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

