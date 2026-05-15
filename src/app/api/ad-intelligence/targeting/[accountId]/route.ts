import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession } from "@/lib/meta-ads";
import { db } from "@/lib/db";
import { marketingAdsets, marketingCampaigns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allAdsets = await db.select().from(marketingAdsets).where(eq(marketingAdsets.companyId, auth.companyId));
    const allCampaigns = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.companyId, auth.companyId));
    const campaignMap = new Map(allCampaigns.map(c => [c.campaignId, c]));

    let targetingData = [];
    let interestStats: Record<string, { count: number, leads: number, spend: number }> = {};
    let genderStats: Record<string, { count: number, total_leads: number, total_spend: number }> = {};

    for (const adset of allAdsets) {
      const raw = adset.rawData as any;
      const t = raw?.targeting || {};
      
      const interests = (t.flexible_spec?.[0]?.interests || []).map((i: any) => i.name) as string[];
      const custom_audiences = (t.custom_audiences || []).map((c: any) => c.name || c.id) as string[];
      const genders = t.genders || [0];
      const age_min = t.age_min || 18;
      const age_max = t.age_max || 65;

      const spend = parseFloat(adset.spend || "0");
      const leads = adset.conversions || 0;
      const cpl = leads > 0 ? spend / leads : null;
      const ctr = parseFloat(adset.ctr || "0");

      let score = 50;
      if (cpl && cpl < 15) score += 30;
      else if (cpl && cpl > 50) score -= 20;
      if (score > 100) score = 100;
      if (score < 0) score = 0;

      targetingData.push({
        adset_id: adset.adsetId,
        adset_name: adset.adsetName || "Conjunto Desconhecido",
        campaign_name: campaignMap.get(adset.campaignId)?.campaignName || "Campanha Desconhecida",
        age_min,
        age_max,
        genders,
        interests,
        custom_audiences,
        spend,
        leads,
        cpl,
        ctr,
        score
      });

      // Aggregate interests
      for (const interest of interests) {
        if (!interestStats[interest]) interestStats[interest] = { count: 0, leads: 0, spend: 0 };
        interestStats[interest].count += 1;
        interestStats[interest].leads += leads;
        interestStats[interest].spend += spend;
      }

      // Aggregate genders
      const genderName = genders.includes(0) ? "Todos" : genders.includes(1) ? "Homens" : "Mulheres";
      if (!genderStats[genderName]) genderStats[genderName] = { count: 0, total_leads: 0, total_spend: 0 };
      genderStats[genderName].count += 1;
      genderStats[genderName].total_leads += leads;
      genderStats[genderName].total_spend += spend;
    }

    const top_interests = Object.entries(interestStats)
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        total_leads: stats.leads,
        avg_cpl: stats.leads > 0 ? stats.spend / stats.leads : null
      }))
      .sort((a, b) => b.total_leads - a.total_leads);

    return NextResponse.json({
      data: targetingData.sort((a, b) => b.score - a.score),
      top_interests,
      gender_analysis: genderStats
    });

  } catch (error: any) {
    console.error("[api/ad-intelligence/targeting]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
