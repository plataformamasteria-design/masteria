/**
 * GET /api/ad-intelligence/targeting/[account_id]
 * Busca targeting de adsets diretamente da Meta Graph API v21.0
 * Inclui: interesses, gênero, idade, audiências customizadas, posicionamentos e métricas
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const BASE  = "https://graph.facebook.com/v21.0";

const ADSET_FIELDS = [
  "id,name,status,effective_status",
  "campaign_id,campaign{name}",
  "targeting",
  "optimization_goal,billing_event",
].join(",");

const INSIGHT_FIELDS = "adset_id,spend,impressions,clicks,ctr,frequency,actions,cost_per_action_type";

async function metaFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
}

function extractLeads(actions: Array<{ action_type: string; value: string }>): number {
  return (actions || [])
    .filter(a => a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead")
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
}

function calcScore(spend: number, leads: number, ctr: number): number {
  if (spend === 0) return 0;
  const cpl = leads > 0 ? spend / leads : 9999;
  let score = 50;
  if (ctr >= 2.0) score += 20; else if (ctr >= 1.0) score += 8; else score -= 10;
  if (cpl < 20) score += 25; else if (cpl < 50) score += 10; else if (cpl > 100) score -= 15;
  return Math.max(0, Math.min(100, score));
}

export async function GET(
  req: NextRequest,
  { params }: { params: { account_id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const token = TOKEN();
  if (!token) return NextResponse.json({ error: "META_ADS_ACCESS_TOKEN não configurado" }, { status: 500 });

  const raw = params.account_id;
  const accountId = raw.startsWith("act_") ? raw : `act_${raw}`;

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const until = searchParams.get("until") || new Date().toISOString().slice(0, 10);
  const timeRange = JSON.stringify({ since, until });

  try {
    // 1. Buscar adsets com targeting
    const adsetsUrl = `${BASE}/${accountId}/adsets?fields=${ADSET_FIELDS}&limit=200&access_token=${token}`;
    const adsetsRes = await metaFetch(adsetsUrl) as { data?: unknown[]; error?: { message: string } };

    if (adsetsRes.error) {
      console.error("[ad-intelligence/targeting] Meta API error:", adsetsRes.error.message);
      return NextResponse.json({ error: adsetsRes.error.message }, { status: 500 });
    }

    const adsets = (adsetsRes.data || []) as Record<string, unknown>[];

    // 2. Buscar insights por adset
    const insightsUrl = `${BASE}/${accountId}/insights?level=adset&fields=${INSIGHT_FIELDS}&time_range=${encodeURIComponent(timeRange)}&limit=25&access_token=${token}`;
    const insightsRes = await metaFetch(insightsUrl) as { data?: unknown[] };

    const insightMap = new Map<string, Record<string, unknown>>();
    for (const row of ((insightsRes.data || []) as Record<string, unknown>[])) {
      const id = row.adset_id as string;
      if (id) insightMap.set(id, row);
    }

    // 3. Combinar
    const enriched = adsets.map(adset => {
      const targeting = (adset.targeting as Record<string, unknown>) || {};
      const campaign = (adset.campaign as Record<string, unknown>) || {};
      const insight = insightMap.get(adset.id as string) || {};

      const spend = parseFloat((insight.spend as string) || "0");
      const ctr   = parseFloat((insight.ctr as string) || "0");
      const leads  = extractLeads((insight.actions as Array<{ action_type: string; value: string }>) || []);
      const cpl    = leads > 0 ? spend / leads : null;
      const score  = calcScore(spend, leads, ctr);

      // Extrair interesses do targeting
      const flexSpec = (targeting.flexible_spec as Array<Record<string, unknown>>) || [];
      const interests = flexSpec.flatMap(spec => {
        const intr = spec.interests as Array<{ id: string; name: string }> || [];
        return intr.map(i => ({ id: i.id, name: i.name }));
      });

      // Audiências customizadas
      const customAudiences = (targeting.custom_audiences as Array<{ id: string; name: string }>) || [];
      const exclusions = (targeting.exclusions as Record<string, unknown>) || {};

      // Gêneros
      const genders = (targeting.genders as number[]) || [];

      // Posicionamentos
      const publisherPlatforms = (targeting.publisher_platforms as string[]) || [];
      const facebookPositions  = (targeting.facebook_positions as string[]) || [];
      const instagramPositions = (targeting.instagram_positions as string[]) || [];

      return {
        adset_id:             adset.id as string,
        adset_name:           adset.name as string,
        campaign_id:          campaign.id as string || "",
        campaign_name:        campaign.name as string || "",
        status:               adset.status as string,
        effective_status:     adset.effective_status as string,
        optimization_goal:    adset.optimization_goal as string || null,
        age_min:              (targeting.age_min as number) || null,
        age_max:              (targeting.age_max as number) || null,
        genders,
        interests,
        behaviors:            (flexSpec.flatMap(s => (s.behaviors as Array<{ id: string; name: string }>) || [])),
        custom_audiences:     customAudiences,
        publisher_platforms:  publisherPlatforms,
        facebook_positions:   facebookPositions,
        instagram_positions:  instagramPositions,
        // Métricas
        spend, leads, cpl, ctr, score,
        impressions: parseFloat((insight.impressions as string) || "0"),
        reach:       parseFloat((insight.reach as string) || "0"),
        frequency:   parseFloat((insight.frequency as string) || "0"),
      };
    }).sort((a, b) => b.score - a.score);

    // 4. Agregar interesses únicos com performance
    const interestMap = new Map<string, { name: string; count: number; total_leads: number; total_spend: number }>();
    for (const t of enriched) {
      for (const interest of t.interests) {
        const key = interest.id || interest.name;
        const prev = interestMap.get(key) || { name: interest.name, count: 0, total_leads: 0, total_spend: 0 };
        interestMap.set(key, {
          name: interest.name,
          count: prev.count + 1,
          total_leads: prev.total_leads + t.leads,
          total_spend: prev.total_spend + t.spend,
        });
      }
    }

    const topInterests = Array.from(interestMap.values())
      .sort((a, b) => b.total_leads - a.total_leads)
      .slice(0, 20)
      .map(i => ({ ...i, avg_cpl: i.total_leads > 0 ? i.total_spend / i.total_leads : null }));

    // 5. Análise demográfica
    const genderMap: Record<string, { count: number; total_leads: number; total_spend: number }> = {};
    for (const t of enriched) {
      const gList = t.genders.length > 0 ? t.genders : [1, 2];
      for (const g of gList) {
        const label = g === 1 ? "Masculino" : g === 2 ? "Feminino" : "Todos";
        if (!genderMap[label]) genderMap[label] = { count: 0, total_leads: 0, total_spend: 0 };
        genderMap[label].count++;
        genderMap[label].total_leads += t.leads;
        genderMap[label].total_spend += t.spend;
      }
    }

    return NextResponse.json({
      data: enriched,
      count: enriched.length,
      top_interests: topInterests,
      gender_analysis: genderMap,
      meta: { account_id: accountId, since, until },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ad-intelligence/targeting]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
