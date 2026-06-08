import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI, getModelName } from "@/lib/ai-client";
import { checkAIBudget, logAIUsage, estimateTokens } from "@/lib/ai-budget";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

export async function POST(req: NextRequest) {
  const { error: authError, user } = await verifySession();
  if (authError || !user) return authError;

  const guard = await checkAIBudget("/api/ad-intelligence/relatorio");
  if (guard.error) return guard.error;

  try {
    const { startDate, endDate, formato } = await req.json();
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    const [{ data: adsPerf }, { data: adsMeta }, { data: leads }, { data: contratos }] = await Promise.all([
      supabase.from("ads_performance").select("ad_id, spend, leads, cpl").eq("cliente_id", user.companyId).gte("data_ref", startDate).lte("data_ref", endDate),
      supabase.from("ads_metadata").select("ad_id, ad_name, campaign_name, status").eq("cliente_id", user.companyId),
      supabase.from("leads_crm").select("id, ad_id, etapa, contrato_id").eq("cliente_id", user.companyId).gte("ghl_created_at", startDate + "T00:00:00").lte("ghl_created_at", endDate + "T23:59:59"),
      supabase.from("contratos").select("id, mrr, valor_entrada, valor_total_projeto, data_fechamento").eq("cliente_id", user.companyId).gte("data_fechamento", startDate).lte("data_fechamento", endDate).neq("status", "rascunho"),
    ]);

    const metaMap = new Map((adsMeta || []).map((m) => [m.ad_id, m]));
    const contratoMap = new Map((contratos || []).map((c) => [c.id, c]));

    const adAgg: Record<string, { name: string; campaign: string; spend: number; leadsAds: number; leadsCrm: number; qualificados: number; reunioes: number; fechados: number; mrr: number; ltv: number }> = {};
    for (const row of adsPerf || []) {
      if (!adAgg[row.ad_id]) {
        const meta = metaMap.get(row.ad_id);
        adAgg[row.ad_id] = { name: meta?.ad_name || row.ad_id, campaign: meta?.campaign_name || "—", spend: 0, leadsAds: 0, leadsCrm: 0, qualificados: 0, reunioes: 0, fechados: 0, mrr: 0, ltv: 0 };
      }
      adAgg[row.ad_id].spend += Number(row.spend || 0);
      adAgg[row.ad_id].leadsAds += Number(row.leads || 0);
    }

    const etapaQualif = ["qualificado", "lead_qualificado", "reuniao_agendada", "reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
    const etapaFechado = ["assinatura_contrato", "comprou"];

    for (const lead of leads || []) {
      const adId = lead.ad_id || lead.ad_id;
      if (!adId || !adAgg[adId]) continue;
      adAgg[adId].leadsCrm++;
      if (etapaQualif.includes(lead.etapa)) adAgg[adId].qualificados++;
      if (etapaFechado.includes(lead.etapa)) {
        adAgg[adId].fechados++;
        if (lead.contrato_id) {
          const c = contratoMap.get(lead.contrato_id);
          if (c) {
            adAgg[adId].mrr += Number(c.mrr || 0);
            adAgg[adId].ltv += Number(c.valor_total_projeto || 0);
          }
        }
      }
    }

    const allAds = Object.values(adAgg);
    const totalSpend = allAds.reduce((s, a) => s + a.spend, 0);
    const totalLeadsAds = allAds.reduce((s, a) => s + a.leadsAds, 0);
    const totalLeadsCrm = (leads || []).length;
    const totalFechados = allAds.reduce((s, a) => s + a.fechados, 0);
    const totalMrr = allAds.reduce((s, a) => s + a.mrr, 0);
    const totalLtv = allAds.reduce((s, a) => s + a.ltv, 0);
    const cplMedio = totalLeadsAds > 0 ? totalSpend / totalLeadsAds : 0;
    const roasEstimado = totalSpend > 0 ? totalLtv / totalSpend : 0;

    const top5 = [...allAds].sort((a, b) => b.fechados - a.fechados || b.mrr - a.mrr).slice(0, 5);
    const toPause = [...allAds].filter((a) => a.spend > 100 && a.leadsAds > 0 && a.fechados === 0).sort((a, b) => b.spend - a.spend).slice(0, 5);

    const dadosJson = JSON.stringify({
      periodo: { inicio: startDate, fim: endDate },
      resumo: { investimento: totalSpend, leads_ads: totalLeadsAds, leads_crm: totalLeadsCrm, cpl_medio: cplMedio, contratos: totalFechados, mrr_total: totalMrr, ltv_total: totalLtv, roas_estimado: roasEstimado },
      top_criativos: top5.map((a) => ({ nome: a.name, campanha: a.campaign, spend: a.spend, leads: a.leadsAds, fechados: a.fechados, mrr: a.mrr, cpl: a.leadsAds > 0 ? a.spend / a.leadsAds : 0 })),
      candidatos_pausa: toPause.map((a) => ({ nome: a.name, campanha: a.campaign, spend: a.spend, leads: a.leadsAds, fechados: 0, cpl: a.leadsAds > 0 ? a.spend / a.leadsAds : 0 })),
      total_anuncios: allAds.length,
    }, null, 2);

    const isDetalhado = formato === "detalhado";
    const prompt = `Gere um relatorio de trafego pago para o periodo ${startDate} a ${endDate}. Formato: ${isDetalhado ? "analise detalhada e profunda" : "resumo executivo conciso"}.

Estrutura obrigatoria:
1. Resumo do periodo (investimento, leads, CPL, ROAS estimado)
2. Top 3 criativos com analise de POR QUE performaram bem
3. Criativos para pausar com justificativa
4. Recomendacao para proximo periodo

Dados: ${dadosJson}`;

    const result = await callAI({
      provider: "openai",
      systemPrompt: "Voce e um analista de trafego pago senior especializado no mercado juridico brasileiro. Gere relatorios profissionais em portugues com markdown. Seja direto e acionavel.",
      userContent: prompt,
      maxTokens: isDetalhado ? 3000 : 1500,
      companyId: user.companyId,
    });

    logAIUsage(guard.userId, "openai", getModelName("openai"), estimateTokens(prompt + result.text), "/api/ad-intelligence/relatorio");

    return NextResponse.json({ relatorio: result.text, periodo: { startDate, endDate } });
  } catch (e) {
    console.error("[ad-intelligence/relatorio]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
