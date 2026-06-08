import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

const ETAPA_QUALIFICADO = ["qualificado", "lead_qualificado", "reuniao_agendada", "reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
const ETAPA_REUNIAO = ["reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
const ETAPA_CONTRATO = ["assinatura_contrato", "comprou"];

export async function GET(req: NextRequest) {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  try {
    // Fetch all data in parallel (single batch, no N+1)
    const [
      { data: adsPerf },
      { data: adsMeta },
      { data: leads },
      { data: contratos },
      { data: creativeScores },
    ] = await Promise.all([
      supabase
        .from("ads_performance")
        .select("ad_id, data_ref, spend, leads, impressoes, cliques, cpl, ctr, cpc")
        .eq("cliente_id", user.companyId)
        .gte("data_ref", startDate)
        .lte("data_ref", endDate),
      supabase
        .from("ads_metadata")
        .select("ad_id, ad_name, campaign_id, campaign_name, adset_id, adset_name, status, thumbnail_url, image_url, ad_body, ad_title")
        .eq("cliente_id", user.companyId),
      supabase
        .from("leads_crm")
        .select("id, ad_id, campaign_id, etapa, contrato_id, nome, ghl_created_at, canal_aquisicao")
        .eq("cliente_id", user.companyId)
        .gte("ghl_created_at", startDate + "T00:00:00")
        .lte("ghl_created_at", endDate + "T23:59:59"),
      supabase
        .from("contratos")
        .select("id, mrr, valor_entrada, valor_total_projeto, data_fechamento, lead_id, status")
        .eq("cliente_id", user.companyId)
        .gte("data_fechamento", startDate)
        .lte("data_fechamento", endDate)
        .neq("status", "rascunho"),
      supabase
        .from("creative_scores")
        .select("ad_id, composite_score, alert_status, alert_message")
        .eq("cliente_id", user.companyId)
        .order("composite_score", { ascending: false }),
    ]);

    // Build maps
    const metaMap = new Map((adsMeta || []).map((m) => [m.ad_id, m]));
    const contratoMap = new Map((contratos || []).map((c) => [c.id, c]));
    // Also map contrato by lead_id for bidirectional lookup
    const contratoByLeadMap = new Map<string, typeof contratos extends (infer T)[] | null ? T : never>();
    for (const c of contratos || []) {
      if (c.lead_id) contratoByLeadMap.set(c.lead_id, c);
    }
    const scoreMap = new Map((creativeScores || []).map((s) => [s.ad_id, s]));

    // Aggregate ads_performance by ad_id
    const perfAgg: Record<string, { spend: number; leads: number; impressoes: number; cliques: number; minDate: string; maxDate: string }> = {};
    for (const row of adsPerf || []) {
      if (!perfAgg[row.ad_id]) perfAgg[row.ad_id] = { spend: 0, leads: 0, impressoes: 0, cliques: 0, minDate: row.data_ref, maxDate: row.data_ref };
      const a = perfAgg[row.ad_id];
      a.spend += Number(row.spend || 0);
      a.leads += Number(row.leads || 0);
      a.impressoes += Number(row.impressoes || 0);
      a.cliques += Number(row.cliques || 0);
      if (row.data_ref < a.minDate) a.minDate = row.data_ref;
      if (row.data_ref > a.maxDate) a.maxDate = row.data_ref;
    }

    // Attribution: assign leads to ad_ids with tiers
    interface LeadAttribution { leadId: string; adId: string; tier: number; etapa: string; contratoId: string | null }
    const attributions: LeadAttribution[] = [];
    let tierCounts = { exact: 0, probable: 0, manual: 0, campaign: 0, none: 0 };

    // Find highest-volume ad for Tier 2 probabilistic fallback
    const adLeadCounts: Record<string, number> = {};
    for (const lead of leads || []) {
      if (lead.ad_id && perfAgg[lead.ad_id]) {
        adLeadCounts[lead.ad_id] = (adLeadCounts[lead.ad_id] || 0) + 1;
      }
    }
    const topVolumeAdId = Object.entries(adLeadCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    for (const lead of leads || []) {
      if (lead.ad_id && perfAgg[lead.ad_id]) {
        // Tier 1: exact match
        attributions.push({ leadId: lead.id, adId: lead.ad_id, tier: 1, etapa: lead.etapa, contratoId: lead.contrato_id });
        tierCounts.exact++;
      } else if (lead.ad_id && perfAgg[lead.ad_id]) {
        // Tier 3: manual
        attributions.push({ leadId: lead.id, adId: lead.ad_id, tier: 3, etapa: lead.etapa, contratoId: lead.contrato_id });
        tierCounts.manual++;
      } else if (lead.ad_id) {
        // Has ad_id but no matching perf data — still attribute
        attributions.push({ leadId: lead.id, adId: lead.ad_id, tier: 1, etapa: lead.etapa, contratoId: lead.contrato_id });
        tierCounts.exact++;
      } else if (lead.ad_id) {
        attributions.push({ leadId: lead.id, adId: lead.ad_id, tier: 3, etapa: lead.etapa, contratoId: lead.contrato_id });
        tierCounts.manual++;
      } else if (lead.campaign_id) {
        // Tier 4: campaign level — find any ad in this campaign
        const campaignAd = (adsMeta || []).find((m) => m.campaign_id === lead.campaign_id);
        if (campaignAd) {
          attributions.push({ leadId: lead.id, adId: campaignAd.ad_id, tier: 4, etapa: lead.etapa, contratoId: lead.contrato_id });
          tierCounts.campaign++;
        } else {
          tierCounts.none++;
        }
      } else if (
        (lead.canal_aquisicao?.toLowerCase().includes("meta") ||
         lead.canal_aquisicao?.toLowerCase().includes("trafego") ||
         lead.canal_aquisicao?.toLowerCase().includes("ads")) &&
        topVolumeAdId
      ) {
        // Tier 2: probable — Meta origin but no ad_id, attribute to highest-volume ad
        attributions.push({ leadId: lead.id, adId: topVolumeAdId, tier: 2, etapa: lead.etapa, contratoId: lead.contrato_id });
        tierCounts.probable++;
      } else {
        tierCounts.none++;
      }
    }

    // Aggregate by ad_id
    interface AdFunnel {
      ad_id: string;
      ad_name: string;
      campaign_name: string;
      adset_name: string;
      status: string;
      thumbnail_url: string | null;
      image_url: string | null;
      ad_body: string | null;
      ad_title: string | null;
      // Traffic metrics
      spend: number;
      impressoes: number;
      cliques: number;
      leadsAds: number;
      cpl: number;
      periodo: string;
      // Funnel metrics
      leadsCrm: number;
      leadsQualificados: number;
      reunioesFeitas: number;
      contratosFechados: number;
      mrrGerado: number;
      entradaGerada: number;
      ltvGerado: number;
      // Tier breakdown
      tier1: number;
      tier2: number;
      tier3: number;
      tier4: number;
      // Score
      compositeScore: number;
      alertStatus: string;
      alertMessage: string | null;
    }

    const adFunnels: Record<string, AdFunnel> = {};

    // Initialize from ads_performance
    for (const [adId, perf] of Object.entries(perfAgg)) {
      const meta = metaMap.get(adId);
      const score = scoreMap.get(adId);
      adFunnels[adId] = {
        ad_id: adId,
        ad_name: meta?.ad_name || adId,
        campaign_name: meta?.campaign_name || "—",
        adset_name: meta?.adset_name || "—",
        status: meta?.status || "—",
        thumbnail_url: meta?.thumbnail_url || null,
        image_url: meta?.image_url || null,
        ad_body: meta?.ad_body || null,
        ad_title: meta?.ad_title || null,
        spend: perf.spend,
        impressoes: perf.impressoes,
        cliques: perf.cliques,
        leadsAds: perf.leads,
        cpl: perf.leads > 0 ? perf.spend / perf.leads : 0,
        periodo: `${perf.minDate} → ${perf.maxDate}`,
        leadsCrm: 0, leadsQualificados: 0, reunioesFeitas: 0,
        contratosFechados: 0, mrrGerado: 0, entradaGerada: 0, ltvGerado: 0,
        tier1: 0, tier2: 0, tier3: 0, tier4: 0,
        compositeScore: score?.composite_score || 0,
        alertStatus: score?.alert_status || "ok",
        alertMessage: score?.alert_message || null,
      };
    }

    // Apply attributions
    for (const attr of attributions) {
      if (!adFunnels[attr.adId]) {
        const meta = metaMap.get(attr.adId);
        const score = scoreMap.get(attr.adId);
        adFunnels[attr.adId] = {
          ad_id: attr.adId,
          ad_name: meta?.ad_name || attr.adId,
          campaign_name: meta?.campaign_name || "—",
          adset_name: meta?.adset_name || "—",
          status: meta?.status || "—",
          thumbnail_url: meta?.thumbnail_url || null,
          image_url: meta?.image_url || null,
          ad_body: meta?.ad_body || null,
          ad_title: meta?.ad_title || null,
          spend: 0, impressoes: 0, cliques: 0, leadsAds: 0, cpl: 0, periodo: "—",
          leadsCrm: 0, leadsQualificados: 0, reunioesFeitas: 0,
          contratosFechados: 0, mrrGerado: 0, entradaGerada: 0, ltvGerado: 0,
          tier1: 0, tier2: 0, tier3: 0, tier4: 0,
          compositeScore: score?.composite_score || 0,
          alertStatus: score?.alert_status || "ok",
          alertMessage: score?.alert_message || null,
        };
      }

      const f = adFunnels[attr.adId];
      f.leadsCrm++;
      if (attr.tier === 1) f.tier1++;
      else if (attr.tier === 2) f.tier2++;
      else if (attr.tier === 3) f.tier3++;
      else f.tier4++;

      if (ETAPA_QUALIFICADO.includes(attr.etapa)) f.leadsQualificados++;
      if (ETAPA_REUNIAO.includes(attr.etapa)) f.reunioesFeitas++;
      if (ETAPA_CONTRATO.includes(attr.etapa)) {
        f.contratosFechados++;
        // Try contrato_id first, then fallback to lead_id lookup
        const c = attr.contratoId
          ? contratoMap.get(attr.contratoId)
          : contratoByLeadMap.get(attr.leadId);
        if (c) {
          f.mrrGerado += Number(c.mrr || 0);
          f.entradaGerada += Number(c.valor_entrada || 0);
          f.ltvGerado += Number(c.valor_total_projeto || 0);
        }
      }
    }

    const result = Object.values(adFunnels).sort((a, b) => b.leadsCrm - a.leadsCrm || b.spend - a.spend);

    return NextResponse.json({
      ads: result,
      tierCounts,
      totalLeads: (leads || []).length,
      periodo: { startDate, endDate },
    });
  } catch (e) {
    console.error("[ad-intelligence/funnel]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
