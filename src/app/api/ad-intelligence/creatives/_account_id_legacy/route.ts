/**
 * GET /api/ad-intelligence/creatives/[account_id]
 * Busca criativos diretamente da Meta Graph API v21.0
 * Inclui: copy (title, body, CTA), thumbnail, métricas de performance e score
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOKEN  = () => process.env.META_ADS_ACCESS_TOKEN || "";
const BASE   = "https://graph.facebook.com/v21.0";

// Campos de insights que queremos por anúncio
const INSIGHT_FIELDS = "spend,impressions,clicks,ctr,actions,cost_per_action_type,frequency";

// Campos de criativo do anúncio
const AD_FIELDS = "id,name,status,effective_status,adset_id,adset{name,campaign_id,campaign{name}},creative{title,body,call_to_action_type,thumbnail_url,image_url,video_id,object_story_spec}";

function calcScore(spend: number, leads: number, ctr: number, frequency: number): number {
  if (spend === 0) return 0;
  const cpl = leads > 0 ? spend / leads : 9999;
  let score = 50;
  // CTR: bom > 1.5%
  if (ctr >= 2.0) score += 20;
  else if (ctr >= 1.5) score += 12;
  else if (ctr >= 1.0) score += 5;
  else score -= 10;
  // CPL: bom < 30
  if (cpl < 20) score += 25;
  else if (cpl < 40) score += 12;
  else if (cpl < 80) score += 0;
  else score -= 15;
  // Frequência alta = ruim
  if (frequency > 4) score -= 15;
  else if (frequency > 2.5) score -= 5;
  return Math.max(0, Math.min(100, score));
}

function detectFormat(creative: Record<string, unknown>): "image" | "video" | "carousel" | "unknown" {
  const spec = creative?.object_story_spec as Record<string, unknown> | undefined;
  if (creative?.video_id) return "video";
  if (spec?.video_data) return "video";
  if (spec?.link_data) return "image";
  if (spec?.template_data) return "carousel";
  return "image";
}

async function metaFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
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
  const sortBy       = searchParams.get("sort") || "score_desc";
  const filterFormat = searchParams.get("format") || "";
  const since        = searchParams.get("since") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const until        = searchParams.get("until") || new Date().toISOString().slice(0, 10);

  try {
    // 1. Buscar anúncios ativos + pausados com criativos
    const adsUrl = `${BASE}/${accountId}/ads?fields=${AD_FIELDS}&limit=25&access_token=${token}`;
    const adsRes = await metaFetch(adsUrl) as { data?: unknown[]; error?: { message: string } };

    if (adsRes.error) {
      console.error("[ad-intelligence/creatives] Meta API error:", adsRes.error.message);
      return NextResponse.json({ error: adsRes.error.message }, { status: 500 });
    }

    const ads = (adsRes.data || []) as Record<string, unknown>[];

    // 2. Buscar insights por anúncio (em paralelo, lotes de 20)
    const timeRange = JSON.stringify({ since, until });
    const insightFields = INSIGHT_FIELDS;

    // Buscar insights de todos os ads de uma vez (nível ad)
    const insightsUrl = `${BASE}/${accountId}/insights?level=ad&fields=ad_id,ad_name,${insightFields}&time_range=${encodeURIComponent(timeRange)}&limit=25&access_token=${token}`;
    const insightsRes = await metaFetch(insightsUrl) as { data?: unknown[]; error?: { message: string } };

    const insightMap = new Map<string, Record<string, unknown>>();
    for (const row of ((insightsRes as { data?: unknown[] }).data || []) as Record<string, unknown>[]) {
      const adId = row.ad_id as string;
      if (adId) insightMap.set(adId, row);
    }

    // 3. Combinar
    const enriched = ads.map(ad => {
      const creative = (ad.creative as Record<string, unknown>) || {};
      const adset = (ad.adset as Record<string, unknown>) || {};
      const campaign = (adset.campaign as Record<string, unknown>) || {};
      const insight = insightMap.get(ad.id as string) || {};

      // Extrair leads das actions
      const actions = (insight.actions as Array<{ action_type: string; value: string }>) || [];
      const costPerAction = (insight.cost_per_action_type as Array<{ action_type: string; value: string }>) || [];
      const leads = actions.filter(a => a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead").reduce((s, a) => s + parseFloat(a.value || "0"), 0);
      const spend = parseFloat((insight.spend as string) || "0");
      const ctr = parseFloat((insight.ctr as string) || "0");
      const frequency = parseFloat((insight.frequency as string) || "1");
      const cpl = leads > 0 ? spend / leads : null;
      const impressions = parseFloat((insight.impressions as string) || "0");
      const clicks = parseFloat((insight.clicks as string) || "0");
      const score = calcScore(spend, leads, ctr, frequency);
      const format = detectFormat(creative);

      const spec = (creative.object_story_spec as Record<string, unknown>) || {};
      const linkData = (spec.link_data as Record<string, unknown>) || {};

      return {
        ad_id: ad.id as string,
        ad_name: ad.name as string,
        adset_id: ad.adset_id as string,
        adset_name: adset.name as string || "",
        campaign_id: campaign.id as string || "",
        campaign_name: campaign.name as string || "",
        status: ad.status as string,
        effective_status: ad.effective_status as string,
        format,
        title: (creative.title as string) || (linkData.name as string) || null,
        body: (creative.body as string) || (linkData.description as string) || (linkData.message as string) || null,
        call_to_action: (creative.call_to_action_type as string) || null,
        thumbnail_url: (creative.thumbnail_url as string) || (creative.image_url as string) || null,
        spend,
        leads,
        cpl,
        ctr,
        frequency,
        impressions,
        clicks,
        score,
        alerts: [],
        has_alert: false,
        worst_severity: null,
      };
    }).filter(cr => filterFormat ? cr.format === filterFormat : true);

    // 4. Ordenar
    const [sortField, sortDir] = sortBy.endsWith("_asc") ? [sortBy.replace("_asc", ""), "asc"] : [sortBy.replace("_desc", ""), "desc"];
    enriched.sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortField] as number ?? 0;
      const vb = (b as Record<string, unknown>)[sortField] as number ?? 0;
      return sortDir === "asc" ? va - vb : vb - va;
    });

    // 5. Sumário de formatos
    const formatSummary = enriched.reduce((acc, cr) => {
      const f = cr.format || "unknown";
      if (!acc[f]) acc[f] = { count: 0, total_leads: 0, avg_cpl: 0 };
      acc[f].count++;
      acc[f].total_leads += cr.leads;
      return acc;
    }, {} as Record<string, { count: number; total_leads: number; avg_cpl: number }>);

    return NextResponse.json({
      data: enriched,
      count: enriched.length,
      format_summary: formatSummary,
      meta: { account_id: accountId, sort: sortBy, since, until },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ad-intelligence/creatives]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
