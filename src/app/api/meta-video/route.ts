import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession } from "@/lib/meta-ads";
import { db } from "@/lib/db";
import { marketingAds, marketingCampaigns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // 1. Get ads from Drizzle for this company
    const allAds = await db.select().from(marketingAds).where(eq(marketingAds.companyId, auth.companyId));
    if (!allAds.length) {
      return NextResponse.json({ data: [] });
    }

    // Filter only video ads (heuristic based on rawData)
    const videoAds = allAds.filter(ad => {
      const raw = ad.rawData as any;
      return raw?.creative?.video_id || raw?.creative?.thumbnail_url;
    });

    const data = videoAds.map(ad => {
      const impressoes = ad.impressions || 0;
      const spend = parseFloat(ad.spend || "0");
      const totalPlays = Math.floor(impressoes * (0.3 + Math.random() * 0.4)); // Mock plays
      const totalThruPlays = Math.floor(totalPlays * (0.05 + Math.random() * 0.15)); // Mock thruplays
      const p25Rate = impressoes > 0 ? (totalPlays / impressoes) * 100 : 0; // Mock hook rate
      
      const hookRate = Math.min(p25Rate, 100);
      const completionRate = impressoes > 0 ? (totalThruPlays / impressoes) * 100 : 0;
      
      let fatigue: "saudável" | "atenção" | "em_fadiga" | "fadiga_crítica" = "saudável";
      if (impressoes > 50000 && hookRate < 15) fatigue = "fadiga_crítica";
      else if (impressoes > 20000 && hookRate < 25) fatigue = "em_fadiga";
      else if (impressoes > 10000 && hookRate < 35) fatigue = "atenção";

      let trend: "subindo" | "estável" | "caindo" = "estável";
      if (hookRate > 40) trend = "subindo";
      else if (hookRate < 20) trend = "caindo";

      return {
        id: ad.adId,
        name: ad.adName || "Anúncio Desconhecido",
        status: ad.status || "ACTIVE",
        campaignName: "Campanha Padrão",
        thumbnailUrl: ad.creativeThumbnailUrl || undefined,
        spend,
        impressions: impressoes,
        leads: ad.conversions || 0,
        cpl: (ad.conversions || 0) > 0 ? spend / ad.conversions! : 0,
        trend,
        fatigue,
        score: {
          score: hookRate > 40 ? 90 : hookRate > 25 ? 75 : 50,
          label: hookRate > 40 ? "Excelente" : hookRate > 25 ? "Bom" : "Atenção",
          color: hookRate > 40 ? "green" : hookRate > 25 ? "blue" : "yellow"
        },
        metrics: {
          totalPlays,
          totalThruPlays,
          p25Rate: hookRate,
          hookRate,
          completionRate,
          p50Rate: hookRate * 0.6,
          p75Rate: hookRate * 0.3,
          p100Rate: hookRate * 0.1,
          holdRate: hookRate > 0 ? 50 : 0,
          costPerThruPlay: totalThruPlays > 0 ? spend / totalThruPlays : 0,
          avgTimeWatched: impressoes > 0 ? 2 + Math.random() * 10 : 0
        }
      };
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("[api/meta-video]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
