/**
 * GET /api/ad-intelligence/placements/[account_id]
 * Busca e agrega dados de posicionamento diretamente da Meta Graph API v21.0
 * Usa breakdown publisher_platform,impression_device,platform_position
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const BASE  = "https://graph.facebook.com/v21.0";

const PLACEMENT_LABELS: Record<string, string> = {
  feed:               "Feed",
  story:              "Stories",
  stories:            "Stories",
  reels:              "Reels",
  explore:            "Explorar",
  explore_home:       "Explorar Home",
  right_hand_column:  "Coluna Direita",
  marketplace:        "Marketplace",
  video_feeds:        "Video Feeds",
  search:             "Pesquisa",
  profile_feed:       "Feed Perfil",
  instagram_explore:  "IG Explorar",
  instagram_stories:  "IG Stories",
  ig_reels:           "IG Reels",
  instream_video:     "Vídeo Instream",
  facebook_stories:   "FB Stories",
  instant_article:    "Artigo Instantâneo",
  biz_disco_feed:     "Discovery",
};

async function metaFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
}

function extractLeadsFromActions(actions: Array<{ action_type: string; value: string }>): number {
  return (actions || [])
    .filter(a => a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead")
    .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
}

type PlacementRowAgg = {
  spend: number; impressions: number; clicks: number; leads: number; platform: string;
};

function aggregateRows(rows: unknown[]): Map<string, PlacementRowAgg> {
  const map = new Map<string, PlacementRowAgg>();
  for (const r of (rows || []) as Record<string, unknown>[]) {
    const platform  = (r.publisher_platform as string) || "unknown";
    const position  = (r.platform_position as string) || "feed";
    const key       = `${platform}__${position}`;
    const actions   = (r.actions as Array<{ action_type: string; value: string }>) || [];
    const leads     = extractLeadsFromActions(actions);
    const cur       = map.get(key) || { spend: 0, impressions: 0, clicks: 0, leads: 0, platform };
    map.set(key, {
      spend:       cur.spend + parseFloat((r.spend as string) || "0"),
      impressions: cur.impressions + parseFloat((r.impressions as string) || "0"),
      clicks:      cur.clicks + parseFloat((r.clicks as string) || "0"),
      leads:       cur.leads + leads,
      platform,
    });
  }
  return map;
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
  const days  = parseInt(searchParams.get("days") || "30");
  const since = searchParams.get("since") || new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const until = searchParams.get("until") || new Date().toISOString().slice(0, 10);

  const prevSince = new Date(new Date(since).getTime() - days * 86400000).toISOString().slice(0, 10);
  const prevUntil = new Date(new Date(since).getTime() - 86400000).toISOString().slice(0, 10);

  try {
    // Insights com breakdown por posicionamento — período atual
    const fields = "spend,impressions,clicks,ctr,cpm,actions,publisher_platform,platform_position,impression_device";
    const timeRange = JSON.stringify({ since, until });
    const prevTimeRange = JSON.stringify({ since: prevSince, until: prevUntil });

    const [curRes, prevRes] = await Promise.all([
      metaFetch(`${BASE}/${accountId}/insights?level=account&breakdowns=publisher_platform,platform_position&fields=${fields}&time_range=${encodeURIComponent(timeRange)}&limit=200&access_token=${token}`) as Promise<{ data?: unknown[]; error?: { message: string } }>,
      metaFetch(`${BASE}/${accountId}/insights?level=account&breakdowns=publisher_platform,platform_position&fields=${fields}&time_range=${encodeURIComponent(prevTimeRange)}&limit=200&access_token=${token}`) as Promise<{ data?: unknown[] }>,
    ]) as [{ data?: unknown[]; error?: { message: string } }, { data?: unknown[] }];

    if ((curRes as { error?: { message: string } }).error) {
      const err = (curRes as { error: { message: string } }).error;
      console.error("[ad-intelligence/placements] Meta API error:", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }



    const curMap  = aggregateRows(curRes.data || []);
    const prevMap = aggregateRows((prevRes as { data?: unknown[] }).data || []);

    const placements = Array.from(curMap.entries()).map(([key, data]) => {
      const [platform, placement] = key.split("__");
      const prev    = prevMap.get(key);
      const cpl     = data.leads > 0 ? data.spend / data.leads : null;
      const ctr     = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : null;
      const cpm     = data.impressions > 0 ? (data.spend / data.impressions) * 1000 : null;
      const prevCpl = prev && prev.leads > 0 ? prev.spend / prev.leads : null;
      const deltaCpl = cpl !== null && prevCpl !== null && prevCpl > 0
        ? ((cpl - prevCpl) / prevCpl) * 100 : null;

      return {
        key, platform, placement,
        placement_label: PLACEMENT_LABELS[placement] || placement.replace(/_/g, " "),
        spend:       data.spend,
        impressions: data.impressions,
        clicks:      data.clicks,
        leads:       data.leads,
        cpl, ctr, cpm,
        prev_cpl: prevCpl,
        delta_cpl: deltaCpl,
        share_spend: 0,
      };
    }).filter(p => p.spend > 0 || p.impressions > 0).sort((a, b) => (b.leads || 0) - (a.leads || 0));

    // Share de spend
    const totalSpend = placements.reduce((s, p) => s + p.spend, 0);
    for (const p of placements) {
      p.share_spend = totalSpend > 0 ? (p.spend / totalSpend) * 100 : 0;
    }

    // Melhor e pior CPL
    const withCpl = placements.filter(p => p.cpl !== null && p.leads > 0);
    const bestPlacement  = withCpl.length > 0 ? withCpl.reduce((min, p) => p.cpl! < min.cpl! ? p : min) : null;
    const worstPlacement = withCpl.length > 0 ? withCpl.reduce((max, p) => p.cpl! > max.cpl! ? p : max) : null;

    return NextResponse.json({
      data: placements,
      best_placement:  bestPlacement  ? { placement: bestPlacement.placement_label,  platform: bestPlacement.platform,  cpl: bestPlacement.cpl  } : null,
      worst_placement: worstPlacement ? { placement: worstPlacement.placement_label, platform: worstPlacement.platform, cpl: worstPlacement.cpl } : null,
      total_spend: totalSpend,
      meta: { account_id: accountId, since, until },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ad-intelligence/placements]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
