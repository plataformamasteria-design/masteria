import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

const CAC_THRESHOLD = 800;

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
    const [
      { data: adsPerf },
      { data: adsMeta },
      { data: leads },
      { data: contratos },
      { data: closers },
    ] = await Promise.all([
      supabase
        .from("ads_performance")
        .select("ad_id, data_ref, spend, leads, impressoes, cliques")
        .gte("data_ref", startDate)
        .lte("data_ref", endDate),
      supabase
        .from("ads_metadata")
        .select("ad_id, ad_name, campaign_id, campaign_name, adset_id, adset_name, status"),
      supabase
        .from("leads_crm")
        .select("id, ad_id, campaign_id, etapa, contrato_id, nome, ghl_created_at, canal_aquisicao")
        .gte("ghl_created_at", startDate + "T00:00:00")
        .lte("ghl_created_at", endDate + "T23:59:59"),
      supabase
        .from("contratos")
        .select("id, mrr, ltv, valor_entrada, data_fechamento, closer_id, lead_id, cliente_nome, status")
        .gte("data_fechamento", startDate)
        .lte("data_fechamento", endDate)
        .eq("status", "ativo"),
      supabase
        .from("closers")
        .select("id, nome"),
    ]);

    const metaMap = new Map((adsMeta || []).map((m) => [m.ad_id, m]));
    const closerMap = new Map((closers || []).map((c) => [c.id, c]));
    const contratoMap = new Map((contratos || []).map((c) => [c.id, c]));

    // Aggregate ads_performance by ad_id
    const perfAgg: Record<string, { spend: number; leads: number; impressoes: number; cliques: number }> = {};
    for (const row of adsPerf || []) {
      if (!perfAgg[row.ad_id]) perfAgg[row.ad_id] = { spend: 0, leads: 0, impressoes: 0, cliques: 0 };
      const a = perfAgg[row.ad_id];
      a.spend += Number(row.spend || 0);
      a.leads += Number(row.leads || 0);
      a.impressoes += Number(row.impressoes || 0);
      a.cliques += Number(row.cliques || 0);
    }

    // Build lead-to-contrato map via contrato_id on lead OR lead_id on contrato
    const leadContratoMap = new Map<string, typeof contratos extends (infer T)[] | null ? T : never>();
    for (const lead of leads || []) {
      if (lead.contrato_id) {
        const c = contratoMap.get(lead.contrato_id);
        if (c) leadContratoMap.set(lead.id, c);
      }
    }
    // Also map from contrato.lead_id
    for (const c of contratos || []) {
      if (c.lead_id && !leadContratoMap.has(c.lead_id)) {
        leadContratoMap.set(c.lead_id, c);
      }
    }

    // Attribution: 3 tiers
    interface Attribution {
      leadId: string;
      leadName: string;
      adId: string;
      tier: 1 | 2 | 3;
      contrato: { id: string; mrr: number; ltv: number; valor_entrada: number; data_fechamento: string; closer_id: string; cliente_nome: string } | null;
    }

    const attributions: Attribution[] = [];
    const unattributed: Attribution["contrato"][] = [];

    // Find highest-volume active ad for Tier 2 fallback
    const adLeadCounts: Record<string, number> = {};
    for (const lead of leads || []) {
      if (lead.ad_id && perfAgg[lead.ad_id]) {
        adLeadCounts[lead.ad_id] = (adLeadCounts[lead.ad_id] || 0) + 1;
      }
    }
    const topVolumeAdId = Object.entries(adLeadCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    for (const lead of leads || []) {
      const effectiveAdId = lead.ad_id || lead.ad_id;
      const contrato = leadContratoMap.get(lead.id) || null;
      const contratoData = contrato ? {
        id: contrato.id,
        mrr: Number(contrato.mrr || 0),
        ltv: Number(contrato.ltv || 0),
        valor_entrada: Number(contrato.valor_entrada || 0),
        data_fechamento: contrato.data_fechamento,
        closer_id: contrato.closer_id,
        cliente_nome: contrato.cliente_nome,
      } : null;

      if (effectiveAdId && (perfAgg[effectiveAdId] || metaMap.has(effectiveAdId))) {
        // Tier 1 - Exact
        attributions.push({
          leadId: lead.id,
          leadName: lead.nome || lead.id,
          adId: effectiveAdId,
          tier: 1,
          contrato: contratoData,
        });
      } else if (
        (lead.canal_aquisicao?.toLowerCase().includes("meta") ||
         lead.canal_aquisicao?.toLowerCase().includes("trafego") ||
         lead.canal_aquisicao?.toLowerCase().includes("ads")) &&
        topVolumeAdId
      ) {
        // Tier 2 - Probabilistic
        attributions.push({
          leadId: lead.id,
          leadName: lead.nome || lead.id,
          adId: topVolumeAdId,
          tier: 2,
          contrato: contratoData,
        });
      } else {
        // Tier 3 - Unattributed
        if (contratoData) unattributed.push(contratoData);
      }
    }

    // Aggregate by ad_id
    interface RankingAd {
      ad_id: string;
      ad_name: string;
      campaign_name: string;
      spend: number;
      leads: number;
      contratos_atribuidos: number;
      mrr_gerado: number;
      ltv_gerado: number;
      cac_real: number | null;
      roas_real: number | null;
      attribution_tier: 1 | 2 | 3;
      tier1_count: number;
      tier2_count: number;
      // Detail: list of contracts for sheet
      contracts_detail: {
        lead_name: string;
        data_fechamento: string;
        mrr: number;
        closer_name: string;
        tier: 1 | 2;
      }[];
      // Weekly data for chart
      weekly_leads: Record<string, number>;
      weekly_contratos: Record<string, number>;
      // CPL comparison
      cpl_ad: number | null;
      cpl_account_avg: number | null;
    }

    const rankingMap: Record<string, RankingAd> = {};

    function ensureAd(adId: string): RankingAd {
      if (!rankingMap[adId]) {
        const meta = metaMap.get(adId);
        const perf = perfAgg[adId];
        rankingMap[adId] = {
          ad_id: adId,
          ad_name: meta?.ad_name || adId,
          campaign_name: meta?.campaign_name || "—",
          spend: perf?.spend || 0,
          leads: perf?.leads || 0,
          contratos_atribuidos: 0,
          mrr_gerado: 0,
          ltv_gerado: 0,
          cac_real: null,
          roas_real: null,
          attribution_tier: 1,
          tier1_count: 0,
          tier2_count: 0,
          contracts_detail: [],
          weekly_leads: {},
          weekly_contratos: {},
          cpl_ad: null,
          cpl_account_avg: null,
        };
      }
      return rankingMap[adId];
    }

    // Helper to get ISO week key (YYYY-Www)
    function weekKey(dateStr: string): string {
      const d = new Date(dateStr);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    }

    for (const attr of attributions) {
      const ad = ensureAd(attr.adId);

      if (attr.tier === 1) ad.tier1_count++;
      else ad.tier2_count++;

      // Weekly leads
      const lead = (leads || []).find((l) => l.id === attr.leadId);
      if (lead?.ghl_created_at) {
        const wk = weekKey(lead.ghl_created_at);
        ad.weekly_leads[wk] = (ad.weekly_leads[wk] || 0) + 1;
      }

      if (attr.contrato) {
        ad.contratos_atribuidos++;
        ad.mrr_gerado += attr.contrato.mrr;
        ad.ltv_gerado += attr.contrato.ltv;

        const closer = closerMap.get(attr.contrato.closer_id);
        ad.contracts_detail.push({
          lead_name: attr.leadName,
          data_fechamento: attr.contrato.data_fechamento,
          mrr: attr.contrato.mrr,
          closer_name: closer?.nome || "—",
          tier: attr.tier as 1 | 2,
        });

        const wk = weekKey(attr.contrato.data_fechamento);
        ad.weekly_contratos[wk] = (ad.weekly_contratos[wk] || 0) + 1;
      }
    }

    // Calculate CAC, ROAS, CPL, attribution tier
    const totalSpendAccount = Object.values(perfAgg).reduce((s, p) => s + p.spend, 0);
    const totalLeadsAccount = Object.values(perfAgg).reduce((s, p) => s + p.leads, 0);
    const cplAccountAvg = totalLeadsAccount > 0 ? totalSpendAccount / totalLeadsAccount : null;

    for (const ad of Object.values(rankingMap)) {
      if (ad.contratos_atribuidos > 0 && ad.spend > 0) {
        ad.cac_real = ad.spend / ad.contratos_atribuidos;
      }
      if (ad.spend > 0 && ad.ltv_gerado > 0) {
        ad.roas_real = ad.ltv_gerado / ad.spend;
      }
      if (ad.leads > 0 && ad.spend > 0) {
        ad.cpl_ad = ad.spend / ad.leads;
      }
      ad.cpl_account_avg = cplAccountAvg;
      // Determine dominant tier
      ad.attribution_tier = ad.tier1_count >= ad.tier2_count ? 1 : 2;
    }

    // Build unattributed row
    const unattributedRow = {
      ad_id: "__unattributed__",
      ad_name: "Nao Atribuido",
      campaign_name: "—",
      spend: 0,
      leads: 0,
      contratos_atribuidos: unattributed.length,
      mrr_gerado: unattributed.reduce((s, c) => s + (c?.mrr || 0), 0),
      ltv_gerado: unattributed.reduce((s, c) => s + (c?.ltv || 0), 0),
      cac_real: null,
      roas_real: null,
      attribution_tier: 3 as const,
      tier1_count: 0,
      tier2_count: 0,
      contracts_detail: [] as RankingAd["contracts_detail"],
      weekly_leads: {} as Record<string, number>,
      weekly_contratos: {} as Record<string, number>,
      cpl_ad: null,
      cpl_account_avg: cplAccountAvg,
    };

    const ranking = [
      ...Object.values(rankingMap).sort((a, b) => b.mrr_gerado - a.mrr_gerado),
      ...(unattributed.length > 0 ? [unattributedRow] : []),
    ];

    // Summary cards
    const attributed = Object.values(rankingMap);
    const bestCac = attributed.filter((a) => a.cac_real !== null).sort((a, b) => (a.cac_real || Infinity) - (b.cac_real || Infinity))[0] || null;
    const bestMrr = attributed.sort((a, b) => b.mrr_gerado - a.mrr_gerado)[0] || null;
    const bestRoas = attributed.filter((a) => a.roas_real !== null).sort((a, b) => (b.roas_real || 0) - (a.roas_real || 0))[0] || null;

    const totalLeads = (leads || []).length;
    const tier1Total = attributed.reduce((s, a) => s + a.tier1_count, 0);
    const pctExact = totalLeads > 0 ? (tier1Total / totalLeads) * 100 : 0;

    return NextResponse.json({
      ranking,
      summary: {
        best_cac: bestCac ? { ad_name: bestCac.ad_name, value: bestCac.cac_real } : null,
        best_mrr: bestMrr ? { ad_name: bestMrr.ad_name, value: bestMrr.mrr_gerado } : null,
        best_roas: bestRoas ? { ad_name: bestRoas.ad_name, value: bestRoas.roas_real } : null,
        pct_exact: pctExact,
      },
      cac_threshold: CAC_THRESHOLD,
      total_leads: totalLeads,
    });
  } catch (e) {
    console.error("[ad-intelligence/ranking]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
