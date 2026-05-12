import { checkBotStatus, invokeWithRetry, toMsFromAmountUnit } from "../utils/shared.ts";
import { handleCrmMove } from "./crm.ts";
import { handleFinanceiro } from "./business.ts";

export async function handleAiAgent(
    supabase: any, config: any, organizationId: string, chatId: string, context: any, nodeId?: string
) {
    const botAllowedSingle = await checkBotStatus(supabase, organizationId, chatId);
    if (!botAllowedSingle) {
        return { success: true, message: "⚠️ Robô desativado. Nó de I.A ignorado." };
    }
    const aiProvider = config.provider || "openai";
    const credentialId = config.credential_id;
    if (!credentialId) {
        return { success: false, message: "Credencial de I.A não configurada." };
    }

    const isVittaCredential = ["vitta-openai", "vitta-gemini"].includes(credentialId);

    if (isVittaCredential) {
        const { data: tokenBal } = await supabase
            .from("organization_token_balances")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("provider", aiProvider)
            .maybeSingle();

        const remaining = (tokenBal?.total_tokens || 0) - (tokenBal?.used_tokens || 0);
        if (remaining <= 0) {
            return { success: true, message: `⚠️ Tokens esgotados. Nó de I.A ignorado.` };
        }
    }

    let userPrompt = config.prompt || "";
    if (context && typeof context === "object") {
        userPrompt = userPrompt.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match: string, key: string) => {
            const parts = key.trim().split(".");
            let val: any = context;
            for (const p of parts) { val = val?.[p]; }
            if (val && typeof val === "object") return JSON.stringify(val, null, 2);
            return val !== undefined ? String(val) : match;
        });
    }

    const res = await invokeWithRetry(supabase, "ai-agent-execute", {
        body: {
            prompt: userPrompt,
            system_message: config.system_message || "",
            model: config.model || (aiProvider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"),
            provider: aiProvider,
            credential_id: credentialId,
            organization_id: organizationId,
            memory_key: config.memory_key || "",
            context_window_length: config.context_window_length || 5,
            temperature: config.temperature ?? 0.7,
            max_iterations: config.max_iterations || 5,
            tools: (() => {
                const userTools = (config.tools || []).map((t: any) => {
                    let params = {};
                    try { params = JSON.parse(t.parameters || "{}"); } catch { }
                    return { name: t.name, description: t.description, parameters: params };
                });

                if (config.auto_finance_enabled) {
                    userTools.push({
                        name: "registrar_venda",
                        description: "Registra uma transação financeira de venda, receita ou despesa no sistema do CRM do cliente atual.",
                        parameters: {
                            type: "object",
                            properties: {
                                transaction_type: { type: "string", enum: ["income", "expense"], description: "Use income para vendas/receitas e expense para custos/despesas." },
                                amount: { type: "number", description: "Valor total (use números e ponto como separador decimal, sem R$). Ex: 250.50" },
                                product_name: { type: "string", description: "Nome do produto, serviço ou plano vendido." },
                                description: { type: "string", description: "Opcional. Observações ou detalhes do fechamento." }
                            },
                            required: ["transaction_type", "amount", "product_name"]
                        }
                    });
                }
                return userTools;
            })(),
            input_data: { chat_id: chatId },
        },
    });

    const agentData = res?.data;
    const agentError = res?.error;

    if (agentError) return { success: false, message: agentError.message };
    if (agentData?.error) return { success: false, message: agentData.message || agentData.error || "Erro na I.A" };

    const aiOutput = agentData?.output || "";
    const usage = agentData?.usage;

    if (isVittaCredential && usage) {
        await supabase.rpc("increment_token_usage", {
            p_organization_id: organizationId,
            p_provider: aiProvider,
            p_amount: usage.total_tokens
        });

        supabase.from("token_transactions").insert({
            organization_id: organizationId, provider: aiProvider, transaction_type: "consumption",
            amount: usage.total_tokens, description: `Automação AI Agent | chat ${chatId} | Tokens: ${usage.total_tokens}`,
        }).then();
    }

    // Phase 3.3: Execute registered tools (e.g., registrar_venda)
    const toolCalls = agentData?.tool_calls || [];
    if (config.auto_finance_enabled && toolCalls.length > 0) {
        for (const tc of toolCalls) {
            if (tc.name === "registrar_venda") {
                try {
                    await handleFinanceiro(supabase, tc.arguments, organizationId, chatId);
                    console.log(`[ai_agent] Auto Finance: registered sale via tool call`, tc.arguments);
                } catch (e: any) {
                    console.error("[ai_agent] handleFinanceiro tool error:", e.message);
                }
            }
        }
    }

    if (context) {
        context.ai_agent_output = aiOutput;
        context.ai_agent_usage = usage;
        if (nodeId) {
            context[`node_${nodeId}_ai_output`] = aiOutput;
        }
    }

    const usageStr = usage ? ` | Tokens: ${usage.total_tokens}` : "";
    return { success: true, message: `AI: ${aiOutput.substring(0, 100)}...${usageStr}` };
}

export async function transcribeAudio(fileUrl: string, credentialId: string, organizationId: string, supabase: any): Promise<string | null> {
    try {
        let apiKey = "";
        if (credentialId === "vitta-openai" || credentialId === "vitta-gemini") {
            const { data: globalCfg } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
            if (!globalCfg?.value) return null;
            apiKey = globalCfg.value;
        } else {
            const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key, provider").eq("id", credentialId).eq("organization_id", organizationId).single();
            if (!cred || cred.provider !== "openai") return null;
            apiKey = cred.api_key;
        }

        const response = await fetch(fileUrl);
        if (!response.ok) return null;
        const audioBlob = await response.blob();
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.ogg");
        formData.append("model", "whisper-1");
        formData.append("language", "pt");

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: formData,
        });

        if (!whisperRes.ok) return null;
        const result = await whisperRes.json();
        return result.text || null;
    } catch (e) {
        console.error("[dialogue] Transcribe error:", e);
        return null;
    }
}

export async function describeImage(fileUrl: string, credentialId: string, organizationId: string, supabase: any): Promise<string | null> {
    try {
        let apiKey = "";
        if (credentialId === "vitta-openai" || credentialId === "vitta-gemini") {
            const { data: globalCfg } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
            if (!globalCfg?.value) return null;
            apiKey = globalCfg.value;
        } else {
            const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key, provider").eq("id", credentialId).eq("organization_id", organizationId).single();
            if (!cred) return null;
            apiKey = cred.api_key;
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: "Descreva detalhadamente o conteúdo desta imagem..." },
                        { type: "image_url", image_url: { url: fileUrl, detail: "high" } }
                    ]
                }], max_tokens: 1000, temperature: 0.3,
            }),
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error("[dialogue] Image describe error:", e);
        return null;
    }
}

export async function extractPdfText(fileUrl: string): Promise<string | null> {
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const text = new TextDecoder("latin1").decode(bytes);
        const extractedParts: string[] = [];

        const btEtRegex = /BT\s([\s\S]*?)ET/g;
        let match;
        while ((match = btEtRegex.exec(text)) !== null) {
            const block = match[1];
            const tjRegex = /\(([^)]*)\)\s*Tj/g;
            let tjMatch;
            while ((tjMatch = tjRegex.exec(block)) !== null) {
                const decoded = tjMatch[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
                if (decoded.trim()) extractedParts.push(decoded);
            }
            const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
            let tjArrMatch;
            while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
                const arrContent = tjArrMatch[1];
                const strRegex = /\(([^)]*)\)/g;
                let strMatch;
                let line = "";
                while ((strMatch = strRegex.exec(arrContent)) !== null) {
                    line += strMatch[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
                }
                if (line.trim()) extractedParts.push(line);
            }
        }

        if (extractedParts.length === 0) {
            const readableRegex = /[\x20-\x7E\xC0-\xFF]{20,}/g;
            let readable;
            while ((readable = readableRegex.exec(text)) !== null) {
                extractedParts.push(readable[0]);
            }
        }

        const result = extractedParts.join(" ").replace(/\s+/g, " ").trim();
        return result.length > 0 ? result.substring(0, 5000) : null;
    } catch (e) {
        console.error("[dialogue] PDF extract error:", e);
        return null;
    }
}

export async function handleIntentRouter(
    supabase: any, config: any, organizationId: string, chatId: string, context: any, nodeId: string
) {
    const intentInstruction = config.instruction || "Classifique a última mensagem do usuário.";
    const intents: string[] = config.intents || [];
    const analyzeFullContext = config.analyze_full_context !== false;
    const contextWindowSize = analyzeFullContext ? (config.context_window || 20) : 1;
    const intentCredentialId = config.credential_id || "vitta-openai";
    const intentModel = config.model || "gpt-4o-mini";
    const intentProvider = intentCredentialId.includes("gemini") ? "gemini" : "openai";

    if (intents.length === 0) {
        return { success: false, message: "Nenhum caminho de intenção configurado." };
    }

    const { data: recentMessages } = await supabase
        .from("messages")
        .select("id, content, is_from_user, created_at, message_type, file_url")
        .eq("chat_id", chatId)
        .eq("private", false)
        .order("created_at", { ascending: false })
        .limit(contextWindowSize);

    const recentArr = recentMessages || [];

    for (const m of recentArr) {
        if (!m.is_from_user && m.message_type === "audio" && (!m.content || m.content.trim() === "") && m.file_url) {
            const transcribedText = await transcribeAudio(m.file_url, intentCredentialId, organizationId, supabase);
            if (transcribedText) {
                m.content = `[Áudio transcrito]: ${transcribedText}`;
                await supabase.from("messages").update({ content: m.content }).eq("id", m.id);
            }
        }
    }

    const chatHistory = [...recentArr]
        .reverse()
        .map((m: any) => `${m.is_from_user ? "Lead" : "Atendente/Robô"}: ${m.content || `[${m.message_type}]`}`)
        .join("\n");

    const classificationPrompt = `Analise o histórico da conversa abaixo e classifique a situação atual do lead em EXATAMENTE uma das seguintes intenções:

${intents.map((intent: string, i: number) => `${i + 1}. ${intent}`).join("\n")}

CRITÉRIOS DE DECISÃO:
${intentInstruction}

HISTÓRICO DA CONVERSA:
${chatHistory || "Sem histórico."}

RESPONDA APENAS com o nome exato da intenção que melhor se encaixa, sem explicações.`;

    try {
        const classifyRes = await invokeWithRetry(supabase, "ai-agent-execute", {
            body: {
                prompt: classificationPrompt,
                system_message: "Você é um classificador de intenções. Responda APENAS com o nome exato.",
                model: intentModel, provider: intentProvider, credential_id: intentCredentialId,
                organization_id: organizationId, memory_key: "", context_window_length: 0,
                temperature: 0.1, max_iterations: 1, tools: [], input_data: { chat_id: chatId },
            },
        });

        const classifyResult = classifyRes?.data;
        const classifyError = classifyRes?.error;

        if (classifyError || classifyResult?.error) {
            return { success: false, message: `Erro na classificação` };
        }

        const classifiedIntent = (classifyResult?.output || "").trim().toUpperCase().replace(/[^A-ZÀ-Ú0-9_\s]/g, "");

        let matchedIntent = "";
        for (const intent of intents) {
            const intentUpper = intent.toUpperCase().replace(/[^A-ZÀ-Ú0-9_\s]/g, "");
            if (classifiedIntent.includes(intentUpper) || intentUpper.includes(classifiedIntent)) {
                matchedIntent = intent;
                break;
            }
        }

        if (!matchedIntent) {
            for (const intent of intents) {
                const words = intent.toUpperCase().split(/[\s_]+/);
                if (words.some((w: string) => classifiedIntent.includes(w) && w.length > 3)) {
                    matchedIntent = intent;
                    break;
                }
            }
        }

        if (context) {
            context[`node_${nodeId}_classified_intent`] = matchedIntent || classifiedIntent;
        }

        // Phase 3.2: CRM Auto Move Logic
        if (config.auto_crm_move && config.intent_routes && matchedIntent) {
            const intentConfig = config.intent_routes[matchedIntent];
            if (intentConfig && intentConfig.funnel_id && intentConfig.stage_id) {
                try {
                    await handleCrmMove(supabase, intentConfig, organizationId, chatId);
                    console.log(`[intent_router] Auto CRM Move applied for ${chatId} (intent: ${matchedIntent})`);
                } catch (e) {
                    console.error("[intent_router] Failed to apply Auto CRM Move:", e);
                }
            }
        }

        const isVittaCred = ["vitta-openai", "vitta-gemini"].includes(intentCredentialId);
        if (isVittaCred && classifyResult?.usage?.total_tokens) {
            await supabase.rpc("increment_token_usage", { p_organization_id: organizationId, p_provider: intentProvider, p_amount: classifyResult.usage.total_tokens, });
            supabase.from("token_transactions").insert({
                organization_id: organizationId, provider: intentProvider, transaction_type: "consumption",
                amount: classifyResult.usage.total_tokens, description: `Classificador de Intenções | chat ${chatId}`,
            }).then();
        }

        return { success: true, message: `Intenção: ${matchedIntent || classifiedIntent}` };
    } catch (e: any) {
        return { success: false, message: `Erro no classificador: ${e.message}` };
    }
}

export async function handleSendAiResponse(
    supabase: any, config: any, organizationId: string, chatId: string, context: any
) {
    const sourceNodeId = config.source_ai_node_id || "";
    // Prioridade: output específico do nó marcado na tela, ou estado global como fallback
    const aiOutput = context[`node_${sourceNodeId}_ai_output`] || context.ai_agent_output || "";

    if (!aiOutput || !aiOutput.trim()) {
        return { success: true, message: "⚠️ Nenhuma resposta gerada pela I.A capturada no contexto. Nada a enviar." };
    }

    const splitEnabled = config.split_enabled ?? true;
    const AI_SPLIT_DELIMITER = "⌁⌁⌁";
    let messageParts: string[] = [aiOutput];

    if (splitEnabled) {
        if (aiOutput.includes(AI_SPLIT_DELIMITER)) {
            messageParts = aiOutput.split(AI_SPLIT_DELIMITER).map((p: string) => p.trim()).filter(Boolean);
        } else {
            const lines = aiOutput.split(/\n+/).map((p: string) => p.trim()).filter(Boolean);
            if (lines.length > 1) messageParts = lines;
        }
    }

    const delaySeconds = config.delay_seconds ?? 2;

    for (let i = 0; i < messageParts.length; i++) {
        if (i > 0 && delaySeconds > 0) {
            await new Promise(r => setTimeout(r, delaySeconds * 1000));
        }

        const { data: insertedMsg, error: msgError } = await supabase
            .from("messages")
            .insert({
                chat_id: chatId,
                organization_id: organizationId,
                content: messageParts[i],
                message_type: "text",
                is_from_user: true,
                sent_from_platform: true,
                sender_name: "I.A ✨",
            })
            .select("id")
            .maybeSingle();

        if (!msgError && insertedMsg?.id) {
            await invokeWithRetry(supabase, "send-to-evolution", {
                body: { messageId: insertedMsg.id },
            });
        }
    }

    return { success: true, message: `Resposta I.A enviada (${messageParts.length} mensagens divididas).` };
}
