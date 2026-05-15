/**
 * POST /api/ad-intelligence/sync
 *
 * Sincroniza dados completos de cada conta Meta vinculada a clientes:
 * - Insights de campanhas, adsets e anúncios (últimos 30 dias)
 * - Criativos completos (copy, título, mídia, CTA)
 * - Targeting detalhado de adsets (interesses, comportamentos, demographics, geo, posicionamento)
 * - Insights de posicionamento (breakdown por publisher_platform + position)
 * - Gera alertas automáticos com base nos dados coletados
 *
 * Pode ser chamado manualmente ou por cron job.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const BASE = "https://graph.facebook.com/v21.0";

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseActions(actions: any[] = [], actionValues: any[] = []) {
  let leads = 0, revenue = 0;
  for (const a of actions) {
    const v = parseFloat(a.value || "0");
    if (a.action_type === "lead") leads += v;
  }
  for (const v of actionValues) {
    if (v.action_type === "purchase") revenue += parseFloat(v.value || "0");
  }
  return { leads, revenue };
}

async function metaFetch(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json.error) {
    console.error("[ad-intelligence/sync] Meta error:", json.error?.message || res.status);
    return null;
  }
  return json;
}

async function paginate(url: string): Promise<any[]> {
  const rows: any[] = [];
  let next: string | null = url;
  while (next && rows.length < 5000) {
    const data = await metaFetch(next);
    if (!data) break;
    rows.push(...(data.data || []));
    next = data.paging?.next || null;
  }
  return rows;
}

// ── Insights por nível ─────────────────────────────────────────────────────────

async function fetchInsightsByLevel(accountId: string, level: "campaign" | "adset" | "ad", since: string, until: string) {
  const fields = [
    "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name",
    "spend,impressions,clicks,reach,inline_link_clicks,actions,action_values",
  ].join(",");
  const qs = new URLSearchParams({
    access_token: TOKEN(), fields,
    time_range: JSON.stringify({ since, until }),
    level, limit: "25",
  });
  return paginate(`${BASE}/${accountId}/insights?${qs}`);
}

// ── Targeting de adsets ────────────────────────────────────────────────────────

async function fetchAdsetTargeting(accountId: string) {
  const fields = [
    "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget",
    "optimization_goal,bid_strategy,targeting,start_time,end_time",
  ].join(",");
  const qs = new URLSearchParams({
    access_token: TOKEN(), fields, limit: "200",
    filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE","PAUSED","ARCHIVED"] }]),
  });
  return paginate(`${BASE}/${accountId}/adsets?${qs}`);
}

// ── Criativos dos ads ──────────────────────────────────────────────────────────

async function fetchAdCreatives(accountId: string) {
  const fields = [
    "id,name,status,effective_status,adset_id,campaign_id",
    "creative{id,name,title,body,link_description,call_to_action_type,object_url",
    ",thumbnail_url,image_url,video_id,image_hash,object_story_spec,asset_feed_spec}",
  ].join(",");
  const qs = new URLSearchParams({
    access_token: TOKEN(), fields, limit: "200",
    filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE","PAUSED","ARCHIVED"] }]),
  });
  return paginate(`${BASE}/${accountId}/ads?${qs}`);
}

// ── Insights de posicionamento ─────────────────────────────────────────────────

async function fetchPlacementInsights(accountId: string, since: string, until: string) {
  const qs = new URLSearchParams({
    access_token: TOKEN(),
    fields: "spend,impressions,clicks,reach,actions,publisher_platform,platform_position",
    time_range: JSON.stringify({ since, until }),
    level: "account",
    breakdowns: "publisher_platform,platform_position",
    limit: "200",
  });
  return paginate(`${BASE}/${accountId}/insights?${qs}`);
}

// ── Calcular score algorítmico ─────────────────────────────────────────────────

function calcScore(spend: number, impressions: number, clicks: number, leads: number, reach: number): number {
  if (impressions === 0) return 0;
  const cpl = leads > 0 ? spend / leads : null;
  const ctr = (clicks / impressions) * 100;
  const freq = reach > 0 ? impressions / reach : null;
  const ctrScore = Math.min(100, (ctr / 2) * 100);
  const cplScore = cpl === null ? 50 : Math.max(0, 100 - ((cpl - 30) / 50) * 100);
  const freqScore = freq === null ? 50 : freq < 2 ? 100 : freq < 3 ? 70 : freq < 4 ? 40 : 10;
  return Math.round(ctrScore * 0.35 + cplScore * 0.45 + freqScore * 0.20);
}

// ── Geração de alertas ─────────────────────────────────────────────────────────

interface AlertInput {
  account_id: string;
  client_id: string | null;
  entity_level: string;
  entity_id: string;
  entity_name: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  reason: string;
  metric_value?: number;
  metric_baseline?: number;
  delta_pct?: number;
  metadata?: Record<string, unknown>;
}

async function upsertAlerts(alerts: AlertInput[]) {
  if (!alerts.length) return;
  // Desativa alertas anteriores do mesmo tipo para evitar duplicatas
  for (const a of alerts) {
    await supabase.from("ai_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("account_id", a.account_id)
      .eq("entity_id", a.entity_id)
      .eq("alert_type", a.alert_type)
      .eq("status", "active");
  }
  await supabase.from("ai_alerts").insert(alerts.map(a => ({
    ...a, status: "active", created_at: new Date().toISOString(),
  })));
}

function detectAlerts(
  entityId: string, entityName: string, accountId: string, clientId: string | null,
  level: string, spend: number, leads: number, impressions: number, reach: number, clicks: number,
  prevLeads: number | null, prevCpl: number | null
): AlertInput[] {
  const alerts: AlertInput[] = [];
  const cpl = leads > 0 ? spend / leads : null;
  const freq = reach > 0 ? impressions / reach : null;

  // Zero leads com spend
  if (spend > 5 && leads === 0) {
    alerts.push({
      account_id: accountId, client_id: clientId,
      entity_level: level, entity_id: entityId, entity_name: entityName,
      alert_type: "zero_leads", severity: "critical",
      title: "Sem leads com orçamento ativo",
      reason: `${entityName} gastou R$${spend.toFixed(0)} sem gerar nenhum lead`,
      metric_value: spend, metric_baseline: 0,
    });
  }

  // CPL spike
  if (cpl !== null && prevCpl !== null && prevCpl > 0) {
    const delta = ((cpl - prevCpl) / prevCpl) * 100;
    if (delta > 30) {
      alerts.push({
        account_id: accountId, client_id: clientId,
        entity_level: level, entity_id: entityId, entity_name: entityName,
        alert_type: "cpl_spike", severity: delta > 60 ? "critical" : "high",
        title: `CPL subiu ${delta.toFixed(0)}%`,
        reason: `CPL passou de R$${prevCpl.toFixed(2)} para R$${cpl.toFixed(2)}`,
        metric_value: cpl, metric_baseline: prevCpl, delta_pct: delta,
      });
    }
  }

  // Frequência alta
  if (freq !== null && freq >= 2.8) {
    alerts.push({
      account_id: accountId, client_id: clientId,
      entity_level: level, entity_id: entityId, entity_name: entityName,
      alert_type: "frequency_fatigue", severity: freq >= 3.5 ? "high" : "medium",
      title: `Frequência elevada: ${freq.toFixed(1)}x`,
      reason: "Audiência saturada — atualize criativos ou expanda o público",
      metric_value: freq, metric_baseline: 2.0,
    });
  }

  return alerts;
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  const isAdmin = session?.role === "admin" || session?.usuario === "lucasantos";
  if (!session || !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const specificAccountId = body.account_id as string | undefined;

  const token = TOKEN();
  if (!token) return NextResponse.json({ error: "META_ADS_ACCESS_TOKEN não configurado" }, { status: 500 });

  // Busca clientes com conta Meta vinculada
  const { data: clients } = await supabase
    .from("trafego_clients")
    .select("id, client_name, meta_account_id")
    .not("meta_account_id", "is", null);

  const targets = (clients || []).filter(c =>
    specificAccountId ? c.meta_account_id === specificAccountId : true
  );

  if (!targets.length) {
    return NextResponse.json({ message: "Nenhuma conta para sincronizar", synced: 0 });
  }

  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const prevSince = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const prevUntil = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const today = until;

  const stats = { synced_accounts: 0, synced_snapshots: 0, synced_creatives: 0, synced_targeting: 0, synced_placements: 0, alerts_generated: 0 };

  for (const client of targets) {
    const accountId = client.meta_account_id!.startsWith("act_")
      ? client.meta_account_id!
      : `act_${client.meta_account_id}`;
    const clientId = client.id;

    console.info(`[ad-intelligence/sync] Processando ${client.client_name} (${accountId})`);

    try {
      // ── 1. Insights por nível ─────────────────────────────────────────────
      const [campaignRows, adsetRows, adRows, prevAdsetRows] = await Promise.all([
        fetchInsightsByLevel(accountId, "campaign", since, until),
        fetchInsightsByLevel(accountId, "adset", since, until),
        fetchInsightsByLevel(accountId, "ad", since, until),
        fetchInsightsByLevel(accountId, "adset", prevSince, prevUntil),
      ]);

      // Mapa do período anterior para delta
      const prevAdsetMap = new Map<string, { leads: number; cpl: number | null }>();
      for (const row of prevAdsetRows) {
        const sp = parseFloat(row.spend || "0");
        const { leads } = parseActions(row.actions, row.action_values);
        prevAdsetMap.set(row.adset_id, { leads, cpl: leads > 0 ? sp / leads : null });
      }

      // Snapshots
      const snapshotRows: any[] = [];
      const allAlerts: AlertInput[] = [];

      for (const row of [...campaignRows, ...adsetRows, ...adRows]) {
        const level = row.ad_id ? "ad" : row.adset_id ? "adset" : "campaign";
        const entityId = level === "ad" ? row.ad_id : level === "adset" ? row.adset_id : row.campaign_id;
        const entityName = level === "ad" ? row.ad_name : level === "adset" ? row.adset_name : row.campaign_name;
        const parentId = level === "ad" ? row.adset_id : level === "adset" ? row.campaign_id : undefined;
        const parentName = level === "ad" ? row.adset_name : level === "adset" ? row.campaign_name : undefined;

        const sp = parseFloat(row.spend || "0");
        const im = parseInt(row.impressions || "0");
        const cl = parseInt(row.clicks || "0");
        const re = parseInt(row.reach || "0");
        const ilc = parseInt(row.inline_link_clicks || "0");
        const { leads } = parseActions(row.actions, row.action_values);

        const cpl = leads > 0 ? sp / leads : null;
        const cpm = im > 0 ? (sp / im) * 1000 : null;
        const ctr = im > 0 ? (cl / im) * 100 : null;
        const cpc = cl > 0 ? sp / cl : null;
        const freq = re > 0 ? im / re : null;
        const score = calcScore(sp, im, cl, leads, re);

        snapshotRows.push({
          snapped_at: today, account_id: accountId, client_id: clientId,
          entity_level: level, entity_id: entityId, entity_name: entityName,
          parent_id: parentId, parent_name: parentName,
          spend: sp, impressions: im, clicks: cl, reach: re, leads, inline_link_clicks: ilc,
          cpl, cpm, ctr, cpc, frequency: freq, score,
        });

        // Detectar alertas no nível adset
        if (level === "adset") {
          const prev = prevAdsetMap.get(entityId || "");
          const detectedAlerts = detectAlerts(
            entityId, entityName, accountId, clientId,
            level, sp, leads, im, re, cl,
            prev?.leads ?? null, prev?.cpl ?? null
          );
          allAlerts.push(...detectedAlerts);
        }
      }

      // Upsert snapshots
      if (snapshotRows.length > 0) {
        const { error: snapErr } = await supabase.from("ai_performance_snapshots")
          .upsert(snapshotRows, { onConflict: "snapped_at,account_id,entity_level,entity_id" });
        if (snapErr) console.error("[sync] snapshot error:", snapErr.message);
        else stats.synced_snapshots += snapshotRows.length;
      }

      // ── 2. Criativos (copy + mídia) ───────────────────────────────────────
      const adsWithCreative = await fetchAdCreatives(accountId);

      // Buscar nomes de adsets e campanhas para enriquecer criativos
      const adsetNameMap = new Map<string, { adset_name: string; campaign_id: string; campaign_name: string }>();
      for (const row of adsetRows) {
        adsetNameMap.set(row.adset_id, {
          adset_name: row.adset_name,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
        });
      }

      const creativeUpserts: any[] = [];
      for (const ad of adsWithCreative) {
        const cr = ad.creative || {};
        const spec = cr.object_story_spec || {};
        const feed = spec.link_data || spec.video_data || {};
        const assetFeed = cr.asset_feed_spec;
        const adsetInfo = adsetNameMap.get(ad.adset_id) || {};

        // Detectar formato
        let format: "image" | "video" | "carousel" | "unknown" = "unknown";
        if (cr.video_id || spec.video_data) format = "video";
        else if (assetFeed?.videos?.length) format = "video";
        else if (feed.child_attachments?.length) format = "carousel";
        else if (cr.image_hash || cr.image_url || feed.picture) format = "image";

        // Carousel cards
        let carouselCards = null;
        if (feed.child_attachments?.length) {
          carouselCards = feed.child_attachments.map((c: any) => ({
            title: c.title || c.name,
            body: c.description,
            url: c.link,
            image_hash: c.image_hash,
          }));
        }

        creativeUpserts.push({
          account_id: accountId, ad_id: ad.id, ad_name: ad.name,
          adset_id: ad.adset_id,
          adset_name: (adsetInfo as any).adset_name || null,
          campaign_id: (adsetInfo as any).campaign_id || null,
          campaign_name: (adsetInfo as any).campaign_name || null,
          format,
          title: feed.name || feed.title || cr.title || assetFeed?.titles?.[0]?.text || null,
          body: feed.message || cr.body || assetFeed?.bodies?.[0]?.text || null,
          description: feed.description || cr.link_description || null,
          call_to_action: feed.call_to_action?.type || cr.call_to_action_type || null,
          link_url: feed.link || cr.object_url || null,
          thumbnail_url: cr.thumbnail_url || cr.image_url || feed.picture || null,
          video_id: cr.video_id || spec.video_data?.video_id || null,
          image_hash: cr.image_hash || feed.image_hash || null,
          carousel_cards: carouselCards,
          raw_story_spec: spec,
          status: ad.status,
          effective_status: ad.effective_status,
          last_fetched_at: new Date().toISOString(),
        });
      }

      if (creativeUpserts.length > 0) {
        const { error: crErr } = await supabase.from("ai_ad_creatives")
          .upsert(creativeUpserts, { onConflict: "ad_id" });
        if (crErr) console.error("[sync] creative error:", crErr.message);
        else stats.synced_creatives += creativeUpserts.length;
      }

      // ── 3. Targeting de adsets ─────────────────────────────────────────────
      const adsets = await fetchAdsetTargeting(accountId);
      const targetingUpserts: any[] = [];

      for (const as_ of adsets) {
        const t = as_.targeting || {};
        targetingUpserts.push({
          account_id: accountId, adset_id: as_.id, adset_name: as_.name,
          campaign_id: as_.campaign_id,
          age_min: t.age_min || null,
          age_max: t.age_max || null,
          genders: t.genders || null,
          geo_locations: t.geo_locations || null,
          interests: t.flexible_spec?.[0]?.interests || null,
          behaviors: t.flexible_spec?.[0]?.behaviors || null,
          custom_audiences: t.custom_audiences || null,
          lookalike_audiences: t.lookalike_audiences || null,
          excluded_audiences: t.excluded_custom_audiences || null,
          publisher_platforms: t.publisher_platforms || null,
          facebook_positions: t.facebook_positions || null,
          instagram_positions: t.instagram_positions || null,
          optimization_goal: as_.optimization_goal || null,
          bid_strategy: as_.bid_strategy || null,
          status: as_.status,
          effective_status: as_.effective_status,
          daily_budget: as_.daily_budget ? parseInt(as_.daily_budget) / 100 : null,
          lifetime_budget: as_.lifetime_budget ? parseInt(as_.lifetime_budget) / 100 : null,
          last_fetched_at: new Date().toISOString(),
        });
      }

      if (targetingUpserts.length > 0) {
        const { error: tErr } = await supabase.from("ai_adset_targeting")
          .upsert(targetingUpserts, { onConflict: "adset_id" });
        if (tErr) console.error("[sync] targeting error:", tErr.message);
        else stats.synced_targeting += targetingUpserts.length;
      }

      // ── 4. Placements ──────────────────────────────────────────────────────
      const placementRows = await fetchPlacementInsights(accountId, since, until);
      const placementUpserts: any[] = [];

      for (const row of placementRows) {
        const sp = parseFloat(row.spend || "0");
        const im = parseInt(row.impressions || "0");
        const cl = parseInt(row.clicks || "0");
        const re = parseInt(row.reach || "0");
        const { leads } = parseActions(row.actions || [], []);
        placementUpserts.push({
          snapped_at: today, account_id: accountId, client_id: clientId,
          placement: row.platform_position || "unknown",
          platform: row.publisher_platform || "unknown",
          spend: sp, impressions: im, clicks: cl, reach: re, leads,
          cpl: leads > 0 ? sp / leads : null,
          ctr: im > 0 ? (cl / im) * 100 : null,
          cpm: im > 0 ? (sp / im) * 1000 : null,
        });
      }

      if (placementUpserts.length > 0) {
        const { error: pErr } = await supabase.from("ai_placement_analysis")
          .upsert(placementUpserts, { onConflict: "snapped_at,account_id,placement,platform" });
        if (pErr) console.error("[sync] placement error:", pErr.message);
        else stats.synced_placements += placementUpserts.length;
      }

      // ── 5. Alertas de criativos desatualizados ─────────────────────────────
      for (const cr of creativeUpserts) {
        if (cr.effective_status === "ACTIVE") {
          const snapshot = snapshotRows.find(s => s.entity_level === "ad" && s.entity_id === cr.ad_id);
          if (snapshot && snapshot.leads === 0 && snapshot.spend > 5) {
            allAlerts.push({
              account_id: accountId, client_id: clientId,
              entity_level: "ad", entity_id: cr.ad_id, entity_name: cr.ad_name,
              alert_type: "zero_leads_ad", severity: "high",
              title: "Anúncio ativo sem conversão",
              reason: `"${cr.ad_name?.slice(0, 60)}" está ativo mas não gerou leads no período`,
              metric_value: snapshot.spend,
            });
          }
        }
      }

      await upsertAlerts(allAlerts);
      stats.alerts_generated += allAlerts.length;
      stats.synced_accounts++;

    } catch (err: any) {
      console.error(`[ad-intelligence/sync] Erro em ${accountId}:`, err.message);
    }
  }

  return NextResponse.json({ ...stats, message: "Sync concluído" });
}
