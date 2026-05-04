'use server';

import { db } from '@/lib/db';
import { marketingCredentials, marketingCampaigns, marketingAdsets, marketingAds, marketingSocialProfiles, leadDiagnostics } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// ====================================================================
// HELPERS
// ====================================================================

function resolveDateRange(dateRange?: { from?: string; to?: string; preset?: string }): { since: string; until: string; isAllTime: boolean } {
    const now = new Date();
    const yyyy = (d: Date) => d.toISOString().split('T')[0];

    if (dateRange?.preset) {
        switch (dateRange.preset) {
            case 'today': { const t = yyyy(now); return { since: t, until: t, isAllTime: false }; }
            case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); return { since: yyyy(y), until: yyyy(y), isAllTime: false }; }
            case 'this_week': { const day = now.getDay(); const diff = day === 0 ? 6 : day - 1; const ws = new Date(now); ws.setDate(now.getDate() - diff); return { since: yyyy(ws), until: yyyy(now), isAllTime: false }; }
            case 'this_month': { return { since: yyyy(new Date(now.getFullYear(), now.getMonth(), 1)), until: yyyy(now), isAllTime: false }; }
            case 'last_7d': { const d = new Date(now); d.setDate(d.getDate() - 7); return { since: yyyy(d), until: yyyy(now), isAllTime: false }; }
            case 'last_30d': { const d = new Date(now); d.setDate(d.getDate() - 30); return { since: yyyy(d), until: yyyy(now), isAllTime: false }; }
            case 'last_90d': { const d = new Date(now); d.setDate(d.getDate() - 90); return { since: yyyy(d), until: yyyy(now), isAllTime: false }; }
            case 'all_time': return { since: '', until: yyyy(now), isAllTime: true };
        }
    }

    const since = dateRange?.from ? dateRange.from.split('T')[0] : yyyy(new Date(now.getTime() - 30 * 86400000));
    const until = dateRange?.to ? dateRange.to.split('T')[0] : yyyy(now);
    return { since, until, isAllTime: false };
}

// Calcula conversões a partir do campo actions da Graph API
function extractConversions(actions: any[]): number {
    const conversionTypes = ['lead', 'purchase', 'complete_registration', 'contact', 'submit_application', 'onsite_conversion.messaging_conversation_started_7d'];
    return (actions || [])
        .filter((a: any) => conversionTypes.includes(a.action_type))
        .reduce((sum: number, a: any) => sum + parseInt(a.value || '0'), 0);
}

function extractCostPerLead(costPerActionType: any[]): number | null {
    const cpl = (costPerActionType || [])
        .find((a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
    return cpl ? parseFloat(cpl.value) : null;
}

// ====================================================================
// GET DATA — Retorna todos os dados de marketing (credentials, campaigns, adsets, ads, profiles)
// ====================================================================
export async function getMarketingDataAction(companyId: string) {
    try {
        const creds = await db.select().from(marketingCredentials).where(eq(marketingCredentials.companyId, companyId));
        const camps = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.companyId, companyId));
        const adsets = await db.select().from(marketingAdsets).where(eq(marketingAdsets.companyId, companyId));
        const ads = await db.select().from(marketingAds).where(eq(marketingAds.companyId, companyId));
        const profiles = await db.select().from(marketingSocialProfiles).where(eq(marketingSocialProfiles.companyId, companyId));

        return { ok: true, credentials: creds, campaigns: camps, adsets, ads, social_profiles: profiles };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

// ====================================================================
// LIST AD ACCOUNTS
// ====================================================================
export async function listAdAccountsAction(companyId: string) {
    try {
        const creds = await db.select().from(marketingCredentials).where(
            and(eq(marketingCredentials.companyId, companyId), eq(marketingCredentials.platform, 'meta'), eq(marketingCredentials.status, 'connected'))
        );
        if (!creds.length || !creds[0].credentials) return { ok: false, error: 'Meta não conectado' };

        const access_token = (creds[0].credentials as any).access_token;
        const res = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,business_name,account_status,currency,timezone_name&limit=50&access_token=${access_token}`);
        const data = await res.json();

        if (data.error) return { ok: false, error: data.error.message };

        const accounts = (data.data || []).map((a: any) => ({
            id: a.id,
            account_id: a.account_id,
            name: a.name || 'Sem nome',
            business_name: a.business_name || null,
            account_status: a.account_status,
            currency: a.currency,
            timezone: a.timezone_name,
        }));
        return { ok: true, accounts };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

// ====================================================================
// SAVE CREDENTIALS
// ====================================================================
export async function saveCredentialsAction(companyId: string, platform: string, credentialsObj: any) {
    try {
        const existing = await db.select().from(marketingCredentials).where(
            and(eq(marketingCredentials.companyId, companyId), eq(marketingCredentials.platform, platform))
        );

        if (existing.length > 0) {
            await db.update(marketingCredentials)
                .set({ credentials: credentialsObj, status: 'connected', updatedAt: new Date() })
                .where(eq(marketingCredentials.id, existing[0].id));
        } else {
            await db.insert(marketingCredentials).values({ companyId, platform, status: 'connected', credentials: credentialsObj });
        }
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

// ====================================================================
// SYNC META — Campanhas + AdSets + Ads + IG/FB profiles + lead_diagnostics
// ====================================================================
export async function syncMetaAction(companyId: string, dateRange?: { from?: string; to?: string; preset?: string }) {
    try {
        const creds = await db.select().from(marketingCredentials).where(
            and(eq(marketingCredentials.companyId, companyId), eq(marketingCredentials.platform, 'meta'), eq(marketingCredentials.status, 'connected'))
        );
        if (!creds.length || !creds[0].credentials) return { ok: false, error: 'Meta não conectado' };

        const { access_token, ad_account_id, page_id, instagram_id } = creds[0].credentials as any;
        const { since: startDate, until: endDate, isAllTime } = resolveDateRange(dateRange);

        // Meta limits time_range to 37 months max
        const maxBack = new Date(); maxBack.setMonth(maxBack.getMonth() - 37);
        const clampedStart = isAllTime ? maxBack.toISOString().split('T')[0] : (startDate < maxBack.toISOString().split('T')[0] ? maxBack.toISOString().split('T')[0] : startDate);

        // ---- Sync Instagram Profile ----
        if (instagram_id && access_token) {
            try {
                const igRes = await fetch(`https://graph.facebook.com/v21.0/${instagram_id}?fields=id,name,username,profile_picture_url,followers_count,follows_count,media_count&access_token=${access_token}`);
                const igData = await igRes.json();

                if (igData && !igData.error) {
                    const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${instagram_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=12&access_token=${access_token}`);
                    const mediaData = await mediaRes.json();
                    const totalEng = (mediaData.data || []).reduce((s: number, p: any) => s + (p.like_count || 0) + (p.comments_count || 0), 0);
                    const engRate = igData.followers_count ? (totalEng / Math.max(1, mediaData.data?.length || 1) / igData.followers_count) * 100 : 0;

                    // IG Insights
                    let insightsTotals: Record<string, number> = {};
                    let insightsDaily: Record<string, Record<string, number>> = {};
                    try {
                        const igInsightsRes = await fetch(`https://graph.facebook.com/v21.0/${instagram_id}/insights?metric=impressions,reach,profile_views,accounts_engaged&period=day&since=${clampedStart}&until=${endDate}&access_token=${access_token}`);
                        const igInsightsRaw = await igInsightsRes.json();
                        if (igInsightsRaw.data && !igInsightsRaw.error) {
                            for (const metric of igInsightsRaw.data) {
                                let total = 0;
                                for (const val of (metric.values || [])) {
                                    total += val.value || 0;
                                    const day = val.end_time?.split('T')[0] || '';
                                    if (day) { if (!insightsDaily[day]) insightsDaily[day] = {}; insightsDaily[day][metric.name] = val.value || 0; }
                                }
                                insightsTotals[metric.name] = total;
                            }
                        }
                    } catch (e) { console.error('[Sync Meta] IG insights error:', e); }

                    const existingProfile = await db.select().from(marketingSocialProfiles).where(
                        and(eq(marketingSocialProfiles.companyId, companyId), eq(marketingSocialProfiles.platform, 'instagram'), eq(marketingSocialProfiles.profileId, igData.id))
                    );
                    const profileData = {
                        profileName: igData.username || igData.name,
                        profilePictureUrl: igData.profile_picture_url,
                        followersCount: igData.followers_count || 0,
                        followsCount: igData.follows_count || 0,
                        postsCount: igData.media_count || 0,
                        engagementRate: String(Math.round(engRate * 100) / 100),
                        recentPosts: mediaData.data || [],
                        rawData: { ...igData, insights_totals: insightsTotals, insights_daily: insightsDaily, insights_period: { since: clampedStart, until: endDate } },
                        updatedAt: new Date()
                    };
                    if (existingProfile.length) {
                        await db.update(marketingSocialProfiles).set(profileData).where(eq(marketingSocialProfiles.id, existingProfile[0].id));
                    } else {
                        await db.insert(marketingSocialProfiles).values({ companyId, platform: 'instagram', profileId: igData.id, ...profileData });
                    }
                }
            } catch (e) { console.error('[Sync Meta] Instagram Error:', e); }
        }

        // ---- Sync Facebook Page + Insights ----
        if (page_id && access_token) {
            try {
                let pageToken = access_token;
                try {
                    const ptRes = await fetch(`https://graph.facebook.com/v21.0/${page_id}?fields=access_token&access_token=${access_token}`);
                    const ptData = await ptRes.json();
                    if (ptData.access_token) pageToken = ptData.access_token;
                } catch { }

                const fbRes = await fetch(`https://graph.facebook.com/v21.0/${page_id}?fields=id,name,fan_count,picture,followers_count&access_token=${pageToken}`);
                const fbData = await fbRes.json();

                if (fbData && !fbData.error) {
                    let pageReach = 0;
                    const pageInsightsTotals: Record<string, number> = {};
                    const pageInsightsDaily: Record<string, Record<string, number>> = {};

                    try {
                        const metrics = ['page_impressions', 'page_impressions_unique', 'page_engaged_users', 'page_fans', 'page_views_total', 'page_actions_post_reactions_total'];
                        const insightsRes = await fetch(`https://graph.facebook.com/v21.0/${page_id}/insights?metric=${metrics.join(',')}&period=day&since=${clampedStart}&until=${endDate}&access_token=${pageToken}`);
                        const insightsRaw = await insightsRes.json();
                        if (insightsRaw.data && !insightsRaw.error) {
                            for (const metric of insightsRaw.data) {
                                let total = 0;
                                for (const val of (metric.values || [])) {
                                    const v = typeof val.value === 'object' ? Object.values(val.value).reduce((s: number, n: any) => s + (Number(n) || 0), 0) : (val.value || 0);
                                    total += v as number;
                                    const day = val.end_time?.split('T')[0] || '';
                                    if (day) { if (!pageInsightsDaily[day]) pageInsightsDaily[day] = {}; pageInsightsDaily[day][metric.name] = v as number; }
                                }
                                pageInsightsTotals[metric.name] = total;
                                if (metric.name === 'page_impressions_unique') pageReach = total;
                            }
                        }
                    } catch (e) { console.error('[Sync Meta] FB insights error:', e); }

                    const postsRes = await fetch(`https://graph.facebook.com/v21.0/${page_id}/posts?fields=id,message,created_time,full_picture,shares,likes.summary(true),comments.summary(true)&limit=12&access_token=${pageToken}`);
                    const postsData = await postsRes.json();

                    const existingFb = await db.select().from(marketingSocialProfiles).where(
                        and(eq(marketingSocialProfiles.companyId, companyId), eq(marketingSocialProfiles.platform, 'facebook'), eq(marketingSocialProfiles.profileId, fbData.id))
                    );
                    const fbProfileData = {
                        profileName: fbData.name,
                        profilePictureUrl: fbData.picture?.data?.url,
                        followersCount: fbData.followers_count || 0,
                        pageLikes: fbData.fan_count || 0,
                        pageReach: pageReach,
                        recentPosts: postsData.data || [],
                        rawData: { ...fbData, insights_totals: pageInsightsTotals, insights_daily: pageInsightsDaily, insights_period: { since: clampedStart, until: endDate } },
                        updatedAt: new Date()
                    };
                    if (existingFb.length) {
                        await db.update(marketingSocialProfiles).set(fbProfileData).where(eq(marketingSocialProfiles.id, existingFb[0].id));
                    } else {
                        await db.insert(marketingSocialProfiles).values({ companyId, platform: 'facebook', profileId: fbData.id, ...fbProfileData });
                    }
                }
            } catch (e) { console.error('[Sync Meta] Facebook Error:', e); }
        }

        // ---- Sync Meta Ads: Campaigns → AdSets → Ads ----
        if (ad_account_id && access_token) {
            try {
                // Construir date param para insights
                let dateParam = '';
                if (isAllTime) {
                    dateParam = 'date_preset=maximum';
                } else {
                    dateParam = `time_range=${encodeURIComponent(JSON.stringify({ since: clampedStart, until: endDate }))}`;
                }

                // 1. Listar todas as campanhas
                const campaignsRes = await fetch(`https://graph.facebook.com/v21.0/act_${ad_account_id}/campaigns?fields=id,name,status,objective&limit=100&access_token=${access_token}`);
                const campaignsData = await campaignsRes.json();

                if (campaignsData.data && !campaignsData.error) {
                    // Limpar dados antigos
                    await db.delete(marketingCampaigns).where(and(eq(marketingCampaigns.companyId, companyId), eq(marketingCampaigns.platform, 'meta_ads')));
                    await db.delete(marketingAdsets).where(and(eq(marketingAdsets.companyId, companyId), eq(marketingAdsets.platform, 'meta_ads')));
                    await db.delete(marketingAds).where(and(eq(marketingAds.companyId, companyId), eq(marketingAds.platform, 'meta_ads')));

                    for (const campaign of campaignsData.data) {
                        // Insights da campanha
                        let campInsights: any = {};
                        try {
                            const ciRes = await fetch(`https://graph.facebook.com/v21.0/${campaign.id}/insights?fields=impressions,clicks,spend,actions,ctr,cpc,cpm,cost_per_action_type,reach,frequency&${dateParam}&access_token=${access_token}`);
                            const ciData = await ciRes.json();
                            if (ciData.data?.length) campInsights = ciData.data[0];
                        } catch (e) { console.error(`[Sync] Campaign insights error ${campaign.id}:`, e); }

                        const campConversions = extractConversions(campInsights.actions);
                        const campCpl = extractCostPerLead(campInsights.cost_per_action_type);

                        await db.insert(marketingCampaigns).values({
                            companyId,
                            platform: 'meta_ads',
                            campaignId: campaign.id,
                            campaignName: campaign.name,
                            status: campaign.status,
                            objective: campaign.objective,
                            impressions: parseInt(campInsights.impressions || '0'),
                            clicks: parseInt(campInsights.clicks || '0'),
                            spend: String(campInsights.spend || '0'),
                            conversions: campConversions,
                            ctr: String(campInsights.ctr || '0'),
                            cpc: String(campInsights.cpc || '0'),
                            cpm: String(campInsights.cpm || '0'),
                            roas: String(parseFloat(campInsights.spend || '0') > 0 ? campConversions / parseFloat(campInsights.spend || '1') : 0),
                            reach: parseInt(campInsights.reach || '0'),
                            frequency: String(campInsights.frequency || '0'),
                            costPerLead: campCpl !== null ? String(campCpl) : null,
                            dateStart: campInsights.date_start || clampedStart,
                            dateEnd: campInsights.date_stop || endDate,
                            rawData: { ...campaign, reach: parseInt(campInsights.reach || '0'), frequency: parseFloat(campInsights.frequency || '0'), cost_per_lead: campCpl, actions: campInsights.actions || [] },
                        });

                        // 2. Listar AdSets desta campanha
                        try {
                            const adsetsRes = await fetch(`https://graph.facebook.com/v21.0/${campaign.id}/adsets?fields=id,name,status,daily_budget,lifetime_budget,optimization_goal&limit=100&access_token=${access_token}`);
                            const adsetsData = await adsetsRes.json();

                            if (adsetsData.data) {
                                for (const adset of adsetsData.data) {
                                    let adsetInsights: any = {};
                                    try {
                                        const aiRes = await fetch(`https://graph.facebook.com/v21.0/${adset.id}/insights?fields=impressions,clicks,spend,actions,ctr,cpc,cpm,cost_per_action_type,reach,frequency&${dateParam}&access_token=${access_token}`);
                                        const aiData = await aiRes.json();
                                        if (aiData.data?.length) adsetInsights = aiData.data[0];
                                    } catch (e) { console.error(`[Sync] AdSet insights error ${adset.id}:`, e); }

                                    const adsetConv = extractConversions(adsetInsights.actions);
                                    const adsetCpl = extractCostPerLead(adsetInsights.cost_per_action_type);

                                    await db.insert(marketingAdsets).values({
                                        companyId,
                                        platform: 'meta_ads',
                                        campaignId: campaign.id,
                                        adsetId: adset.id,
                                        adsetName: adset.name,
                                        status: adset.status,
                                        dailyBudget: adset.daily_budget ? String(Number(adset.daily_budget) / 100) : null,
                                        lifetimeBudget: adset.lifetime_budget ? String(Number(adset.lifetime_budget) / 100) : null,
                                        optimizationGoal: adset.optimization_goal,
                                        impressions: parseInt(adsetInsights.impressions || '0'),
                                        clicks: parseInt(adsetInsights.clicks || '0'),
                                        spend: String(adsetInsights.spend || '0'),
                                        conversions: adsetConv,
                                        ctr: String(adsetInsights.ctr || '0'),
                                        cpc: String(adsetInsights.cpc || '0'),
                                        cpm: String(adsetInsights.cpm || '0'),
                                        reach: parseInt(adsetInsights.reach || '0'),
                                        frequency: String(adsetInsights.frequency || '0'),
                                        costPerLead: adsetCpl !== null ? String(adsetCpl) : null,
                                        rawData: { ...adset, actions: adsetInsights.actions || [] },
                                    });

                                    // 3. Listar Ads deste AdSet
                                    try {
                                        const adsRes = await fetch(`https://graph.facebook.com/v21.0/${adset.id}/ads?fields=id,name,status,creative{thumbnail_url,body,title}&limit=100&access_token=${access_token}`);
                                        const adsData = await adsRes.json();

                                        if (adsData.data) {
                                            for (const ad of adsData.data) {
                                                let adInsights: any = {};
                                                try {
                                                    const adIRes = await fetch(`https://graph.facebook.com/v21.0/${ad.id}/insights?fields=impressions,clicks,spend,actions,ctr,cpc,cpm,cost_per_action_type,reach,frequency&${dateParam}&access_token=${access_token}`);
                                                    const adIData = await adIRes.json();
                                                    if (adIData.data?.length) adInsights = adIData.data[0];
                                                } catch (e) { console.error(`[Sync] Ad insights error ${ad.id}:`, e); }

                                                const adConv = extractConversions(adInsights.actions);
                                                const adCpl = extractCostPerLead(adInsights.cost_per_action_type);

                                                await db.insert(marketingAds).values({
                                                    companyId,
                                                    platform: 'meta_ads',
                                                    adsetId: adset.id,
                                                    campaignId: campaign.id,
                                                    adId: ad.id,
                                                    adName: ad.name,
                                                    status: ad.status,
                                                    impressions: parseInt(adInsights.impressions || '0'),
                                                    clicks: parseInt(adInsights.clicks || '0'),
                                                    spend: String(adInsights.spend || '0'),
                                                    conversions: adConv,
                                                    ctr: String(adInsights.ctr || '0'),
                                                    cpc: String(adInsights.cpc || '0'),
                                                    cpm: String(adInsights.cpm || '0'),
                                                    reach: parseInt(adInsights.reach || '0'),
                                                    frequency: String(adInsights.frequency || '0'),
                                                    costPerLead: adCpl !== null ? String(adCpl) : null,
                                                    creativeThumbnailUrl: ad.creative?.thumbnail_url || null,
                                                    creativeBody: ad.creative?.body || null,
                                                    creativeTitle: ad.creative?.title || null,
                                                    rawData: { ...ad, actions: adInsights.actions || [] },
                                                });
                                            }
                                        }
                                    } catch (e) { console.error(`[Sync] Ads list error for adset ${adset.id}:`, e); }
                                }
                            }
                        } catch (e) { console.error(`[Sync] AdSets list error for campaign ${campaign.id}:`, e); }
                    }
                }
            } catch (e) {
                console.error('[Sync Meta] Ads sync error:', e);
            }
        } else if (!ad_account_id) {
            // Sem conta de anúncio selecionada — limpar dados antigos
            await db.delete(marketingCampaigns).where(and(eq(marketingCampaigns.companyId, companyId), eq(marketingCampaigns.platform, 'meta_ads')));
            await db.delete(marketingAdsets).where(and(eq(marketingAdsets.companyId, companyId), eq(marketingAdsets.platform, 'meta_ads')));
            await db.delete(marketingAds).where(and(eq(marketingAds.companyId, companyId), eq(marketingAds.platform, 'meta_ads')));
        }

        // ---- Auto-sync lead_diagnostics ----
        try {
            await syncDiagnosticsFromCampaigns(companyId);
        } catch (e) { console.error('[Sync Meta] Diagnostics sync error:', e); }

        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}

// ====================================================================
// AUTO-SYNC DIAGNOSTICS — Totaliza campanhas e alimenta lead_diagnostics
// ====================================================================
async function syncDiagnosticsFromCampaigns(companyId: string) {
    const campaigns = await db.select({
        spend: marketingCampaigns.spend,
        impressions: marketingCampaigns.impressions,
        clicks: marketingCampaigns.clicks,
        conversions: marketingCampaigns.conversions,
        dateStart: marketingCampaigns.dateStart,
    }).from(marketingCampaigns).where(eq(marketingCampaigns.companyId, companyId));

    if (!campaigns.length) return;

    // Agrupar por mês
    const byMonth: Record<string, { spend: number; impressions: number; clicks: number; conversions: number }> = {};
    for (const c of campaigns) {
        const m = (c.dateStart || '').substring(0, 7);
        if (!m || m.length < 7) continue;
        if (!byMonth[m]) byMonth[m] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
        byMonth[m].spend += Number(c.spend || 0);
        byMonth[m].impressions += c.impressions || 0;
        byMonth[m].clicks += c.clicks || 0;
        byMonth[m].conversions += c.conversions || 0;
    }

    // Se todos os meses são antigos, colapsar no mês atual
    const monthKeys = Object.keys(byMonth);
    let targetMonths = byMonth;
    if (monthKeys.length === 1 || monthKeys.every(k => k < '2026-01')) {
        const total = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
        for (const v of Object.values(byMonth)) {
            total.spend += v.spend; total.impressions += v.impressions;
            total.clicks += v.clicks; total.conversions += v.conversions;
        }
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        targetMonths = { [currentMonth]: total };
    }

    for (const [month, totals] of Object.entries(targetMonths)) {
        try {
            const existing = await db.select().from(leadDiagnostics).where(
                and(eq(leadDiagnostics.companyId, companyId), eq(leadDiagnostics.referenceMonth, month))
            );

            if (existing.length) {
                await db.update(leadDiagnostics).set({
                    adSpend: String(Math.round(totals.spend * 100) / 100),
                    campaignImpressions: totals.impressions,
                    campaignClicks: totals.clicks,
                    campaignConversions: totals.conversions,
                }).where(eq(leadDiagnostics.id, existing[0].id));
            } else {
                await db.insert(leadDiagnostics).values({
                    companyId,
                    referenceMonth: month,
                    adSpend: String(Math.round(totals.spend * 100) / 100),
                    campaignImpressions: totals.impressions,
                    campaignClicks: totals.clicks,
                    campaignConversions: totals.conversions,
                    totalLeads: 0, meetingsScheduled: 0, meetingsDone: 0,
                    noShow: 0, contractsWon: 0, ltvTotal: '0', commissionRate: '10',
                });
            }
        } catch (e) { console.error(`[Diagnostics] Error for ${month}:`, e); }
    }
}

// ====================================================================
// SYNC GOOGLE (Placeholder)
// ====================================================================
export async function syncGoogleAction(companyId: string, dateRange?: { from?: string; to?: string }) {
    return { ok: true };
}

// ====================================================================
// DISCONNECT
// ====================================================================
export async function disconnectPlatformAction(companyId: string, platform: string) {
    await db.delete(marketingCredentials).where(
        and(eq(marketingCredentials.companyId, companyId), eq(marketingCredentials.platform, platform))
    );
    return { ok: true };
}

// ====================================================================
// Google config (Placeholder)
// ====================================================================
export async function saveGoogleConfigAction(companyId: string, config: any) {
    return { ok: true };
}

export async function getGoogleAuthUrlAction(companyId: string) {
    return { ok: true, auth_url: '' };
}
