import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession } from "@/lib/meta-ads";
import { db } from "@/lib/db";
import { marketingAds, marketingAdsets, marketingCampaigns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query ads from local DB
    const allAds = await db.select().from(marketingAds).where(eq(marketingAds.companyId, auth.companyId));
    
    // Quick map for adsets and campaigns to get their names if needed, though marketingAds doesn't have campaign/adset names
    // Actually, we can fetch all and map in memory since it's typically < 1000 items
    const allAdsets = await db.select().from(marketingAdsets).where(eq(marketingAdsets.companyId, auth.companyId));
    const allCampaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.companyId, auth.companyId));

    const adsetMap = new Map(allAdsets.map(a => [a.adsetId, a]));
    const campaignMap = new Map(allCampaigns.map(c => [c.campaignId, c]));

    const mappedCreatives = allAds.map(ad => {
      const spend = parseFloat(ad.spend || "0");
      const leads = ad.conversions || 0;
      const cpl = leads > 0 ? spend / leads : null;
      const ctr = parseFloat(ad.ctr || "0");
      
      let score = 50;
      if (cpl && cpl < 15) score += 30;
      else if (cpl && cpl > 50) score -= 20;
      if (ctr && ctr > 1.5) score += 10;
      if (score > 100) score = 100;
      if (score < 0) score = 0;

      // Try to determine format from rawData if possible
      const raw = ad.rawData as any;
      let format = "unknown";
      if (raw?.creative?.video_id) format = "video";
      else if (raw?.creative?.image_url) format = "image";
      else if (raw?.creative?.object_story_spec?.link_data?.child_attachments) format = "carousel";

      return {
        ad_id: ad.adId,
        ad_name: ad.adName || "Anúncio Desconhecido",
        adset_id: ad.adsetId,
        adset_name: adsetMap.get(ad.adsetId)?.adsetName || "Conjunto Desconhecido",
        campaign_id: ad.campaignId,
        campaign_name: campaignMap.get(ad.campaignId)?.campaignName || "Campanha Desconhecida",
        format,
        title: ad.creativeTitle,
        body: ad.creativeBody,
        call_to_action: raw?.creative?.call_to_action?.type || null,
        thumbnail_url: ad.creativeThumbnailUrl || null,
        status: ad.status || "ACTIVE",
        effective_status: ad.status || "ACTIVE",
        spend,
        leads,
        cpl,
        ctr,
        score,
        impressions: ad.impressions || 0,
        alerts: [],
        has_alert: false,
        worst_severity: null
      };
    }).sort((a, b) => b.score - a.score);

    const format_summary = {
      image: { count: mappedCreatives.filter(c => c.format === 'image').length },
      video: { count: mappedCreatives.filter(c => c.format === 'video').length },
      carousel: { count: mappedCreatives.filter(c => c.format === 'carousel').length },
      unknown: { count: mappedCreatives.filter(c => c.format === 'unknown').length }
    };

    return NextResponse.json({
      data: mappedCreatives,
      format_summary
    });
  } catch (error: any) {
    console.error("[api/ad-intelligence/creatives]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
