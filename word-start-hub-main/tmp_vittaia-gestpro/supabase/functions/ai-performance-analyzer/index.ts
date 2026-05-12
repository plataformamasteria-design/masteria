// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gera insights de performance cruzando campanhas + leads + transações
serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Missing authorization header" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Verify user session manually
        const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });
        const { data: { user }, error: authError } = await userSupabase.auth.getUser();

        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Invalid JWT Token" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { organization_id, period_months = 1, model = "gemini-2.5-flash" } = await req.json();
        if (!organization_id) {
            return new Response(JSON.stringify({ error: "organization_id required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - period_months);
        const startStr = startDate.toISOString();

        // 1. Buscar campanhas com dados
        const { data: campaigns } = await supabase
            .from("marketing_campaigns")
            .select("*")
            .eq("organization_id", organization_id);

        // 2. Buscar leads (chats não-grupo) no período
        const { data: chats } = await supabase
            .from("chats")
            .select("id, assigned_to, resolution_outcome, resolved_at, created_at, meta_campaign_id, loss_reason, ad_name, ad_id, adset_id")
            .eq("organization_id", organization_id)
            .eq("is_group", false)
            .gte("created_at", startStr);

        // 3. Buscar transações
        const { data: transactions } = await supabase
            .from("transactions")
            .select("chat_id, amount, type")
            .eq("organization_id", organization_id)
            .eq("type", "income");

        // 4. Buscar profiles para nomes
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("organization_id", organization_id);

        // 5. Configurações da org para CPA Alvo (se existir no settings)
        const { data: orgData } = await supabase
            .from("organizations")
            .select("settings")
            .eq("id", organization_id)
            .single();

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
        const txByChat = new Map<string, number>();
        for (const t of (transactions || [])) {
            txByChat.set(t.chat_id, (txByChat.get(t.chat_id) || 0) + (t.amount || 0));
        }

        let insights: any[] = [];

        // --- PREPARAÇÃO DOS DADOS PARA A IA ---
        const adsMap = new Map<string, any>();
        const adsetsMap = new Map<string, any>();

        const campaignsData = (campaigns || []).map(c => {
            const campaignLeads = (chats || []).filter((ch: any) => ch.meta_campaign_id === c.campaign_id);
            const conversions = campaignLeads.filter((ch: any) => ch.resolution_outcome === "client").length;
            const revenue = campaignLeads.reduce((sum: number, ch: any) => sum + (txByChat.get(ch.id) || 0), 0);

            // Extract raw ad data
            const raw = c.raw_data as any;
            if (raw?.ads && Array.isArray(raw.ads)) {
                for (const ad of raw.ads) {
                    const adName = ad.ad_name || ad.name;
                    const adsetId = ad.adset_id;
                    const adSpend = parseFloat(ad.spend || "0");

                    if (adName && !adsMap.has(adName)) {
                        adsMap.set(adName, {
                            name: adName,
                            spend: 0,
                            leads: 0,
                            sales: 0,
                            revenue: 0,
                            campaign: c.campaign_name,
                            headline: ad.headline || null,
                            body_text: ad.body_text || null
                        });
                    }
                    if (adName) adsMap.get(adName)!.spend += adSpend;

                    if (adsetId && !adsetsMap.has(adsetId)) {
                        adsetsMap.set(adsetId, { id: adsetId, name: ad.adset_name || adsetId, spend: 0, leads: 0, sales: 0, revenue: 0, campaign: c.campaign_name });
                    }
                    if (adsetId) adsetsMap.get(adsetId)!.spend += adSpend;
                }
            }

            return {
                id: c.campaign_id,
                name: c.campaign_name,
                spend: c.spend || 0,
                revenue,
                roas: c.spend > 0 ? revenue / c.spend : 0,
                ctr: c.ctr || 0,
                cpc: c.cpc || 0,
                leads: campaignLeads.length,
                conversions,
                cpa: conversions > 0 ? (c.spend || 0) / conversions : 0,
                cpl: campaignLeads.length > 0 ? (c.spend || 0) / campaignLeads.length : 0
            };
        });

        const closerMap = new Map<string, { total: number; sold: number; revenue: number }>();
        const lossReasons = new Map<string, number>();

        for (const ch of (chats || [])) {
            // Closers tracking
            if (ch.assigned_to) {
                const curr = closerMap.get(ch.assigned_to) || { total: 0, sold: 0, revenue: 0 };
                curr.total++;
                if (ch.resolution_outcome === "client") {
                    curr.sold++;
                    curr.revenue += txByChat.get(ch.id) || 0;
                }
                closerMap.set(ch.assigned_to, curr);
            }
            // Loss tracking
            if (ch.loss_reason) {
                lossReasons.set(ch.loss_reason, (lossReasons.get(ch.loss_reason) || 0) + 1);
            }
            // Ads tracking
            if (ch.ad_name && adsMap.has(ch.ad_name)) {
                const aD = adsMap.get(ch.ad_name)!;
                aD.leads++;
                if (ch.resolution_outcome === "client") {
                    aD.sales++;
                    aD.revenue += (txByChat.get(ch.id) || 0);
                }
            }
            // Adsets tracking
            if (ch.adset_id && adsetsMap.has(ch.adset_id)) {
                const aS = adsetsMap.get(ch.adset_id)!;
                aS.leads++;
                if (ch.resolution_outcome === "client") {
                    aS.sales++;
                    aS.revenue += (txByChat.get(ch.id) || 0);
                }
            }
        }

        const rawAdsData = Array.from(adsMap.values())
            .map(a => ({ ...a, cpl: a.leads ? a.spend / a.leads : 0, cpa: a.sales ? a.spend / a.sales : 0, roas: a.spend ? a.revenue / a.spend : 0 }))
            .filter(a => a.spend > 0 || a.leads > 0);

        const groupedAdsMap = new Map<string, any>();
        for (const a of rawAdsData) {
            const key = (a.headline || a.body_text) ? `${a.headline}|${a.body_text}` : a.name;
            if (!groupedAdsMap.has(key)) {
                groupedAdsMap.set(key, { ...a, ads_grouped: 1, ad_names: [a.name] });
            } else {
                const grp = groupedAdsMap.get(key);
                grp.spend += a.spend;
                grp.leads += a.leads;
                grp.sales += a.sales;
                grp.revenue += a.revenue;
                grp.ads_grouped += 1;
                grp.ad_names.push(a.name);
                grp.cpl = grp.leads ? grp.spend / grp.leads : 0;
                grp.cpa = grp.sales ? grp.spend / grp.sales : 0;
                grp.roas = grp.spend ? grp.revenue / grp.spend : 0;
            }
        }
        const adsData = Array.from(groupedAdsMap.values());

        const adsetsData = Array.from(adsetsMap.values())
            .map(a => ({ ...a, cpl: a.leads ? a.spend / a.leads : 0, cpa: a.sales ? a.spend / a.sales : 0, roas: a.spend ? a.revenue / a.spend : 0 }))
            .filter(a => a.spend > 0 || a.leads > 0);

        const closersData = Array.from(closerMap.entries()).map(([id, stats]) => ({
            id,
            name: profileMap.get(id) || "Closer",
            total_leads: stats.total,
            sales: stats.sold,
            conversion_rate: stats.total > 0 ? (stats.sold / stats.total) * 100 : 0,
            revenue: stats.revenue
        }));

        const lossData = Array.from(lossReasons.entries()).map(([reason, count]) => ({ reason, count }));

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
            return new Response(
                JSON.stringify({
                    insights_count: 0,
                    insights: [],
                    error_message: "Chave de IA não configurada. Configure a API Key na aba Desenvolvedor ou Integrações para ativar a inteligência."
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (campaignsData.length > 0 || closersData.length > 0) {
            const targetCPA = orgData?.settings?.target_cpa || "Baseado no ROAS alvo definido como ótimo (ROAS > 2)";

            const systemPrompt = `Você é um Traffic Strategist sênior e um Expert em Meta Ads (baseado nas habilidades do Neuro-Skills).
Sua missão é gerar insights hiper-práticos e analíticos para o módulo de marketing do CRM cruzando métricas de tráfego (Anúncios, Conjuntos e Campanhas) com vendas reais.

DIRETRIZES ESTRATÉGICAS:
1. Campanhas (insight_type: "campaign"):
- Avalie o CPL e o CPA. Target CPA esperado: ${targetCPA}.
- Escalar ("scale"): ROAS consistente (> 2), CPA abaixo do alvo e bom volume. Diga exatamente para onde mover o orçamento.
- Pausar ("pause"): Gastando sem conversão (ROAS < 0.5) ou CPA muito estourado.
2. Criativos / Anúncios Individuais (insight_type: "creative"):
- Identifique o Anúncio ("ad_name") campeão de conversão (O Menor CPA e mais Vendas) e recomende escalá-lo.
- Se um Anúncio gasta muito e gera leads mas não gera Vendas atraindo curioso (Alto Spend, Zero Vendas), marque a action como "pause".
- CRÍTICO: Avalie CRITERIOSAMENTE a cópia (Copywriting) do anúncio usando os campos "headline" e "body_text". Comente na "description" do insight se a copy está persuasiva, fraca, desalinhada ou excelente, oferecendo melhorias vitais baseadas no resultado numérico do Ad. RETORNE as chaves "current_copy" e "suggested_copy" no JSON caso o insight_type seja "creative".
3. Públicos / Conjuntos de Anúncios (insight_type: "campaign" / use "reference_id" do adset):
- Avalie o Adset (Público Frio TOF, Lookalike LAL, Retargeting MOF) que tiver melhor CPL/CPA e prescreva escalar aquele público.
4. Atendimento Comercial (insight_type: "closer"):
- Se taxa de conversão < 15%, prescreva "Treinamento de Quebra de Objeções".
- Se alta > 30%, é um case de sucesso ("scale").
5. Gargalos Gerais (insight_type: "general"):
- Cruza com Motivos de Perda. Se muito "Preço", o criativo campeão pode estar prometendo algo barato enganoso. Se "Timing", reduza o tempo de follow-up.

REGRA DE CHAVE 'ACTION': Você É OBRIGADO a preencher a chave 'action' APENAS e ESTRITAMENTE com UMA destas e somente estas 5 palavras em inglês minúsculo: "scale", "pause", "improve", "adjust" ou "alert". Nenhuma outra palavra será aceita pelo banco de dados. Nunca use 'investigate' ou 'test'.

MANDATÓRIO: Retorne APENAS um JSON estrito, onde a raiz seja um objeto contendo uma chave "insights" que é um array de objetos.
EXEMPLO EXATO:
{
  "insights": [
    {
      "insight_type": "campaign",
      "reference_id": "string (ID da campanha, do criativo, do adset, do atendente ou motivo de perda)",
      "action": "scale", // OBRIGATÓRIO SER ESTRITAMENTE UMA DAQUELAS 5 PALAVRAS (scale, pause, improve, adjust, alert). QUALQUER OUTRA PALAVRA VAI QUEBRAR O BANCO.
      "title": "string curta (Ex: Desligar Criativo 'ad_01_feed_video')",
      "description": "texto ultra-analítico explicando o cenário (citando o CPL, CPA, Spend, Leads) num linguajar profissional/direto. Max 3 linhas.",
      "confidence": 95,
      "current_copy": { "headline": "texto original aqui", "body_text": "texto original aqui" },
      "suggested_copy": { "headline": "novo titulo persuasivo sugerido", "body_text": "nova descriçao persuasiva sugerida" }
    }
  ]
}`;

            const userPrompt = `Analise os seguintes metadados estruturados dos últimos ${period_months} meses e retorne o JSON. 
Retorne ALERTA MÁXIMO aos criativos (ads) com muita verba e zero venda, e ELOGIOS aos criativos e públicos (adsets) vencedores. Até 4 ou 5 insights valiosos.

CAMPANHAS (Geral):
${JSON.stringify(campaignsData, null, 2)}

CONJUNTOS DE ANÚNCIOS (Públicos/Adsets):
${JSON.stringify(adsetsData, null, 2)}

ANÚNCIOS INDIVIDUAIS (Criativos/Ads):
${JSON.stringify(adsData, null, 2)}

ATENDENTES (Closers - Taxas de conversão):
${JSON.stringify(closersData, null, 2)}

MOTIVOS DE PERDA (Loss Reasons):
${JSON.stringify(lossData, null, 2)}`;

            try {
                const aiRes = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${finalApiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: model,
                        temperature: 0.1,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ],
                        response_format: { type: "json_object" }
                    })
                });

                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    let contentBytes = aiData.choices[0].message.content || "";
                    contentBytes = contentBytes.replace(/```json/g, '').replace(/```/g, '').trim();
                    const contentJson = JSON.parse(contentBytes);
                    const insightParsed = Array.isArray(contentJson) ? contentJson : (contentJson.insights || Object.values(contentJson)[0]);

                    if (Array.isArray(insightParsed)) {
                        insights = insightParsed.map((ins: any) => ({
                            organization_id,
                            insight_type: "sale_pattern",
                            title: ins.title,
                            description: ins.description,
                            action: ["scale", "pause", "improve", "adjust", "alert"].includes(ins.action) ? ins.action : "improve",
                            confidence: typeof ins.confidence === 'number' && ins.confidence <= 1 ? Math.round(ins.confidence * 100) : Math.round(ins.confidence || 90),
                            status: "active",
                            period: period_months,
                            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                            data: {
                                category: ins.insight_type,
                                reference_id: ins.reference_id || null,
                                current_copy: ins.current_copy || null,
                                suggested_copy: ins.suggested_copy || null
                            }
                        }));
                    } else {
                        return new Response(JSON.stringify({ error_message: "JSON parsing falhou. Formato não é array: " + contentBytes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                    }
                } else {
                    const errText = await aiRes.text();
                    return new Response(JSON.stringify({ error_message: "Falha na Google API: " + errText }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            } catch (err: any) {
                return new Response(JSON.stringify({ error_message: "Exception interna na Edge Function: " + err.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }

        // --- Salvar insights ---
        if (insights.length > 0) {
            // Limpar insights antigos ativos
            await supabase
                .from("ai_insights")
                .delete()
                .eq("organization_id", organization_id)
                .or('data->>category.eq.campaign,data->>category.eq.creative')
                .eq("status", "active");

            const { error } = await supabase
                .from("ai_insights")
                .insert(insights);

            if (error) {
                return new Response(JSON.stringify({ error_message: `PostgreSQL Insert Error: ${error.message} | Details: ${error.details || ""} | Hint: ${error.hint || ""}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }

        return new Response(
            JSON.stringify({ insights_count: insights.length, insights }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
