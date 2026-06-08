import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";
import { checkAIBudget, logAIUsage, estimateTokens } from "@/lib/ai-budget";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

export async function POST(req: NextRequest) {
  const { error: authError, user } = await verifySession();
  if (authError || !user) return authError;

  const guard = await checkAIBudget("/api/ad-intelligence/diagnostico-auto");
  if (guard.error) return guard.error;

  try {
    const { startDate, endDate } = await req.json();
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    const [{ data: adsPerf }, { data: adsMeta }, { data: leads }] = await Promise.all([
      supabase.from("ads_performance").select("ad_id, spend, leads, cpl").eq("cliente_id", user.companyId).gte("data_ref", startDate).lte("data_ref", endDate),
      supabase.from("ads_metadata").select("ad_id, ad_name, status").eq("cliente_id", user.companyId),
      supabase.from("leads_crm").select("id, ad_id").eq("cliente_id", user.companyId).gte("ghl_created_at", startDate + "T00:00:00").lte("ghl_created_at", endDate + "T23:59:59"),
    ]);

    const metaMap = new Map((adsMeta || []).map((m) => [m.ad_id, m]));
    const adAgg: Record<string, { name: string; spend: number; leadsAds: number; cpl: number }> = {};
    for (const row of adsPerf || []) {
      if (!adAgg[row.ad_id]) {
        const meta = metaMap.get(row.ad_id);
        adAgg[row.ad_id] = { name: meta?.ad_name || row.ad_id, spend: 0, leadsAds: 0, cpl: 0 };
      }
      adAgg[row.ad_id].spend += Number(row.spend || 0);
      adAgg[row.ad_id].leadsAds += Number(row.leads || 0);
    }
    for (const id of Object.keys(adAgg)) {
      const a = adAgg[id];
      a.cpl = a.leadsAds > 0 ? a.spend / a.leadsAds : 0;
    }

    const allAds = Object.entries(adAgg).map(([id, a]) => ({ ad_id: id, ...a }));
    const totalLeads = (leads || []).length;
    const leadsComAd = (leads || []).filter((l) => l.ad_id || l.ad_id).length;
    const pctAtravessamento = totalLeads > 0 ? ((leadsComAd / totalLeads) * 100).toFixed(1) : "0";

    // Score: lower CPL = better, with spend threshold
    const scored = allAds
      .filter((a) => a.leadsAds > 0 && a.spend > 50)
      .map((a) => ({ ...a, score: a.cpl > 0 ? Math.round(100 - Math.min(a.cpl / 2, 100)) : 50 }))
      .sort((a, b) => a.score - b.score);

    const criticos = scored.filter((a) => a.score <= 30).length;
    const tops = scored.filter((a) => a.score >= 80).length;

    const topCreativos = scored.slice(0, 8).map((a) => `${a.name}: spend R$${a.spend.toFixed(0)}, ${a.leadsAds} leads, CPL R$${a.cpl.toFixed(2)}, score ${a.score}`).join("\n");

    const prompt = `Dados de ${allAds.length} criativos (${criticos} criticos, ${tops} tops). Atravessamento Meta→CRM: ${pctAtravessamento}%.
Criativos:
${topCreativos}

Responda EXATAMENTE neste formato JSON (sem markdown):
{"critico":"<1 insight critico em 1 frase>","oportunidade":"<1 oportunidade em 1 frase>","confianca":"Baseado em ${scored.length} criativos com dados completos"}`;

    const result = await callAI({
      provider: "openai",
      systemPrompt: "Voce analisa criativos de ads. Retorne SOMENTE JSON valido, sem texto extra.",
      userContent: prompt,
      maxTokens: 300,
      companyId: user.companyId,
    });

    logAIUsage(guard.userId, "openai", getModelName("openai"), estimateTokens(prompt + result.text), "/api/ad-intelligence/diagnostico-auto");

    try {
      const parsed = JSON.parse(result.text.trim());
      return NextResponse.json(parsed);
    } catch {
      // Try to extract JSON from response
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return NextResponse.json(parsed);
      }
      return NextResponse.json({ error: "Parse error" }, { status: 500 });
    }
  } catch (e) {
    console.error("[diagnostico-auto]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
