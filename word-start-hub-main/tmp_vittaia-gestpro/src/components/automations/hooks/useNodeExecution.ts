import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileWithFallback } from "@/lib/r2Upload";

export function useNodeExecution(nodes: any[], currentOrganization: any) {
  const [executingNodes, setExecutingNodes] = useState<Set<string>>(new Set());
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, any>>({});
  const [nodeErrors, setNodeErrors] = useState<Record<string, string | null>>({});

  const onExecuteNode = useCallback(async (nodeId: string, testLead?: any) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setExecutingNodes((prev) => new Set(prev).add(nodeId));
    setNodeErrors((prev) => ({ ...prev, [nodeId]: null }));
    setNodeOutputs((prev) => { const next = { ...prev }; delete next[nodeId]; return next; });

    try {
      const config = (node.data as any)?.config || {};
      const nodeType = node.type;
      let result: any = null;

      // === Nodes that send real messages to lead via Evolution API ===
      const SEND_NODES = new Set(["send_message", "send_to_number", "send_image", "send_audio", "send_document", "send_video", "send_ai_response", "ask_question"]);

      if (SEND_NODES.has(nodeType || "") && testLead) {
        const orgId = currentOrganization?.id;
        if (!orgId) throw new Error("Organização não encontrada");

        // Fetch custom field values for variable interpolation
        const variableData: Record<string, string> = {
          nome: testLead.name || "",
          telefone: testLead.phone || "",
        };

        try {
          const { data: fieldValues } = await (supabase as any)
            .from("chat_custom_field_values")
            .select("field_id, value, chat_custom_fields!inner(field_key)")
            .eq("chat_id", testLead.id)
            .eq("organization_id", orgId);

          if (fieldValues) {
            for (const fv of fieldValues) {
              const key = fv.chat_custom_fields?.field_key;
              if (key && fv.value) variableData[key] = fv.value;
            }
          }
        } catch (e) {
          console.log("Could not fetch custom fields for interpolation:", e);
        }

        // Variable interpolation function
        const interpolate = (text: string): string => {
          return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
            const trimmedKey = key.trim();
            return variableData[trimmedKey] ?? match;
          });
        };

        let messagesToSend: { content: string; message_type: string; file_url?: string; file_name?: string }[] = [];

        if (nodeType === "send_message" || nodeType === "send_to_number") {
          let msg = "";
          if (nodeType === "send_to_number" && config.source_type === "ai_agent") {
            const aiId = config.source_ai_node_id;
            if (!aiId) throw new Error("Agente I.A de origem não configurado");
            msg = `[Conteúdo simulado do Agente I.A: ${aiId}]`;
          } else {
            msg = interpolate(config.message || "");
            if (!msg) throw new Error("Mensagem não configurada");
          }
          if (nodeType === "send_to_number" && !config.target_phone) throw new Error("Número de destino não configurado");
          messagesToSend = [{ content: msg, message_type: "text" }];
        } else if (nodeType === "ask_question") {
          const question = interpolate(config.question || "");
          if (!question) throw new Error("Pergunta não configurada");
          const options = (config.options || []).filter((o: any) => o?.text);
          const fullMsg = options.length > 0
            ? `${question}\n\n${options.map((o: any, i: number) => `${i + 1}. ${interpolate(o.text)}`).join("\n")}`
            : question;
          messagesToSend = [{ content: fullMsg, message_type: "text" }];
        } else if (["send_image", "send_audio", "send_document", "send_video"].includes(nodeType || "")) {
          const fileUrl = config.file_url || config.string_source || "";
          if (!fileUrl) throw new Error("Arquivo/URL não configurado");
          const typeMap: Record<string, string> = { send_image: "image", send_audio: "audio", send_document: "document", send_video: "video" };
          messagesToSend = [{ content: interpolate(config.caption || ""), message_type: typeMap[nodeType!] || "document", file_url: fileUrl, file_name: config.file_name || "" }];
        } else if (nodeType === "send_ai_response") {
          // Get the AI agent output from allNodeOutputs
          const sourceNodeId = config.source_ai_node_id;
          if (!sourceNodeId) throw new Error("Nó de Agente I.A não selecionado");
          const aiOutput = nodeOutputs[sourceNodeId];
          if (!aiOutput?.output) throw new Error("Execute o nó de Agente I.A primeiro para gerar o output");

          const rawText = typeof aiOutput.output === "string" ? aiOutput.output : (aiOutput.output?.toString?.() || JSON.stringify(aiOutput.output));
          const AI_SPLIT_DELIMITER = "⌁⌁⌁";
          const splitEnabled = config.split_enabled ?? true;

          if (splitEnabled) {
            if (rawText.includes(AI_SPLIT_DELIMITER)) {
              const parts = rawText.split(AI_SPLIT_DELIMITER).map((p: string) => p.trim()).filter(Boolean);
              messagesToSend = parts.map((p: string) => ({ content: p, message_type: "text" }));
            } else {
              // Fallback: split by line breaks when delimiter is missing
              const fallbackParts = rawText
                .split(/\n+/)
                .map((p: string) => p.replace(/\s+/g, " ").trim())
                .filter(Boolean);

              messagesToSend = (fallbackParts.length > 1 ? fallbackParts : [rawText.trim()])
                .map((p: string) => ({ content: p, message_type: "text" }));
            }
          } else {
            messagesToSend = [{ content: rawText, message_type: "text" }];
          }
        }

        if (messagesToSend.length === 0) throw new Error("Nenhuma mensagem para enviar");

        const delaySeconds = config.delay_seconds ?? 2;
        const sentMessages: any[] = [];

        for (let i = 0; i < messagesToSend.length; i++) {
          const msg = messagesToSend[i];

          // Add delay between split messages (not the first one)
          if (i > 0 && delaySeconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
          }

          const sendBody: any = {
            organization_id: orgId,
            phone: nodeType === "send_to_number" ? config.target_phone : testLead.phone,
            message: msg.content,
            message_type: msg.message_type,
          };

          if (msg.file_url) {
            if (msg.file_url.startsWith("data:")) {
              try {
                // Converte base64 em blob e upa para o storage durante o Test Real
                const res = await fetch(msg.file_url);
                const blob = await res.blob();
                const uploadedUrl = await uploadFileWithFallback(blob, testLead.id || "test-real", msg.file_name || "test-media");
                sendBody.file_url = uploadedUrl;
              } catch (uploadErr) {
                console.error("Test upload failed:", uploadErr);
                sentMessages.push({
                  text: msg.content?.slice(0, 80) + (msg.content && msg.content.length > 80 ? "..." : ""),
                  delivered: false,
                  delay: i > 0 ? `+${(i * delaySeconds).toFixed(1)}s` : "0s",
                  error: "Erro no upload do arquivo (Teste): " + (uploadErr instanceof Error ? uploadErr.message : String(uploadErr))
                });
                continue;
              }
            } else {
              sendBody.file_url = msg.file_url;
            }
          }
          if (msg.file_name) sendBody.file_name = msg.file_name;

          const { data: sendData, error: sendError } = await supabase.functions.invoke("send-to-evolution", { body: sendBody });

          sentMessages.push({
            text: msg.content?.slice(0, 80) + (msg.content && msg.content.length > 80 ? "..." : ""),
            delivered: !sendError && !sendData?.error,
            delay: i > 0 ? `+${(i * delaySeconds).toFixed(1)}s` : "0s",
            error: sendError?.message || sendData?.error || null,
          });
        }

        const allDelivered = sentMessages.every((m) => m.delivered);
        result = {
          status: allDelivered ? "sent" : "partial",
          lead: { name: testLead.name, phone: testLead.phone },
          messages_sent: sentMessages.length,
          messages: sentMessages,
          message: allDelivered
            ? `✅ ${sentMessages.length} mensagem(ns) enviada(s) para ${testLead.name}`
            : `⚠ Algumas mensagens falharam`,
        };

      } else if (nodeType === "http_request") {
        // Execute HTTP request via edge function proxy to avoid CORS
        const method = config.method || "GET";
        const url = config.url || "";
        if (!url) throw new Error("URL não configurada");

        const proxyHeaders: Record<string, string> = {};
        if (config.send_headers) {
          if (config.headers_mode === "json") {
            try { Object.assign(proxyHeaders, JSON.parse(config.headers_json || "{}")); } catch { }
          } else {
            (config.headers || []).forEach((h: any) => { if (h.name) proxyHeaders[h.name] = h.value; });
          }
        }

        if (config.auth_type === "bearer" && config.auth_config?.token) {
          proxyHeaders["Authorization"] = `Bearer ${config.auth_config.token}`;
        } else if (config.auth_type === "basic" && config.auth_config?.username) {
          proxyHeaders["Authorization"] = `Basic ${btoa(`${config.auth_config.username}:${config.auth_config.password || ""}`)}`;
        } else if (config.auth_type === "api_key" && config.auth_config?.key) {
          const headerName = config.auth_config.header_name || "Authorization";
          const prefix = config.auth_config.prefix ? `${config.auth_config.prefix} ` : "";
          proxyHeaders[headerName] = `${prefix}${config.auth_config.key}`;
        }

        let finalUrl = url;
        if (config.send_query_params) {
          const params = new URLSearchParams();
          if (config.query_params_mode === "json") {
            try {
              const qp = JSON.parse(config.query_params_json || "{}");
              Object.entries(qp).forEach(([k, v]) => params.set(k, String(v)));
            } catch { }
          } else {
            (config.query_params || []).forEach((p: any) => { if (p.name) params.set(p.name, p.value); });
          }
          const qs = params.toString();
          if (qs) finalUrl += (finalUrl.includes("?") ? "&" : "?") + qs;
        }

        let body: string | undefined;
        if (config.send_body && !["GET", "HEAD"].includes(method)) {
          if (config.body_mode === "json" || config.body_content_type === "raw") {
            body = config.body_json || "{}";
          } else {
            const bodyObj: Record<string, string> = {};
            (config.body_fields || []).forEach((f: any) => { if (f.name) bodyObj[f.name] = f.value; });
            body = JSON.stringify(bodyObj);
          }
          if (!proxyHeaders["Content-Type"]) proxyHeaders["Content-Type"] = "application/json";
        }

        const { data: proxyData, error: proxyError } = await supabase.functions.invoke("http-proxy", {
          body: { url: finalUrl, method, headers: proxyHeaders, body },
        });

        if (proxyError) throw new Error(proxyError.message || "Erro ao chamar proxy HTTP");
        if (proxyData?.error) throw new Error(proxyData.message || proxyData.error);

        result = proxyData?.data ?? proxyData;
      } else if (nodeType === "code" && config.language === "javascript") {
        try {
          const fn = new Function("input", "context", config.code || "return {};");
          result = fn({}, { chatId: "test", phone: "test", leadName: "test" });
        } catch (e: any) {
          throw new Error(`Erro no código: ${e.message}`);
        }
      } else if (nodeType === "edit_fields") {
        if (config.mode === "json") {
          try { result = JSON.parse(config.json_value || "{}"); } catch { result = {}; }
        } else {
          result = {};
          (config.fields || []).forEach((f: any) => { if (f.name) result[f.name] = f.value; });
        }
      } else if (nodeType === "filter") {
        const conditions = config.conditions || [];
        const matchMode = config.match_mode || "all";
        if (!conditions.length || conditions.every((c: any) => !c.field)) {
          throw new Error("Nenhuma condição configurada");
        }
        result = { status: "ok", conditions_count: conditions.length, match_mode: matchMode, message: "Filtro configurado corretamente" };
      } else if (nodeType === "router") {
        const rules = config.rules || [];
        if (!rules.length || rules.every((r: any) => !r.field)) {
          throw new Error("Nenhuma rota configurada");
        }
        result = {
          status: "ok",
          routes_count: rules.length,
          routes: rules.map((r: any, i: number) => ({
            route: i,
            name: r.renameOutput && r.outputName ? r.outputName : `Rota ${i + 1}`,
            field: r.field,
            operator: r.operator,
            value: r.value,
          })),
          message: "Caminho configurado corretamente",
        };
      } else if (nodeType === "ai_agent") {
        if (!config.credential_id) throw new Error("Credencial não configurada");
        if (!config.prompt && !config.system_message) throw new Error("Prompt ou System Message obrigatório");

        const toolsParsed = (config.tools || []).map((t: any) => {
          let params = {};
          try { params = JSON.parse(t.parameters || "{}"); } catch { }
          return { name: t.name, description: t.description, parameters: params };
        });

        // Inject formatting instruction if format_for_send is enabled
        let systemMessage = config.system_message || "";
        if (config.format_for_send) {
          const formatInstruction = "\n\nIMPORTANTE: Você DEVE retornar a resposta segmentada usando EXATAMENTE o delimitador ⌁⌁⌁ entre cada mensagem (sem variações). Formato obrigatório: mensagem 1⌁⌁⌁mensagem 2⌁⌁⌁mensagem 3. Não use listas numeradas para separar, não use apenas quebra de linha, não coloque o delimitador no início/fim.";
          systemMessage = systemMessage + formatInstruction;
        }

        const { data: agentData, error: agentError } = await supabase.functions.invoke("ai-agent-execute", {
          body: {
            organization_id: currentOrganization?.id,
            credential_id: config.credential_id,
            model: config.model || "gpt-4o-mini",
            system_message: systemMessage,
            prompt: config.prompt || "",
            tools: toolsParsed.length > 0 ? toolsParsed : undefined,
            phone: testLead?.phone || "test",
            chat_id: testLead?.id,
          },
        });
        if (agentError) throw new Error(agentError.message);
        if (agentData?.error) throw new Error(agentData.error);
        result = agentData;
      } else if (nodeType === "intent_router") {
        if (!config.credential_id) throw new Error("Credencial não configurada");
        const intents = config.intents || [];
        if (intents.length === 0) throw new Error("Nenhuma intenção configurada");

        const orgId = currentOrganization?.id;
        const phone = testLead?.phone || "test";

        // Fetch last message for classification if no input provided
        let userMessage = "";
        if (testLead) {
          const { data: lastMsg } = await (supabase as any)
            .from("messages")
            .select("content")
            .eq("chat_id", testLead.id)
            .eq("is_from_user", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          userMessage = lastMsg?.content || "";
        }

        const systemPrompt = `Você é um classificador de intenções ultra-preciso.
Sua tarefa é analisar a mensagem do usuário e categorizá-la em UMA das seguintes intenções: [${intents.join(", ")}].
Se nenhuma das opções for claramente a correta, responda APENAS "fallback".

Instruções Adicionais: ${config.instruction || "Nenhuma"}

REGRAS CRÍTICAS:
- Responda APENAS o nome exato da intenção em MAIÚSCULAS.
- NÃO adicione justificativas, pontuação ou explicações.
- Se estiver em dúvida entre duas, escolha a mais provável.`;

        const { data: intentData, error: intentError } = await supabase.functions.invoke("ai-agent-execute", {
          body: {
            prompt: userMessage || "Olá, tudo bem?",
            system_message: systemPrompt,
            model: config.model || "gpt-4o-mini",
            provider: config.provider || "openai",
            credential_id: config.credential_id,
            organization_id: orgId,
            memory_key: "", // Classification doesn't need long memory
            context_window_length: 0,
            temperature: 0, // Deterministic
            max_iterations: 1,
            enforce_vitta_token_usage: true,
          },
        });

        if (intentError) throw new Error(intentError.message);
        if (intentData?.error) throw new Error(intentData.error);

        const classification = (intentData.output || "").trim().toUpperCase();
        const matchedIntent = intents.find((it: string) => it.toUpperCase() === classification);

        result = {
          classification: matchedIntent || "fallback",
          raw_output: intentData.output,
          usage: intentData.usage,
        };
      } else if (nodeType === "follow_up_ai") {
        if (!config.credential_id) throw new Error("Credencial não configurada");
        const followupPrompt = config.followup_prompt || config.prompt || "";
        if (!followupPrompt) throw new Error("Prompt de follow-up obrigatório");

        const orgId = currentOrganization?.id;
        if (!orgId) throw new Error("Organização não encontrada");

        // If test lead selected, fetch real chat history
        let historyText = "Lead: Oi, gostaria de saber valores\nAtendente: Claro, posso te ajudar\nLead: Vou ver e te retorno";
        if (testLead) {
          try {
            const historyCount = config.history_count || 20;
            const { data: msgs } = await (supabase as any)
              .from("messages")
              .select("content, is_from_user, message_type, created_at")
              .eq("chat_id", testLead.id)
              .eq("organization_id", orgId)
              .eq("private", false)
              .order("created_at", { ascending: false })
              .limit(historyCount);
            if (msgs && msgs.length > 0) {
              historyText = msgs.reverse().map((m: any) => {
                const role = m.is_from_user ? "Atendente" : "Lead";
                return `[${m.created_at}] ${role}: ${m.content || `[${m.message_type}]`}`;
              }).join("\n");
            }
          } catch (e) { console.log("Could not fetch history:", e); }
        }

        let systemMessage = followupPrompt;
        if (config.format_for_send !== false) {
          systemMessage += "\n\nIMPORTANTE: Separe cada parte da resposta usando EXATAMENTE o delimitador ⌁⌁⌁ entre as mensagens.";
        }

        const { data: followData, error: followError } = await supabase.functions.invoke("ai-agent-execute", {
          body: {
            prompt: `Histórico de conversa:\n${historyText}\n\nTarefa: Gere um follow-up curto e personalizado para reengajar esse lead.`,
            system_message: systemMessage,
            model: config.model || "gpt-4o-mini",
            provider: config.provider || "openai",
            credential_id: config.credential_id,
            organization_id: orgId,
            memory_key: "",
            context_window_length: 0,
            temperature: 0.7,
            max_iterations: 2,
            input_data: { mode: "follow_up_test" },
            enforce_vitta_token_usage: true,
          },
        });

        if (followError) throw new Error(followError.message);
        if (followData?.error) throw new Error(followData.error);

        // Send the generated follow-up via WhatsApp if test lead is selected
        const aiOutput = (followData?.output || "").trim();
        if (testLead && aiOutput) {
          const AI_SPLIT_DELIMITER = "⌁⌁⌁";
          const parts = aiOutput.includes(AI_SPLIT_DELIMITER)
            ? aiOutput.split(AI_SPLIT_DELIMITER).map((p: string) => p.trim()).filter(Boolean)
            : aiOutput.split(/\n+/).map((p: string) => p.trim()).filter(Boolean);
          const finalParts = parts.length > 0 ? parts : [aiOutput];

          const sentMessages: any[] = [];
          const delaySeconds = config.delay_seconds ?? 2;

          for (let i = 0; i < finalParts.length; i++) {
            if (i > 0 && delaySeconds > 0) {
              await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
            }

            const sendBody = {
              organization_id: orgId,
              phone: testLead.phone,
              message: finalParts[i],
              message_type: "text",
            };

            const { data: sendData, error: sendError } = await supabase.functions.invoke("send-to-evolution", { body: sendBody });

            sentMessages.push({
              text: finalParts[i].slice(0, 80) + (finalParts[i].length > 80 ? "..." : ""),
              delivered: !sendError && !sendData?.error,
              delay: i > 0 ? `+${(i * delaySeconds).toFixed(1)}s` : "0s",
              error: sendError?.message || sendData?.error || null,
            });
          }

          const allDelivered = sentMessages.every((m) => m.delivered);
          result = {
            ...followData,
            status: allDelivered ? "sent" : "partial",
            lead: { name: testLead.name, phone: testLead.phone },
            messages_sent: sentMessages.length,
            messages: sentMessages,
            message: allDelivered
              ? `✅ Follow-up enviado (${sentMessages.length} parte(s)) para ${testLead.name}`
              : `⚠ Algumas mensagens falharam`,
          };
        } else {
          result = followData;
        }
      } else if (nodeType === "marketing_data") {
        // Map node config to Edge Function date_range
        const dateRange = config.date_range || "30d";
        const presetMap: Record<string, string> = {
          "7d": "last_7d", "14d": "last_7d", "30d": "last_30d",
          "60d": "last_90d", "90d": "last_90d", "all": "all_time",
        };
        let edgeDateRange: any = { preset: presetMap[dateRange] || "last_30d" };
        if (dateRange === "14d" || dateRange === "60d") {
          const days = parseInt(dateRange) || 30;
          const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const yyyy = (d: Date) => d.toISOString().split("T")[0];
          edgeDateRange = { start: yyyy(since), end: yyyy(new Date()) };
        }

        // Sync fresh from Meta with correct period
        await supabase.functions.invoke("marketing-api", {
          body: { action: 'sync_meta', organization_id: currentOrganization?.id, date_range: edgeDateRange },
        });
        const { data: campaigns } = await supabase.from('marketing_campaigns').select('*').eq('organization_id', currentOrganization?.id);
        const allCampaigns = campaigns || [];

        // Filter empty campaigns
        const validCampaigns = allCampaigns.filter((c: any) =>
          !c.raw_data?.is_account_total &&
          ((c.spend || 0) > 0 || (c.clicks || 0) > 0 || (c.impressions || 0) > 0)
        );

        // Use account total for global metrics
        const accountTotal = allCampaigns.find((c: any) => c.raw_data?.is_account_total);
        let totalSpend = 0, totalClicks = 0, totalImpressions = 0, totalLeads = 0, totalMessages = 0;

        if (accountTotal) {
          totalSpend = accountTotal.spend || 0;
          totalClicks = accountTotal.clicks || 0;
          totalImpressions = accountTotal.impressions || 0;
          totalLeads = (accountTotal.raw_data as any)?.leads || 0;
          totalMessages = (accountTotal.raw_data as any)?.messages_started || 0;
        } else {
          for (const c of validCampaigns) {
            totalSpend += Number(c.spend || 0);
            totalClicks += Number(c.clicks || 0);
            totalImpressions += Number(c.impressions || 0);
            totalLeads += Number((c.raw_data as any)?.leads || 0);
            totalMessages += Number((c.raw_data as any)?.messages_started || 0);
          }
        }

        let formattedText = `📊 *Resumo de Desempenho - Meta Ads (${dateRange})*\n\n`;
        formattedText += `*Gasto Total:* R$ ${totalSpend.toFixed(2)}\n`;
        formattedText += `*Cliques:* ${totalClicks}\n`;
        formattedText += `*Impressões:* ${totalImpressions}\n`;
        if (totalLeads > 0) formattedText += `*Leads:* ${totalLeads} (CPL: R$ ${(totalSpend / totalLeads).toFixed(2)})\n`;
        if (totalMessages > 0) formattedText += `*Msg Iniciadas:* ${totalMessages}\n`;

        formattedText += "\n📋 *Campanhas com dados:*\n";
        if (validCampaigns.length === 0) {
          formattedText += "_Nenhuma campanha com dados no período._\n";
        } else {
          for (const c of validCampaigns) {
            formattedText += `\n🔹 *${c.campaign_name || 'Campanha'}*\n`;
            formattedText += `Gasto: R$ ${Number(c.spend || 0).toFixed(2)}\n`;
            const leads = Number((c.raw_data as any)?.leads || 0);
            const msgs = Number((c.raw_data as any)?.messages_started || 0);
            if (leads > 0) formattedText += `Leads: ${leads} (CPL R$ ${(Number(c.spend || 0) / leads).toFixed(2)})\n`;
            if (msgs > 0) formattedText += `Mensagens: ${msgs}\n`;

            // Ad sets
            const adsets = (c.raw_data as any)?.adsets || [];
            const adsetsActive = adsets.filter((a: any) => (a.spend || 0) > 0 || (a.clicks || 0) > 0);
            if (adsetsActive.length > 0) {
              formattedText += `  Conjuntos (${adsetsActive.length}):\n`;
              for (const as2 of adsetsActive) {
                formattedText += `    • ${as2.adset_name || as2.adset_id}: R$ ${parseFloat(as2.spend || 0).toFixed(2)}, ${as2.clicks || 0} cliques\n`;
              }
            }

            // Ads
            const ads = (c.raw_data as any)?.ads || [];
            const adsActive = ads.filter((a: any) => (a.spend || 0) > 0 || (a.clicks || 0) > 0);
            if (adsActive.length > 0) {
              formattedText += `  Anúncios (${adsActive.length}):\n`;
              for (const ad of adsActive) {
                formattedText += `    📢 ${ad.ad_name || ad.ad_id}: R$ ${parseFloat(ad.spend || 0).toFixed(2)}, ${ad.clicks || 0} cliques\n`;
                if (ad.headline) formattedText += `       Título: ${ad.headline}\n`;
                if (ad.body_text) formattedText += `       Texto: ${ad.body_text}\n`;
                if (ad.autofill_message) formattedText += `       Msg Auto: ${ad.autofill_message}\n`;
              }
            }
          }
        }

        result = {
          status: "ok", node_type: nodeType, config_valid: true,
          formatted_text: formattedText,
          marketing_data: validCampaigns,
          message: `Sincronização concluída (${dateRange}): ${validCampaigns.length} campanhas com dados (${allCampaigns.length - validCampaigns.length - 1} vazias excluídas)`
        };
      } else if (nodeType === "wa_lists") {
        const { data: lists } = await supabase.from('broadcast_lists').select('id, name, description').eq('organization_id', currentOrganization?.id);
        result = {
          status: "ok", node_type: nodeType, config_valid: true,
          wa_lists: lists || [],
          message: `Consulta simulada: Carregou ${lists?.length || 0} listas`
        };
      } else if (nodeType === "send_meta_template") {
        const templateId = config.template_id;
        if (!templateId) throw new Error("Template Id não foi configurado ou selecionado");
        result = {
          status: "ok", node_type: nodeType, config_valid: true,
          message: `Simulação de Envio: Template selecionado seria enviado via Meta API para o lead.`
        };
      } else if (nodeType === "action") {
        let actionDesc = config.action_type;
        if (config.action_type === "assign_team") actionDesc += ` (Equipe ID: ${config.team_id || 'Nenhuma'})`;
        result = { status: "ok", node_type: nodeType, config_valid: true, message: `Simulação de Ação: ${actionDesc}` };
      } else {
        result = { status: "ok", node_type: nodeType, config_valid: true, message: "Configuração válida" };
      }

      setNodeOutputs((prev) => ({ ...prev, [nodeId]: result }));
    } catch (e: any) {
      setNodeErrors((prev) => ({ ...prev, [nodeId]: e.message || "Erro desconhecido" }));
    }
  }, [nodes, currentOrganization]);

  return { executingNodes, nodeOutputs, setNodeOutputs, nodeErrors, onExecuteNode };
}
