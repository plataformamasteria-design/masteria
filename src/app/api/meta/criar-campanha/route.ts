/**
 * POST /api/meta/criar-campanha — Cria campanha + adsets + ads via Graph API.
 * Multi-tenant. Recebe a árvore do TreeBuilder e publica sequencialmente.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";
import { clearMetaCache } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.accountId) {
      return NextResponse.json({ error: "Conta de anúncios não selecionada" }, { status: 400 });
    }

    const body = await req.json();
    const { campaign, adsets } = body;

    if (!campaign?.name || !campaign?.objective) {
      return NextResponse.json({ error: "Nome e objetivo da campanha obrigatórios" }, { status: 400 });
    }

    // 1. Criar Campanha
    const campPayload: Record<string, unknown> = {
      access_token: auth.token,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status || "PAUSED",
      special_ad_categories: campaign.special_ad_categories || [],
    };
    if (campaign.daily_budget) campPayload.daily_budget = Math.round(parseFloat(campaign.daily_budget) * 100);
    if (campaign.lifetime_budget) campPayload.lifetime_budget = Math.round(parseFloat(campaign.lifetime_budget) * 100);
    if (campaign.bid_strategy) campPayload.bid_strategy = campaign.bid_strategy;

    const campRes = await fetch(`${META_BASE}/${auth.accountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campPayload),
    });
    const campData = await campRes.json();
    if (!campRes.ok) throw new Error(campData.error?.message || "Erro ao criar campanha");

    const campaignId = campData.id;
    const createdAdsets: string[] = [];
    const createdAds: string[] = [];
    const errors: string[] = [];

    // 2. Criar AdSets
    for (const adset of (adsets || [])) {
      try {
        const asPayload: Record<string, unknown> = {
          access_token: auth.token,
          campaign_id: campaignId,
          name: adset.name,
          status: adset.status || "PAUSED",
          billing_event: adset.billing_event || "IMPRESSIONS",
          optimization_goal: adset.optimization_goal || "LEAD_GENERATION",
          targeting: adset.targeting || { geo_locations: { countries: ["BR"] } },
        };
        if (adset.daily_budget) asPayload.daily_budget = Math.round(parseFloat(adset.daily_budget) * 100);
        if (adset.lifetime_budget) asPayload.lifetime_budget = Math.round(parseFloat(adset.lifetime_budget) * 100);
        if (adset.start_time) asPayload.start_time = adset.start_time;
        if (adset.end_time) asPayload.end_time = adset.end_time;
        if (adset.promoted_object) asPayload.promoted_object = adset.promoted_object;

        const asRes = await fetch(`${META_BASE}/${auth.accountId}/adsets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(asPayload),
        });
        const asData = await asRes.json();
        if (!asRes.ok) { errors.push(`AdSet "${adset.name}": ${asData.error?.message}`); continue; }

        const adsetId = asData.id;
        createdAdsets.push(adsetId);

        // 3. Criar Ads para este adset
        for (const ad of (adset.ads || [])) {
          try {
            // Criar creative
            const crPayload: Record<string, unknown> = {
              access_token: auth.token,
              name: `Creative ${ad.name}`,
              object_story_spec: ad.object_story_spec,
            };
            const crRes = await fetch(`${META_BASE}/${auth.accountId}/adcreatives`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(crPayload),
            });
            const crData = await crRes.json();
            if (!crRes.ok) { errors.push(`Creative "${ad.name}": ${crData.error?.message}`); continue; }

            // Criar ad
            const adPayload: Record<string, unknown> = {
              access_token: auth.token,
              adset_id: adsetId,
              name: ad.name,
              status: ad.status || "PAUSED",
              creative: { creative_id: crData.id },
            };
            const adRes = await fetch(`${META_BASE}/${auth.accountId}/ads`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(adPayload),
            });
            const adData = await adRes.json();
            if (!adRes.ok) { errors.push(`Ad "${ad.name}": ${adData.error?.message}`); continue; }
            createdAds.push(adData.id);
          } catch (adErr: any) {
            errors.push(`Ad "${ad.name}": ${adErr.message}`);
          }
        }
      } catch (asErr: any) {
        errors.push(`AdSet "${adset.name}": ${asErr.message}`);
      }
    }

    clearMetaCache();

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      adsets_created: createdAdsets.length,
      ads_created: createdAds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error("[api/meta/criar-campanha]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
