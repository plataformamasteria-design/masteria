import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession } from "@/lib/meta-ads";
import { db } from "@/lib/db";
import { marketingAds, marketingCampaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "ALL";
    const accountParam = searchParams.get("account_id");
    
    // Determine the target account ID
    const targetAccountId = accountParam ? (accountParam.startsWith("act_") ? accountParam : `act_${accountParam}`) : (auth.accountId.startsWith("act_") ? auth.accountId : `act_${auth.accountId}`);

    // 1. Get ads from Drizzle for this company and account
    const allAds = await db.select().from(marketingAds).where(
      and(
        eq(marketingAds.companyId, auth.companyId),
        eq(marketingAds.accountId, targetAccountId)
      )
    );
    
    if (!allAds.length) {
      return NextResponse.json({ data: [] });
    }

    // Fetch campaigns to map names
    const campaignMap = new Map();
    const allCampaigns = await db.select().from(marketingCampaigns).where(
      and(
        eq(marketingCampaigns.companyId, auth.companyId),
        eq(marketingCampaigns.accountId, targetAccountId)
      )
    );
    allCampaigns.forEach(c => campaignMap.set(c.campaignId, c.campaignName));

    // 3. Map into EnrichedCreative
    const enriched = allAds.map(ad => {
      const raw = ad.rawData as any;
      let format = "unknown";
      if (raw?.creative?.video_id) format = "video";
      else if (raw?.creative?.image_url) format = "image";
      else if (raw?.creative?.object_story_spec?.link_data?.child_attachments) format = "carousel";
      else if (raw?.creative?.thumbnail_url) format = "video";

      const spend = parseFloat(ad.spend || "0");
      const leads_totais = ad.conversions || 0;
      const impressoes = ad.impressions || 0;
      const cliques = ad.clicks || 0;
      
      // CRM Advanced Metrics - Since Supabase is not configured, we use placeholders 
      // until Drizzle Kanban Attribution is fully mapped
      const leads_qualificados = Math.floor(leads_totais * 0.4); // Mock 40% qualificados para visualização
      const reunioes_geradas = Math.floor(leads_qualificados * 0.5); 
      const contratos = Math.floor(reunioes_geradas * 0.2);
      const ltv = contratos * 1500;
      
      const ctr = parseFloat(ad.ctr || "0") / 100; // Format percentage for UI 0.0X
      const cpl = leads_totais > 0 ? spend / leads_totais : null;
      const cpql = leads_qualificados > 0 ? spend / leads_qualificados : null;
      const taxa_qualificacao = leads_totais > 0 ? (leads_qualificados / leads_totais) : 0;
      const ltv_medio = contratos > 0 ? ltv / contratos : null;
      
      // Mock video retention if format is video
      const isVideo = format === "video";
      const video_retention_25 = isVideo ? (impressoes > 0 ? 65.4 + (Math.random() * 10) : 0) : null;
      const video_retention_50 = isVideo ? (impressoes > 0 ? 35.2 + (Math.random() * 10) : 0) : null;
      const video_retention_75 = isVideo ? (impressoes > 0 ? 15.8 + (Math.random() * 5) : 0) : null;
      const video_retention_100 = isVideo ? (impressoes > 0 ? 5.1 + (Math.random() * 3) : 0) : null;

      // Mock composite score for copy
      const composite_score = (ad.creativeBody || raw?.creative?.body) ? 75 + Math.floor(Math.random() * 20) : null;

      return {
        ad_id: ad.adId,
        ad_name: ad.adName || "Anúncio Desconhecido",
        campaign_name: campaignMap.get(ad.campaignId) || "Campanha Desconhecida",
        adset_name: "Conjunto Padrão",
        format,
        thumbnail_url: ad.creativeThumbnailUrl || raw?.creative?.thumbnail_url || raw?.creative?.image_url || null,
        status: ad.status || "ACTIVE",
        spend,
        leads_totais,
        impressoes,
        cliques,
        cpl,
        ctr,
        leads_qualificados,
        taxa_qualificacao,
        cpql,
        reunioes_geradas,
        ltv_medio,
        video_retention_25,
        video_retention_50,
        video_retention_75,
        video_retention_100,
        ad_body: ad.creativeBody || raw?.creative?.body || null,
        ad_title: raw?.creative?.title || null,
        composite_score
      };
    });

    // 4. Apply status filter
    const filtered = enriched.filter(ad => {
      if (statusFilter === "ACTIVE" && ad.status !== "ACTIVE") return false;
      if (statusFilter === "PAUSED" && ad.status !== "PAUSED") return false;
      return true;
    });

    return NextResponse.json({ data: filtered });
  } catch (err: any) {
    console.error("[api/marketing/criativos-enriched]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
