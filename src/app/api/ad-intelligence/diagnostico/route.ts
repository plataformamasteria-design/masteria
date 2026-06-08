import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI, getModelName } from "@/lib/ai-client";
import { checkAIBudget, logAIUsage, estimateTokens } from "@/lib/ai-budget";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

export async function POST(req: NextRequest) {
  const { error: authError, user } = await verifySession();
  if (authError || !user) return authError;

  const guard = await checkAIBudget("/api/ad-intelligence/diagnostico");
  if (guard.error) return guard.error;

  try {
    const { startDate, endDate } = await req.json();
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    // Fetch data for the period
    const [
      { data: adsPerf },
      { data: adsMeta },
      { data: leads },
      { data: contratos },
    ] = await Promise.all([
      supabase.from("ads_performance").select("ad_id, spend, leads, cpl").eq("cliente_id", user.companyId).gte("data_ref", startDate).lte("data_ref", endDate),
      supabase.from("ads_metadata").select("ad_id, ad_name, campaign_name, status").eq("cliente_id", user.companyId),
      supabase.from("leads_crm").select("id, ad_id, etapa, contrato_id").eq("cliente_id", user.companyId).gte("ghl_created_at", startDate + "T00:00:00").lte("ghl_created_at", endDate + "T23:59:59"),
      supabase.from("contratos").select("id, mrr, valor_entrada, valor_total_projeto, data_fechamento").eq("cliente_id", user.companyId).gte("data_fechamento", startDate).lte("data_fechamento", endDate).neq("status", "rascunho"),
    ]);

    // Aggregate
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

    // Attribute leads
    const etapaQualif = ["qualificado", "lead_qualificado", "reuniao_agendada", "reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
    const etapaReuniao = ["reuniao_feita", "proposta_enviada", "negociacao", "follow_up", "assinatura_contrato", "comprou"];
    const etapaFechado = ["assinatura_contrato", "comprou"];

    for (const lead of leads || []) {
      const adId = lead.ad_id || lead.ad_id;
      if (!adId || !adAgg[adId]) continue;
      adAgg[adId].leadsCrm++;
      if (etapaQualif.includes(lead.etapa)) adAgg[adId].qualificados++;
      if (etapaReuniao.includes(lead.etapa)) adAgg[adId].reunioes++;
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
    const totalQualif = allAds.reduce((s, a) => s + a.qualificados, 0);
    const totalReunioes = allAds.reduce((s, a) => s + a.reunioes, 0);
    const totalFechados = allAds.reduce((s, a) => s + a.fechados, 0);
    const totalMrr = allAds.reduce((s, a) => s + a.mrr, 0);

    const top3 = [...allAds].sort((a, b) => b.fechados - a.fechados || b.leadsCrm - a.leadsCrm).slice(0, 3);
    const bottom3 = [...allAds].filter((a) => a.spend > 0 && a.leadsAds > 0).sort((a, b) => (b.spend / b.leadsAds) - (a.spend / a.leadsAds)).slice(0, 3);

    const dadosJson = JSON.stringify({
      resumo: {
        investimento_total: `R$ ${totalSpend.toFixed(2)}`,
        cpl_medio: totalLeadsAds > 0 ? `R$ ${(totalSpend / totalLeadsAds).toFixed(2)}` : "sem dados",
        leads_ads: totalLeadsAds,
        leads_crm: totalLeadsCrm,
        qualificados: totalQualif,
        reunioes: totalReunioes,
        contratos_fechados: totalFechados,
        mrr_total: `R$ ${totalMrr.toFixed(2)}`,
        ltv_total: `R$ ${allAds.reduce((s, a) => s + a.ltv, 0).toFixed(2)}`,
        roas: totalSpend > 0 ? (allAds.reduce((s, a) => s + a.ltv, 0) / totalSpend).toFixed(2) + "x" : "sem dados",
      },
      top_3_anuncios: top3.map((a) => ({
        nome: a.name, campanha: a.campaign,
        leads: a.leadsCrm, qualificados: a.qualificados, reunioes: a.reunioes,
        fechados: a.fechados, mrr: `R$ ${a.mrr.toFixed(2)}`,
        cpl: a.leadsAds > 0 ? `R$ ${(a.spend / a.leadsAds).toFixed(2)}` : "—",
      })),
      bottom_3_cpl_alto: bottom3.map((a) => ({
        nome: a.name, campanha: a.campaign,
        cpl: `R$ ${(a.spend / a.leadsAds).toFixed(2)}`,
        leads: a.leadsAds, fechados: a.fechados,
        investido: `R$ ${a.spend.toFixed(2)}`,
      })),
      total_anuncios: allAds.length,
    }, null, 2);

    const prompt = `Você é um especialista em tráfego pago para o mercado jurídico. Analise os dados abaixo de uma agência de marketing digital e forneça: 1) Diagnóstico de desempenho (o que está funcionando e o que não está), 2) Alertas críticos (anúncios para pausar imediatamente), 3) Oportunidades (anúncios para escalar), 4) Próximos 3 passos prioritários com ação específica. Seja direto e comercial. Dados do período ${startDate} a ${endDate}: ${dadosJson}`;

    const result = await callAI({
      provider: "openai",
      systemPrompt: "Você é um consultor de tráfego pago especializado no mercado jurídico brasileiro. Responda em português, de forma direta e acionável. Use markdown para formatar.",
      userContent: prompt,
      maxTokens: 2000,
      companyId: user.companyId,
    });

    logAIUsage(guard.userId, "openai", getModelName("openai"), estimateTokens(prompt + result.text), "/api/ad-intelligence/diagnostico");

    return NextResponse.json({ diagnostico: result.text, periodo: { startDate, endDate } });
  } catch (e) {
    console.error("[ad-intelligence/diagnostico]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
