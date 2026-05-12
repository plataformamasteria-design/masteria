// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== PROMPT v2 — Análise Completa: Atendente + Lead + SLA + Padrões ==========
const ANALYSIS_SYSTEM_PROMPT = `Você é um especialista em análise de vendas e qualidade de atendimento comercial.
Analise a conversa entre ATENDENTE e LEAD considerando 4 dimensões:

═══════════════════════════════════
📊 DIMENSÃO 1: QUALIDADE DO ATENDENTE (0-100)
═══════════════════════════════════

1. **response_time_score**: Velocidade de resposta. 100=instantâneo, 0=sem resposta.
2. **followup_score**: Follow-ups realizados? Voltou a contatar? 100=perfeito, 0=abandonou.
3. **tone_score**: Profissionalismo, empatia. 100=excelente, 0=rude.
4. **cta_score**: CTAs claros (agendar, proposta, confirmar). 100=direcionou bem, 0=sem ação.
5. **clarity_score**: Clareza e boa escrita. 100=perfeito, 0=confuso.
6. **objection_handling_score**: Quebra de objeções. 100=resolveu todas, 0=ignorou.
7. **overall_score**: Média ponderada. Peso: objeções(2x), CTA(1.5x), follow-up(1.5x).

Classificação: 80-100="excellent", 60-79="good", 40-59="needs_improvement", 0-39="poor"

═══════════════════════════════════
🎯 DIMENSÃO 2: QUALIDADE DO LEAD (0-100)
═══════════════════════════════════

1. **engagement_score**: O lead demonstrou interesse? Respondeu rápido? Fez perguntas? 100=muito engajado, 0=ignorou.
2. **response_speed_score**: Velocidade de resposta do lead. 100=respondeu em minutos, 0=dias sem responder.
3. **intent_score**: Sinais de compra (pediu proposta, perguntou preço, quis agendar). 100=pronto pra comprar, 0=sem interesse.
4. **ghost_risk**: Risco do lead sumir (0=vai continuar, 100=vai ghostar). Baseado em: tempo entre respostas, tom curto, falta de engajamento.
5. **overall_quality_score**: Score geral do lead (0-100).
6. **quality_tier**: "hot" (80-100), "warm" (60-79), "cold" (40-59), "dead" (0-39).
7. **intent_signals**: Lista de sinais detectados (ex: ["pediu proposta", "perguntou preço", "quis agendar"]).
8. **objections**: Lista de objeções do lead (ex: ["preço alto", "preciso pensar", "vou ver com sócio"]).
9. **closing_probability**: Probabilidade de fechamento (0-100).
10. **recommended_next_action**: Próxima ação sugerida (ex: "enviar proposta", "agendar reunião", "follow-up em 24h").

═══════════════════════════════════
⏱️ DIMENSÃO 3: COMPLIANCE DE SLA
═══════════════════════════════════

Use os dados de SLA fornecidos no contexto.

1. **sla_first_contact_ok**: O primeiro contato foi dentro do prazo?
2. **sla_first_contact_minutes**: Tempo real do primeiro contato (em minutos).
3. **sla_followup_gaps**: Intervalos entre follow-ups que excederam o máximo (ex: [{"gap_hours": 48, "after_message": 5}]).
4. **sla_total_attempts**: Total de tentativas de contato do atendente.
5. **sla_violations**: Lista de violações (ex: ["primeiro contato demorou 15 min (máx: 5)", "gap de 48h entre follow-ups"]).
6. **sla_compliance_score**: Score geral de conformidade (0-100).

═══════════════════════════════════
🔮 DIMENSÃO 4: PADRÕES DE VENDA
═══════════════════════════════════

1. **sale_stage**: Em que estágio a conversa está? ("prospecting", "qualifying", "presenting", "negotiating", "closing", "lost", "won")
2. **objection_category**: Categoria principal de objeção ("price", "timing", "trust", "need", "competitor", "none")
3. **buying_temperature**: Temperatura de compra em texto descritivo.

Responda APENAS com JSON válido no formato:
{
  "attendance": {
    "overall_score": 75,
    "response_time_score": 80,
    "followup_score": 60,
    "tone_score": 90,
    "cta_score": 70,
    "clarity_score": 85,
    "objection_handling_score": 65,
    "classification": "good",
    "diagnosis": "Resumo em 2-3 frases",
    "strengths": ["ponto 1", "ponto 2"],
    "weaknesses": ["ponto 1", "ponto 2"],
    "suggestions": ["sugestão 1", "sugestão 2"]
  },
  "lead_quality": {
    "engagement_score": 85,
    "response_speed_score": 70,
    "intent_score": 60,
    "ghost_risk": 20,
    "overall_quality_score": 72,
    "quality_tier": "warm",
    "intent_signals": ["pediu proposta"],
    "objections": ["preço alto"],
    "closing_probability": 55,
    "recommended_next_action": "enviar proposta personalizada"
  },
  "sla_compliance": {
    "sla_first_contact_ok": true,
    "sla_first_contact_minutes": 3,
    "sla_followup_gaps": [],
    "sla_total_attempts": 5,
    "sla_violations": [],
    "sla_compliance_score": 95
  },
  "sale_patterns": {
    "sale_stage": "qualifying",
    "objection_category": "price",
    "buying_temperature": "Morno — demonstrou interesse mas tem objeção de preço"
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

    const { chat_id, organization_id } = await req.json();
    if (!chat_id || !organization_id) {
      return new Response(JSON.stringify({ error: "chat_id and organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get API key
    const { data: apiKeyCfg } = await supabase
      .from("global_config")
      .select("value")
      .eq("key", "openai_api_key")
      .single();

    if (!apiKeyCfg?.value) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const openaiKey = apiKeyCfg.value;

    // 2. Get SLA config for this org
    const { data: slaConfig } = await supabase
      .from("sla_config")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    const sla = {
      max_first_contact_minutes: slaConfig?.max_first_contact_minutes || 5,
      max_followup_interval_hours: slaConfig?.max_followup_interval_hours || 24,
      min_contact_attempts: slaConfig?.min_contact_attempts || 3,
    };

    // 3. Fetch messages
    const { data: messages, error: msgsError } = await supabase
      .from("messages")
      .select("id, content, is_from_user, created_at, sender_name")
      .eq("chat_id", chat_id)
      .order("created_at", { ascending: true });

    if (msgsError) throw msgsError;

    const msgs = messages || [];
    if (msgs.length < 2) {
      return new Response(JSON.stringify({ error: "Conversas com menos de 2 mensagens não podem ser analisadas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Format conversation
    const recentMsgs = msgs.slice(-100);
    const conversationText = recentMsgs.map(m => {
      const sender = m.is_from_user ? "LEAD" : "ATENDENTE";
      const time = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const content = (m.content || "").trim();
      if (!content) return null;
      return `[${time}] ${sender}: ${content}`;
    }).filter(Boolean).join("\n");

    // 5. Compute raw stats
    const agentMsgs = msgs.filter(m => !m.is_from_user);
    const leadMsgs = msgs.filter(m => m.is_from_user);

    let responseTimeMinutes = 0;
    const firstLead = msgs.find(m => m.is_from_user);
    const firstAgent = firstLead ? msgs.find(m => !m.is_from_user && new Date(m.created_at) > new Date(firstLead.created_at)) : null;
    if (firstLead && firstAgent) {
      responseTimeMinutes = Math.round((new Date(firstAgent.created_at).getTime() - new Date(firstLead.created_at).getTime()) / (1000 * 60));
    }

    // 6. Get revenue data for this lead
    let revenuePerLead = 0;
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount")
      .eq("chat_id", chat_id)
      .eq("type", "income");
    
    if (transactions && transactions.length > 0) {
      revenuePerLead = transactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    }

    const contextInfo = `\n\n--- CONTEXTO ---
Total de mensagens: ${msgs.length}
Mensagens do atendente: ${agentMsgs.length}
Mensagens do lead: ${leadMsgs.length}
Tempo de primeira resposta: ${responseTimeMinutes} minutos
Receita gerada por este lead: R$ ${revenuePerLead.toFixed(2)}

--- SLA CONFIG ---
Tempo máximo para primeiro contato: ${sla.max_first_contact_minutes} minutos
Intervalo máximo entre follow-ups: ${sla.max_followup_interval_hours} horas
Mínimo de tentativas de contato: ${sla.min_contact_attempts}`;

    // 7. Call OpenAI
    const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: `Analise esta conversa:\n\n${conversationText}${contextInfo}` },
        ],
      }),
    });

    if (!gptResponse.ok) {
      const errText = await gptResponse.text();
      console.error("[analyze-conversation] OpenAI error:", errText);
      throw new Error(`OpenAI API error: ${gptResponse.status}`);
    }

    const gptData = await gptResponse.json();
    const aiContent = gptData.choices?.[0]?.message?.content || "{}";

    let analysis;
    try {
      analysis = JSON.parse(aiContent);
    } catch {
      console.error("[analyze-conversation] Failed to parse AI response:", aiContent);
      throw new Error("AI returned invalid JSON");
    }

    const att = analysis.attendance || {};
    const lq = analysis.lead_quality || {};
    const slac = analysis.sla_compliance || {};
    const sp = analysis.sale_patterns || {};

    const clamp = (v: number) => Math.min(100, Math.max(0, v || 0));

    // 8. Save to ai_conversation_analysis (expanded)
    const analysisData = {
      chat_id,
      organization_id,
      // Attendance scores
      overall_score: clamp(att.overall_score),
      response_time_score: clamp(att.response_time_score),
      followup_score: clamp(att.followup_score),
      tone_score: clamp(att.tone_score),
      cta_score: clamp(att.cta_score),
      clarity_score: clamp(att.clarity_score),
      objection_handling_score: clamp(att.objection_handling_score),
      classification: att.classification || "poor",
      diagnosis: att.diagnosis || "",
      suggestions: att.suggestions || [],
      strengths: att.strengths || [],
      weaknesses: att.weaknesses || [],
      // Lead quality (new)
      lead_quality_score: clamp(lq.overall_quality_score),
      lead_quality_tier: lq.quality_tier || "cold",
      intent_signals: lq.intent_signals || [],
      objections_detected: lq.objections || [],
      closing_probability: clamp(lq.closing_probability),
      // SLA (new)
      sla_violations: slac.sla_violations || [],
      // Revenue (new)
      revenue_per_lead: revenuePerLead,
      // Sale patterns (new)
      sale_patterns: sp,
      // Raw
      raw_analysis: {
        total_messages: msgs.length,
        agent_messages: agentMsgs.length,
        lead_messages: leadMsgs.length,
        response_time_minutes: responseTimeMinutes,
        model: "gpt-4o-mini",
        tokens_used: gptData.usage?.total_tokens || 0,
      },
      analyzed_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("ai_conversation_analysis")
      .upsert(analysisData, { onConflict: "chat_id" });

    if (upsertError) {
      console.error("[analyze-conversation] Upsert error:", upsertError);
      throw upsertError;
    }

    // 9. Save to lead_quality_scores (new table)
    const leadScoreData = {
      chat_id,
      organization_id,
      engagement_score: clamp(lq.engagement_score),
      response_speed_score: clamp(lq.response_speed_score),
      intent_score: clamp(lq.intent_score),
      ghost_risk: clamp(lq.ghost_risk),
      overall_quality_score: clamp(lq.overall_quality_score),
      quality_tier: lq.quality_tier || "cold",
      intent_signals: lq.intent_signals || [],
      objections: lq.objections || [],
      objection_count: (lq.objections || []).length,
      sla_first_contact_minutes: slac.sla_first_contact_minutes || responseTimeMinutes,
      sla_first_contact_ok: slac.sla_first_contact_ok ?? (responseTimeMinutes <= sla.max_first_contact_minutes),
      sla_followup_gaps: slac.sla_followup_gaps || [],
      sla_total_attempts: slac.sla_total_attempts || agentMsgs.length,
      sla_violations: slac.sla_violations || [],
      sla_compliance_score: clamp(slac.sla_compliance_score),
      closing_probability: clamp(lq.closing_probability),
      recommended_next_action: lq.recommended_next_action || "",
      revenue_per_lead: revenuePerLead,
      analyzed_at: new Date().toISOString(),
    };

    const { error: leadScoreError } = await supabase
      .from("lead_quality_scores")
      .upsert(leadScoreData, { onConflict: "chat_id" });

    if (leadScoreError) {
      console.error("[analyze-conversation] Lead score upsert error:", leadScoreError);
    }

    return new Response(
      JSON.stringify({ analysis: analysisData, lead_quality: leadScoreData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[analyze-conversation] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
