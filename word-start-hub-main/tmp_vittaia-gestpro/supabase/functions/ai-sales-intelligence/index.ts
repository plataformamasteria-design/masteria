// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTELLIGENCE_PROMPT = `Você é um analista de inteligência comercial especializado em vendas B2B/B2C.
Analise os dados agregados da organização e gere insights acionáveis.

Dados fornecidos:
- Resumo de conversas analisadas (scores, objeções, padrões)
- Performance de closers
- Métricas de funil

Gere insights nas seguintes categorias:

1. **PADRÕES DE VENDA**: Qual tipo de lead fecha mais? Qual abordagem funciona?
2. **OBJEÇÕES**: Objeções mais frequentes, sugestões de script para quebrá-las.
3. **COACHING**: Comparação entre top closer e closers médios. O que o top faz de diferente?
4. **GARGALOS**: Onde o funil está perdendo leads? Anomalias detectadas.
5. **FORECAST**: Previsão de receita baseada nos dados atuais.

Responda com JSON:
{
  "insights": [
    {
      "type": "sale_pattern|objection|coaching|bottleneck|forecast",
      "title": "Título curto e claro",
      "description": "Descrição detalhada com dados de suporte",
      "action": "scale|pause|improve|adjust|alert|celebrate",
      "confidence": 85,
      "data": { "metric": "value" }
    }
  ],
  "closer_benchmarks": [
    {
      "user_id": "uuid",
      "name": "Nome",
      "tier": "top|above_average|average|below_average|needs_training",
      "strengths": ["ponto 1"],
      "weaknesses": ["ponto 1"],
      "coaching_tips": ["dica 1"],
      "metrics": {
        "conversion_rate": 25,
        "avg_response_time_minutes": 10,
        "total_revenue": 50000,
        "objection_handling_score": 80
      }
    }
  ],
  "forecast": {
    "projected_revenue_next_month": 100000,
    "projected_leads_next_month": 200,
    "projected_conversions": 20,
    "confidence": 70,
    "factors": ["sazonalidade", "tendência de crescimento"]
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, period_months = 1, model = "gemini-2.5-flash" } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let apiUrl = "https://api.openai.com/v1/chat/completions";
    let finalApiKey = null;

    if (model.startsWith("gemini")) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      const { data: gKeys } = await supabase
        .from("global_config")
        .select("key, value")
        .in("key", ["gemini_api_key", "google_api_key_agents1", "google_api_key", "GOOGLE_API_KEY_CALL"]);

      let gVal = null;
      if (gKeys && gKeys.length > 0) {
        const preferred = gKeys.find(k => k.key === "gemini_api_key");
        gVal = preferred ? preferred.value : gKeys[0].value;
      }

      finalApiKey = gVal || Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("google_api_key_agents1") || Deno.env.get("GOOGLE_GEMINI_AGENTS1");
    } else {
      const { data: orgCreds } = await supabase
        .from("ai_agent_credentials")
        .select("api_key")
        .eq("organization_id", organization_id)
        .eq("provider", "openai")
        .limit(1)
        .single();

      finalApiKey = orgCreds?.api_key || Deno.env.get("VHOLI_OPENAI_KEY") || Deno.env.get("OPENAI_API_KEY");

      if (!finalApiKey) {
        const { data: globalOpenAI } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
        finalApiKey = globalOpenAI?.value;
      }
    }

    if (!finalApiKey) {
      return new Response(JSON.stringify({ error: "OpenAI or Gemini API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - period_months);

    // Fetch analyzed conversations
    const { data: analyses } = await supabase
      .from("ai_conversation_analysis")
      .select("*")
      .eq("organization_id", organization_id)
      .gte("analyzed_at", cutoff.toISOString())
      .order("analyzed_at", { ascending: false })
      .limit(200);

    // Fetch lead quality scores
    const { data: leadScores } = await supabase
      .from("lead_quality_scores")
      .select("*")
      .eq("organization_id", organization_id)
      .gte("analyzed_at", cutoff.toISOString())
      .limit(200);

    // Fetch closer performance from chat_assignment_history
    const { data: assignments } = await supabase
      .from("chat_assignment_history")
      .select("assigned_to, chat_id")
      .eq("organization_id", organization_id)
      .gte("assigned_at", cutoff.toISOString());

    // Fetch closer profiles
    const closerIds = [...new Set((assignments || []).map(a => a.assigned_to).filter(Boolean))];
    let closerProfiles: any[] = [];
    if (closerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", closerIds);
      closerProfiles = profiles || [];
    }

    // Fetch diagnostics for financial context
    const { data: diagnostics } = await supabase
      .from("lead_diagnostics")
      .select("*")
      .eq("organization_id", organization_id)
      .order("reference_month", { ascending: false })
      .limit(6);

    // Fetch resolutions
    const { data: resolutions } = await supabase
      .from("chat_resolutions")
      .select("outcome, chat_id, resolved_by, resolved_at")
      .eq("organization_id", organization_id)
      .gte("resolved_at", cutoff.toISOString());

    // Build aggregated data for the prompt
    const allObjections = (analyses || []).flatMap(a => a.objections_detected || []);
    const objectionCounts: Record<string, number> = {};
    allObjections.forEach(o => { objectionCounts[o] = (objectionCounts[o] || 0) + 1; });

    const avgScores = {
      overall: avg((analyses || []).map(a => a.overall_score)),
      lead_quality: avg((leadScores || []).map(l => l.overall_quality_score)),
      closing_prob: avg((leadScores || []).map(l => l.closing_probability)),
      ghost_risk: avg((leadScores || []).map(l => l.ghost_risk)),
    };

    const tierCounts = { hot: 0, warm: 0, cold: 0, dead: 0 };
    (leadScores || []).forEach(l => { tierCounts[l.quality_tier as keyof typeof tierCounts] = (tierCounts[l.quality_tier as keyof typeof tierCounts] || 0) + 1; });

    // Build closer stats
    const closerStats = closerIds.map(cid => {
      const profile = closerProfiles.find(p => p.id === cid);
      const closerChats = (assignments || []).filter(a => a.assigned_to === cid).map(a => a.chat_id);
      const closerAnalyses = (analyses || []).filter(a => closerChats.includes(a.chat_id));
      const closerResolutions = (resolutions || []).filter(r => r.resolved_by === cid);
      const wins = closerResolutions.filter(r => r.outcome === "won").length;
      const total = closerResolutions.length;

      return {
        user_id: cid,
        name: profile?.full_name || "Desconhecido",
        total_leads: closerChats.length,
        total_conversions: wins,
        conversion_rate: total > 0 ? Math.round((wins / total) * 100) : 0,
        avg_overall_score: avg(closerAnalyses.map(a => a.overall_score)),
        avg_objection_score: avg(closerAnalyses.map(a => a.objection_handling_score)),
      };
    });

    const contextData = `
--- DADOS AGREGADOS DA ORGANIZAÇÃO ---
Período: últimos ${period_months} mês(es)
Total de conversas analisadas: ${(analyses || []).length}
Total de leads com score: ${(leadScores || []).length}

--- SCORES MÉDIOS ---
Score médio de atendimento: ${avgScores.overall.toFixed(1)}
Score médio de qualidade do lead: ${avgScores.lead_quality.toFixed(1)}
Probabilidade média de fechamento: ${avgScores.closing_prob.toFixed(1)}%
Risco médio de ghost: ${avgScores.ghost_risk.toFixed(1)}%

--- DISTRIBUIÇÃO DE LEADS ---
Hot: ${tierCounts.hot} | Warm: ${tierCounts.warm} | Cold: ${tierCounts.cold} | Dead: ${tierCounts.dead}

--- OBJEÇÕES MAIS FREQUENTES ---
${Object.entries(objectionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([obj, count]) => `${obj}: ${count}x`).join("\n")}

--- PERFORMANCE DE CLOSERS ---
${closerStats.map(c => `${c.name}: ${c.total_leads} leads, ${c.conversion_rate}% conversão, score atendimento: ${c.avg_overall_score.toFixed(0)}, objeções: ${c.avg_objection_score.toFixed(0)}`).join("\n")}

--- HISTÓRICO FINANCEIRO ---
${(diagnostics || []).map(d => `${d.reference_month}: ${d.total_leads} leads, ${d.contracts_won} contratos, R$${d.ltv_total || 0} receita, R$${d.ad_spend || 0} investimento`).join("\n")}

--- RESOLUÇÕES ---
Total: ${(resolutions || []).length}
Ganhas: ${(resolutions || []).filter(r => r.outcome === "won").length}
Perdidas: ${(resolutions || []).filter(r => r.outcome === "lost").length}
`;

    // Call AI
    const gptResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${finalApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INTELLIGENCE_PROMPT },
          { role: "user", content: contextData },
        ],
      }),
    });

    if (!gptResponse.ok) {
      const errText = await gptResponse.text();
      console.error("[ai-sales-intelligence] OpenAI error:", errText);
      throw new Error(`OpenAI API error: ${gptResponse.status}`);
    }

    const gptData = await gptResponse.json();
    const aiContent = gptData.choices?.[0]?.message?.content || "{}";

    let result;
    try {
      result = JSON.parse(aiContent);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    const period = new Date().toISOString().slice(0, 7); // '2026-03'

    // Save insights
    const insightsToSave = (result.insights || []).map((i: any) => ({
      organization_id,
      insight_type: i.type || "sale_pattern",
      title: i.title,
      description: i.description,
      action: i.action || "improve",
      confidence: i.confidence || 50,
      data: i.data || {},
      status: "active",
      period,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    if (insightsToSave.length > 0) {
      // Clear old active insights for this period
      await supabase
        .from("ai_insights")
        .delete()
        .eq("organization_id", organization_id)
        .eq("period", period)
        .eq("status", "active");

      await supabase.from("ai_insights").insert(insightsToSave);
    }

    // Save closer benchmarks
    const benchmarks = (result.closer_benchmarks || []).filter((b: any) => closerIds.includes(b.user_id));
    for (const b of benchmarks) {
      const closerStat = closerStats.find(c => c.user_id === b.user_id);
      await supabase.from("closer_benchmarks").upsert({
        organization_id,
        user_id: b.user_id,
        period,
        total_leads: closerStat?.total_leads || 0,
        total_conversions: closerStat?.total_conversions || 0,
        conversion_rate: closerStat?.conversion_rate || 0,
        avg_response_time_minutes: b.metrics?.avg_response_time_minutes || 0,
        avg_deal_value: b.metrics?.avg_deal_value || 0,
        total_revenue: b.metrics?.total_revenue || 0,
        followup_consistency_score: b.metrics?.followup_consistency_score || 0,
        objection_handling_score: b.metrics?.objection_handling_score || 0,
        strengths: b.strengths || [],
        weaknesses: b.weaknesses || [],
        coaching_tips: b.coaching_tips || [],
        tier: b.tier || "average",
      }, { onConflict: "organization_id,user_id,period" });
    }

    return new Response(
      JSON.stringify({
        insights_count: insightsToSave.length,
        benchmarks_count: benchmarks.length,
        forecast: result.forecast || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[ai-sales-intelligence] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + (b || 0), 0) / arr.length;
}
