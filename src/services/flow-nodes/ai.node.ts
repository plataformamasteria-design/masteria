import { FlowStep } from '@/services/flow-triggers.service';
import { ExecutionContext, NodeResult, NodeHandler } from './types';
import { db } from '@/lib/db';
import { automationFlowExecutions, messages, conversations, aiPersonas, kanbanLeads, automationFlows, connections, agentMediaLibrary } from '@/lib/db/schema';
import { eq, and, desc, asc, isNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';
import { executeCopilotCommand } from '@/lib/copilot-engine';
import { interpolateTemplate } from '@/lib/flow-engine';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { scheduleFollowUp } from '@/lib/ai-followup-scheduler';
import { logContactEvent } from '@/lib/contact-events';
import { emitToCompany } from '@/lib/socket';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';

export class AINodeHandler implements NodeHandler {
    async execute(step: FlowStep, ctx: ExecutionContext, allSteps: FlowStep[]): Promise<NodeResult> {
        switch (step.type) {
        case 'ai_copilot': {
            // ZERO-CONFIG: O nó não precisa de prompt. A KB do Ajudante Master guia tudo.
            // Se um prompt for configurado, ele é usado como refinamento da missão.
            // Se não houver prompt, o Copilot lê a última mensagem do lead e responde naturalmente.
            const rawPrompt = (step.data.prompt || '').trim();
            const outputVar = step.data.output_variable || 'copilot_response';
            const replyWithAudio = !!step.data.reply_with_audio;
            const ttsVoiceId = step.data.tts_voice_id || 'Aoede';
            const ttsProvider = step.data.tts_provider || 'gemini';

            try {
                // Obter a conversa atual para contexto e salvamento
                const conv = await db.query.conversations.findFirst({
                    where: (conversations, { eq }) => eq(conversations.contactId, ctx.contactId || '')
                });

                // ════════════════════════════════════════════
                // 🎤 DETECÇÃO DE ÚLTIMA MENSAGEM DO LEAD (texto ou áudio)
                // ════════════════════════════════════════════
                let lastLeadMessageText: string | null = null;
                let audioTranscription: string | null = null;

                if (conv) {
                    try {
                        const lastContactMsg = await db.query.messages.findFirst({
                            where: (msgs, { and, eq, inArray }) => and(
                                eq(msgs.conversationId, conv.id),
                                inArray(msgs.senderType, ['CONTACT', 'USER'])
                            ),
                            orderBy: (msgs, { desc }) => [desc(msgs.sentAt)],
                        });

                        if (lastContactMsg) {
                            const isAudioMsg = lastContactMsg?.contentType?.toUpperCase() === 'AUDIO' ||
                                lastContactMsg?.contentType?.toUpperCase() === 'VOICE' ||
                                lastContactMsg?.contentType?.toLowerCase() === 'ptt';

                            if (isAudioMsg && lastContactMsg?.mediaUrl) {
                                // Áudio: usar transcrição existente ou transcrever agora
                                if ((lastContactMsg as any).aiTranscription) {
                                    audioTranscription = (lastContactMsg as any).aiTranscription;
                                    logger.debug(`[FLOW-ENGINE/Copilot] 🎤 Usando transcrição existente do áudio.`);
                                } else {
                                    logger.debug(`[FLOW-ENGINE/Copilot] 🎤 Transcrevendo áudio antes de chamar o Copilot...`);
                                    try {
                                        const { transcribeAudioOpenAI } = await import('@/services/openai-transcription.service');
                                        const audioResp = await fetch(lastContactMsg.mediaUrl, { signal: AbortSignal.timeout(15000) });
                                        if (audioResp.ok) {
                                            const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
                                            const transcribed = await transcribeAudioOpenAI(audioBuffer, 'audio/ogg', ctx.companyId);
                                            if (transcribed && transcribed.trim().length > 0 && !transcribed.includes('[Sem fala detectada]')) {
                                                audioTranscription = `[Áudio Transcrito]: ${transcribed}`;
                                                await db.update(messages)
                                                    .set({ aiTranscription: audioTranscription })
                                                    .where(eq(messages.id, lastContactMsg.id));
                                                logger.debug(`[FLOW-ENGINE/Copilot] ✅ Áudio transcrito e salvo no banco.`);
                                            } else {
                                                audioTranscription = '[Áudio sem fala detectável]';
                                                await db.update(messages)
                                                    .set({ aiTranscription: audioTranscription })
                                                    .where(eq(messages.id, lastContactMsg.id));
                                            }
                                        }
                                    } catch (transcribeErr: any) {
                                        logger.debug(`[FLOW-ENGINE/Copilot] ⚠️ Falha na transcrição: ${transcribeErr.message}`);
                                    }
                                }
                                lastLeadMessageText = audioTranscription || '[Lead enviou um áudio]';
                            } else {
                                // Texto normal
                                lastLeadMessageText = (lastContactMsg.content || '').trim();
                            }
                        }
                    } catch (detectErr) {
                        logger.debug('[FLOW-ENGINE/Copilot] Erro ao detectar última mensagem:', detectErr);
                    }
                }

                // ════════════════════════════════════════════
                // 🧠 MONTAGEM AUTOMÁTICA DA MISSÃO
                // ════════════════════════════════════════════
                // Se não houver prompt configurado, o Copilot responde à última mensagem do lead.
                // Se houver prompt, ele serve como refinamento/instrução adicional.
                let finalPrompt: string;

                if (!rawPrompt) {
                    // ZERO-CONFIG: responder naturalmente ao que o lead disse
                    if (lastLeadMessageText && !lastLeadMessageText.includes('sem fala')) {
                        finalPrompt = lastLeadMessageText;
                    } else {
                        // Nenhuma mensagem identificável — Copilot analisa o contexto e toma iniciativa
                        finalPrompt = 'Analise o contexto desta conversa e tome a melhor ação para avançar o lead no processo comercial.';
                    }
                } else {
                    // PROMPT CONFIGURADO: usa como missão, enriquecido com a última mensagem do lead
                    const interpolated = await interpolateTemplate(rawPrompt, ctx);
                    if (lastLeadMessageText && !lastLeadMessageText.includes('sem fala') && !interpolated.includes(lastLeadMessageText)) {
                        finalPrompt = `${interpolated}\n\n[ÚLTIMA MENSAGEM DO LEAD]: "${lastLeadMessageText}"`;
                    } else {
                        finalPrompt = interpolated;
                    }
                }

                const historyLimit = step.data.history_limit !== undefined ? Number(step.data.history_limit) : 5;

                const result = await executeCopilotCommand(finalPrompt, ctx.companyId, conv?.id, historyLimit);
                
                // Salvar a resposta no contexto
                if (!ctx.variables) ctx.variables = {};
                ctx.variables[outputVar] = result.reply;

                let sentConnectionId = 'none';

                // Enviar a mensagem pela conexão original (podendo ser Evolution ou Oficial)
                try {
                    sentConnectionId = ctx.connectionId;
                    let sendSuccess = false;
                    const replyText = result.reply.replace(/___TOKENS:\d+/g, '').trim();

                    if (ctx.contactPhone || ctx.contactId) {
                        // 🎤 MODO ÁUDIO: Gerar TTS e enviar como nota de voz
                        if (replyWithAudio && replyText) {
                            try {
                                logger.debug(`[FLOW-ENGINE/Copilot] 🎤 Gerando áudio TTS com ${ttsProvider}...`);
                                const { generateSpeech } = await import('@/services/tts-factory.service');
                                const audioBuffer = await generateSpeech(replyText, {
                                    provider: ttsProvider as any,
                                    voiceId: ttsVoiceId,
                                    companyId: ctx.companyId,
                                });
                                const sendAudioRes = await sendUnifiedMessage({
                                    provider: (ctx.provider as any) || 'evolution',
                                    connectionId: ctx.connectionId,
                                    to: ctx.contactPhone || ctx.contactId,
                                    message: '',
                                    mediaBuffer: audioBuffer,
                                    mediaType: 'audio',
                                    isVoice: true,
                                });
                                sendSuccess = sendAudioRes.success;
                                if (!sendSuccess) {
                                    // Fallback para texto se áudio falhar
                                    logger.debug(`[FLOW-ENGINE/Copilot] ⚠️ TTS falhou, enviando como texto.`);
                                    const fallback = await sendUnifiedMessage({
                                        provider: (ctx.provider as any) || 'evolution',
                                        connectionId: ctx.connectionId,
                                        to: ctx.contactPhone || ctx.contactId,
                                        message: replyText,
                                    });
                                    sendSuccess = fallback.success;
                                }
                            } catch (ttsErr: any) {
                                logger.debug(`[FLOW-ENGINE/Copilot] ⚠️ Erro no TTS: ${ttsErr.message}. Enviando como texto.`);
                                const fallback = await sendUnifiedMessage({
                                    provider: (ctx.provider as any) || 'evolution',
                                    connectionId: ctx.connectionId,
                                    to: ctx.contactPhone || ctx.contactId,
                                    message: replyText,
                                });
                                sendSuccess = fallback.success;
                            }
                        } else {
                            // 💬 MODO TEXTO: Envio normal
                            const sendRes = await sendUnifiedMessage({
                                provider: (ctx.provider as any) || 'evolution',
                                connectionId: ctx.connectionId,
                                to: ctx.contactPhone || ctx.contactId,
                                message: replyText,
                            });
                            sendSuccess = sendRes.success;
                        }
                    }

                    // Registrar a resposta do Copilot no chat (Visibilidade)
                    if (conv && sendSuccess) {
                        try {
                            const [savedMessage] = await db.insert(messages).values({
                                id: crypto.randomUUID(),
                                companyId: ctx.companyId,
                                conversationId: conv.id,
                                connectionId: sentConnectionId,
                                content: replyText,
                                contentType: replyWithAudio ? 'AUDIO' : 'TEXT',
                                senderType: 'AI',
                                isAiGenerated: true,
                                aiTokensUsed: result.tokensUsed || null,
                                status: 'SENT',
                                sentAt: new Date(),
                            }).returning();
                            
                            await db.update(conversations)
                                .set({ lastMessageAt: new Date() })
                                .where(eq(conversations.id, conv.id));

                            if (savedMessage) {
                                emitToCompany(ctx.companyId, 'chat:new-message', {
                                    conversationId: conv.id,
                                    messageId: savedMessage.id,
                                    connectionId: sentConnectionId,
                                    contactPhone: ctx.contactPhone || '',
                                    contactName: ctx.contactName || '',
                                    content: savedMessage.content,
                                    contentType: savedMessage.contentType,
                                    mediaUrl: null,
                                    isFromMe: true,
                                    senderType: 'AI',
                                    aiTokensUsed: result.tokensUsed || null,
                                    timestamp: new Date().toISOString(),
                                });
                                emitToCompany(ctx.companyId, 'inbox:update', { timestamp: Date.now() });
                            }

                            logger.debug(`[FLOW-ENGINE] ✅ Copilot message saved to conversation ${conv.id}`);
                        } catch (saveErr) {
                            console.error('[FLOW-ENGINE] ⚠️ Erro ao salvar mensagem do Copilot no banco:', saveErr);
                        }
                    }

                } catch (sendErr) {
                    console.error('[FLOW-ENGINE] ❌ Erro ao enviar mensagem do Copilot:', sendErr);
                }

                return { message: `Copilot executed: ${result.toolCalls?.length || 0} tools called. Reply sent via ${sentConnectionId}` };
            } catch (err: any) {
                console.error('[FLOW-ENGINE] ❌ Erro ao executar AI Copilot:', err);
                return { message: 'Copilot failed', error: err.message };
            }
        }

        // ---- AI Agent V2 ----
        case 'ai_agent':
        case 'ai': {
            const resolvedKeys = await resolveAIKeys(ctx.companyId);
            const OPENAI_KEY = (resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '').replace(/^undefined$/, '');
            const GEMINI_KEY = (resolvedKeys.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').replace(/^undefined$/, '');
            
            const provider = step.data.provider || 'openai';
            let modelName = step.data.model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
            
            // Corrige o ID do modelo "ChatGPT 4.1" que foi adicionado na UI para o ID real da OpenAI
            if (modelName === 'chatgpt-4.1') modelName = 'gpt-4o';

            let openai: any;
            
            if (modelName.includes('gemini')) {
                if (!GEMINI_KEY) {
                    console.error('[FLOW-ENGINE] ❌ No Gemini API key configured');
                    return {
                        sourceHandle: 'completed',
                        newVars: { ai_error: 'No Gemini API key configured' },
                        message: 'AI Agent: No Gemini API key configured — skipping AI node',
                    };
                }
                // Inicializa o cliente OpenAI apontando para a base URL de compatibilidade do Gemini
                openai = new OpenAI({ 
                    apiKey: GEMINI_KEY,
                    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
                });
            } else {
                if (!OPENAI_KEY) {
                    console.error('[FLOW-ENGINE] ❌ No OpenAI API key configured');
                    return {
                        sourceHandle: 'completed',
                        newVars: { ai_error: 'No OpenAI API key configured' },
                        message: 'AI Agent: No OpenAI API key configured — skipping AI node',
                    };
                }
                openai = new OpenAI({ apiKey: OPENAI_KEY });
            }

            const parts: string[] = [];
            const basePrompt = step.data.system_message || step.data.description || step.data.systemPrompt || '';
            if (basePrompt) parts.push(basePrompt);
            
            if (step.data.learning_notes) {
                parts.push("\n\n#REGRAS ABSOLUTAS ACIMA DO PROMPT E DE TUDO, ESSAS INFORMAÇÕES ESTÃO CORRETAS E VALIDADAS E DEVEM SER SEGUIDAS A TODO CUSTO:\n" + step.data.learning_notes);
            }
            
            if (step.data.dialogue_mode && step.data.prompt) {
                parts.push(step.data.prompt);
            }
            
            if (step.data.followup_prompt) {
                parts.push(step.data.followup_prompt);
            }
            
            const objective = step.data.completion_condition || step.data.dialogue_objective;
            if (step.data.dialogue_mode && objective) {
                parts.push("\n\n🎯 OBJETIVO DO DIÁLOGO: " + objective);
                parts.push("Continue conversando naturalmente até atingir o objetivo.");
            }

            if (step.data.format_for_send) {
                parts.push("\nSepare cada parte da resposta com ⌁⌁⌁");
            }

            let systemPrompt = await interpolateTemplate(parts.join('\n\n'), ctx);
            
            const temperature = typeof step.data.temperature === 'number' ? step.data.temperature : 0.7;

            // Determine if we're in dialogue mode to use chat-based approach
            const isDialogueMode = !!step.data.dialogue_mode;

            // ── Fallback Helper ──
            const executeWithFallback = async (params: any) => {
                try {
                    return await openai.chat.completions.create(params);
                } catch (error: any) {
                    console.warn(`[FLOW-ENGINE] ⚠️ Erro no provedor primário (${modelName}). Tentando fallback instantâneo...`, error.message);
                    
                    const isGeminiPrimary = modelName.includes('gemini');
                    const fallbackModel = isGeminiPrimary ? 'gpt-4o-mini' : 'gemini-2.5-flash';
                    const fallbackKey = isGeminiPrimary ? OPENAI_KEY : GEMINI_KEY;
                    
                    if (!fallbackKey) {
                        console.error(`[FLOW-ENGINE] ❌ Fallback falhou: Sem chave de API para o provedor secundário (${fallbackModel})`);
                        throw error;
                    }

                    const fallbackOpenai = new OpenAI({ 
                        apiKey: fallbackKey, 
                        ...(isGeminiPrimary ? {} : { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' })
                    });

                    const fallbackParams = { ...params, model: fallbackModel };
                    return await fallbackOpenai.chat.completions.create(fallbackParams);
                }
            };

            // ── Resolving Connection and Provider early for Tools and Sending ──
            let aiConversation: any = null;
            if (ctx.contactId) {
                try {
                    aiConversation = await db.query.conversations.findFirst({
                        where: and(
                            eq(conversations.contactId, ctx.contactId),
                            eq(conversations.companyId, ctx.companyId)
                        ),
                        with: { connection: true },
                        orderBy: [desc(conversations.lastMessageAt)],
                    });
                } catch (e) {
                    console.warn('[FLOW-ENGINE] Failed to find conversation:', e);
                }
            }

            let aiConnectionId = step.data.connection_id || '';
            if (!aiConnectionId && aiConversation?.connectionId) {
                aiConnectionId = aiConversation.connectionId;
            }
            if (!aiConnectionId) aiConnectionId = ctx.connectionId;

            let aiProvider = 'apicloud';
            try {
                const resolvedConn = await db.query.connections.findFirst({
                    where: eq(connections.id, aiConnectionId)
                });
                if (['baileys', 'evolution'].includes(resolvedConn?.connectionType || '')) {
                    aiProvider = 'evolution';
                }
            } catch (e) {
                console.warn('[FLOW-ENGINE] Failed to resolve connection type for ai_agent, falling back to ctx.provider:', e);
                aiProvider = ctx.provider || 'apicloud';
            }

            // ── Google Calendar Tool Setup ───────────────────────────────────
            let calendarTools: object[] = [];
            let calendarToolConfig: import('@/lib/ai-calendar-tools').CalendarToolConfig | null = null;

            if (step.data.google_calendar_enabled) {
                try {
                    const { buildCalendarTools, buildCalendarSystemContext, checkGoogleCredential } =
                        await import('@/lib/ai-calendar-tools');
                    const hasCred = await checkGoogleCredential(ctx.companyId);
                    if (hasCred) {
                        calendarToolConfig = {
                            companyId: ctx.companyId,
                            createMeetLink: step.data.google_meet_enabled ?? false,
                            durationMinutes: step.data.appointment_duration ?? 30,
                            workingHoursStart: step.data.working_hours_start ?? 9,
                            workingHoursEnd: step.data.working_hours_end ?? 18,
                            calendarInstruction: step.data.calendar_instruction || '',
                        };
                        calendarTools = buildCalendarTools(calendarToolConfig);
                        // Prepend calendar context to system prompt
                        const calCtx = buildCalendarSystemContext(calendarToolConfig);
                        systemPrompt = calCtx + (systemPrompt ? '\n\n' + systemPrompt : '');
                        logger.debug('[FLOW-ENGINE] 📅 Google Calendar tools enabled for this agent');
                    } else {
                        console.warn('[FLOW-ENGINE] ⚠️ google_calendar_enabled=true but no active credential found');
                    }
                } catch (calErr) {
                    console.error('[FLOW-ENGINE] Calendar tools setup error:', calErr);
                }
            }

            // ── Agent Media Library Setup ───────────────────────────────────
            let libraryFiles: any[] = [];
            let mediaTools: object[] = [];
            if (step.data.media_library_enabled) {
                try {
                    const files = await db
                        .select()
                        .from(agentMediaLibrary)
                        .where(
                            and(
                                eq(agentMediaLibrary.organizationId, ctx.companyId),
                                eq(agentMediaLibrary.nodeId, step.id)
                            )
                        )
                        .orderBy(desc(agentMediaLibrary.createdAt));
                        
                    libraryFiles = files;

                    if (libraryFiles.length > 0) {
                        const parts: string[] = [];
                        
                        if (isDialogueMode) {
                            const fileNames = libraryFiles.map((f: any) => f.fileName).filter(Boolean);
                            const uniqueFileNames = [...new Set(fileNames)];
                            if (uniqueFileNames.length > 0) {
                                mediaTools.push({
                                    type: 'function',
                                    function: {
                                        name: 'send_media_file',
                                        description: 'Envia um catálogo, imagem, áudio ou documento para o cliente imediatamente pelo WhatsApp.',
                                        parameters: {
                                            type: 'object',
                                            properties: {
                                                fileName: {
                                                    type: 'string',
                                                    description: 'O nome exato do arquivo a enviar.',
                                                    enum: uniqueFileNames
                                                }
                                            },
                                            required: ['fileName']
                                        }
                                    }
                                });
                            }

                            // INJETAR RAG: Adiciona o texto extraído dos documentos como Base de Conhecimento
                            const ragDocs = libraryFiles.filter((f: any) => f.extractedText && f.extractedText.trim().length > 0);
                            if (ragDocs.length > 0) {
                                parts.push("\n\n📚 [BASE DE CONHECIMENTO / DOCUMENTOS ANEXADOS]");
                                parts.push("Você tem acesso ao conteúdo dos seguintes documentos. USE ESTAS INFORMAÇÕES para responder às perguntas do usuário e guiar a conversa:");
                                ragDocs.forEach((doc: any) => {
                                    const safeText = doc.extractedText.length > 25000 ? doc.extractedText.substring(0, 25000) + '... [TRUNCADO]' : doc.extractedText;
                                    parts.push(`\n--- INÍCIO DO DOCUMENTO: ${doc.fileName} ---`);
                                    parts.push(safeText);
                                    parts.push(`--- FIM DO DOCUMENTO: ${doc.fileName} ---`);
                                });
                            }

                            parts.push("\n\n📂 [BIBLIOTECA DE ARQUIVOS]");
                            parts.push("Você possui acesso a arquivos da empresa para enviar ao lead. NÃO DIGA que não consegue enviar arquivos ou que só pode enviar por e-mail. VOCÊ PODE ENVIAR ARQUIVOS DIRETAMENTE VIA WHATSAPP.");
                            parts.push("COMO ENVIAR: Chame IMEDIATAMENTE a função 'send_media_file' passando o 'fileName' exato do arquivo desejado.");
                            parts.push("ARQUIVOS DISPONÍVEIS:");
                            libraryFiles.forEach((f: any) => {
                                const name = f.fileName;
                                const desc = f.description ? `(quando usar: ${f.description})` : '';
                                if (name) parts.push(` - ${name} ${desc}`);
                            });
                        } else {
                            // Fallback for single-shot
                            const ragDocs = libraryFiles.filter((f: any) => f.extractedText && f.extractedText.trim().length > 0);
                            if (ragDocs.length > 0) {
                                parts.push("\n\n📚 [BASE DE CONHECIMENTO]");
                                parts.push("USE ESTAS INFORMAÇÕES DOS ARQUIVOS ANEXADOS para responder à pergunta:");
                                ragDocs.forEach((doc: any) => {
                                    const safeText = doc.extractedText.length > 25000 ? doc.extractedText.substring(0, 25000) + '... [TRUNCADO]' : doc.extractedText;
                                    parts.push(`\n--- CONTEÚDO DE ${doc.fileName} ---`);
                                    parts.push(safeText);
                                    parts.push(`-----------------------`);
                                });
                            }

                            parts.push("\n\n📂 CAPACIDADE DE ENVIO DE ARQUIVOS — LEIA COM ATENÇÃO:");
                            parts.push("VOCÊ TEM TOTAL CAPACIDADE de enviar imagens e documentos para o cliente. NÃO diga que não pode enviar arquivos. Este sistema suporta envio de mídia.");
                            parts.push("COMO FUNCIONA: Quando quiser enviar um arquivo, adicione ao FINAL de sua mensagem exatamente esta tag: [ARQUIVO:nome-exato-do-arquivo.extensão]");
                            parts.push("ARQUIVOS DISPONÍVEIS PARA ENVIO:");
                            libraryFiles.forEach((f: any) => {
                                const name = f.fileName;
                                const desc = f.description ? ` (usar quando: ${f.description})` : '';
                                if (name) parts.push(`  → [ARQUIVO:${name}]${desc}`);
                            });
                        }
                        
                        systemPrompt = systemPrompt + parts.join('\n');
                        logger.debug(`[FLOW-ENGINE] 📎 Media Library enabled. Found ${libraryFiles.length} files.`);
                    }
                } catch (libErr) {
                    console.error('[FLOW-ENGINE] Media Library setup error:', libErr);
                }
            }

            // Build webhook vars context string (used in both modes)
            let webhookContext = '';
            if (step.data.include_webhook_vars && step.data.webhook_var_keys?.length) {
                const webhookData: string[] = [];
                for (const key of step.data.webhook_var_keys) {
                    if (ctx.variables[key] !== undefined) {
                        webhookData.push(`${key}: ${ctx.variables[key]}`);
                    }
                }
                if (webhookData.length) {
                    webhookContext = `\n\n[Dados do Webhook]:\n${webhookData.join('\n')}`;
                }
            }

            let responseText = '';
            let tokenInfo: any = null;

            if (isDialogueMode) {
                // ===== DIALOGUE MODE: OpenAI Chat Completion =====
                const chatHistory: any[] = [];
                
                // 1. System Prompt + Webhook Data
                const fullSystem = (systemPrompt + webhookContext).trim();
                if (fullSystem) chatHistory.push({ role: 'system', content: fullSystem });

                // 2. Chat history from DB
                if (step.data.include_history !== false && ctx.contactId) {
                    const historyCount = step.data.history_count || 20;
                    try {
                        const conversation = await db.query.conversations.findFirst({
                            where: and(
                                eq(conversations.contactId, ctx.contactId),
                                eq(conversations.companyId, ctx.companyId)
                            ),
                            orderBy: [desc(conversations.lastMessageAt)],
                        });

                        if (conversation) {
                            const recentMessages = await db.select()
                                .from(messages)
                                .where(eq(messages.conversationId, conversation.id))
                                .orderBy(desc(messages.sentAt))
                                .limit(historyCount);

                            let totalChars = 0;
                            const MAX_CHARS = 30000; // ~7500 tokens limit to prevent context overflow
                            const keptMessages: any[] = [];

                            for (const m of recentMessages) {
                                // 🔧 BUG FIX: Excluir mensagens de sistema do histórico enviado ao GPT
                                if (m.senderType === 'SYSTEM') continue;

                                // 🔧 BUG FIX: Limpar tokens contaminados do histórico e usar aiTranscription para áudios
                                const content = ((m as any).aiTranscription || m.content || '').replace(/_+TOKENS:\d+/g, '').trim();
                                if (!content) continue;

                                if (totalChars + content.length > MAX_CHARS) {
                                    logger.debug(`[FLOW-ENGINE] ✂️ Context limit reached. Truncating older messages (Char count: ${totalChars})`);
                                    break; // Stop adding older messages to stay within token limits
                                }
                                totalChars += content.length;

                                const isLead = m.senderType === 'USER' || m.senderType === 'CONTACT';
                                keptMessages.push({ role: isLead ? 'user' : 'assistant', content });
                            }

                            // Reverse to chronological order after safely filtering
                            chatHistory.push(...keptMessages.reverse());
                        }
                    } catch (e) {
                        console.warn('[FLOW-ENGINE] Failed to fetch chat history for dialogue:', e);
                    }
                }

                // Remove the last entry if it's a 'user' message (it might be the trigger)
                if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
                    chatHistory.pop();
                }

                // 3. The lead's current message
                const leadMessage = ctx.variables.last_response || ctx.variables.message_text || 'Olá';
                chatHistory.push({ role: 'user', content: leadMessage });

                logger.debug(`[FLOW-ENGINE] 💬 Dialogue mode: ${chatHistory.length} history entries, sending new message`);

                try {
                    const completionParams: Parameters<typeof openai.chat.completions.create>[0] = {
                        model: modelName,
                        messages: chatHistory,
                        temperature,
                        ...((calendarTools.length > 0 || mediaTools.length > 0) && { tools: [...calendarTools, ...mediaTools] as any, tool_choice: 'auto' as const }),
                    };

                    let completion = await executeWithFallback(completionParams);

                    // ── Tool-calling loop for Google Calendar ────────────────
                    let toolIterations = 0;
                    const maxToolIterations = step.data.max_iterations || 5;

                    while (
                        completion.choices[0]?.finish_reason === 'tool_calls' &&
                        toolIterations < maxToolIterations
                    ) {
                        const toolCalls = completion.choices[0]?.message?.tool_calls || [];
                        chatHistory.push(completion.choices[0].message);

                        const { executeCalendarTool } = await import('@/lib/ai-calendar-tools');

                        for (const toolCall of toolCalls) {
                            let toolArgs: Record<string, unknown> = {};
                            try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}

                            logger.debug(`[FLOW-ENGINE] 🔧 Tool call: ${toolCall.function.name}`, toolArgs);

                            let toolResult: any;

                            if (toolCall.function.name === 'send_media_file') {
                                const fileName = toolArgs.fileName as string;
                                ctx['_last_tool_args'] = toolArgs;
                                // Remove acentos para comparação
                                const normalize = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

                                const attachedFile = libraryFiles.find((f: any) => 
                                    f.fileName === fileName || 
                                    normalize(f.fileName) === normalize(fileName) ||
                                    normalize(f.fileName).includes(normalize(fileName))
                                );
                                
                                if (attachedFile) {
                                    try {
                                        const resolveMediaCategory = (ft: string | null | undefined, name: string | null | undefined): 'image' | 'video' | 'audio' | 'document' => {
                                            const type = (ft || '').toLowerCase();
                                            const ext = (name || '').split('.').pop()?.toLowerCase() || '';
                                            if (['image', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
                                            if (['video', 'mp4', 'mov', 'avi', 'webm'].includes(type) || ['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
                                            if (['audio', 'mp3', 'ogg', 'wav', 'm4a'].includes(type) || ['mp3', 'ogg', 'wav', 'm4a'].includes(ext)) return 'audio';
                                            return 'document';
                                        };

                                        const resolvedType = resolveMediaCategory(attachedFile.fileType, attachedFile.fileName);
                                        
                                        const sendResult = await sendUnifiedMessage({
                                            provider: aiProvider as any,
                                            connectionId: aiConnectionId,
                                            to: ctx.contactPhone || '',
                                            message: '', 
                                            mediaUrl: attachedFile.fileUrl,
                                            mediaType: resolvedType,
                                            mediaFileName: attachedFile.fileName,
                                        });

                                        if (!sendResult.success) {
                                            ctx['_last_tool_error'] = sendResult.error || 'Erro desconhecido ao enviar mídia.';
                                            throw new Error(sendResult.error || 'Erro desconhecido ao enviar mídia.');
                                        }

                                        if (aiConversation) {
                                            const [savedMessage] = await db.insert(messages).values({
                                                companyId: ctx.companyId,
                                                conversationId: aiConversation.id,
                                                connectionId: aiConnectionId || null,
                                                senderType: 'AI',
                                                content: `[Arquivo enviado: ${attachedFile.fileName}]`,
                                                contentType: attachedFile.fileType?.toUpperCase() || 'DOCUMENT',
                                                mediaUrl: attachedFile.fileUrl,
                                                status: 'SENT',
                                                sentAt: new Date(),
                                                isAiGenerated: true,
                                            }).returning();

                                            if (savedMessage) {
                                                emitToCompany(ctx.companyId, 'chat:new-message', {
                                                    conversationId: aiConversation.id,
                                                    messageId: savedMessage.id,
                                                    connectionId: aiConnectionId || null,
                                                    contactPhone: ctx.contactPhone || '',
                                                    contactName: ctx.contactName || '',
                                                    content: savedMessage.content,
                                                    contentType: savedMessage.contentType,
                                                    mediaUrl: savedMessage.mediaUrl,
                                                    isFromMe: true,
                                                    senderType: 'AI',
                                                    timestamp: new Date().toISOString(),
                                                });
                                                emitToCompany(ctx.companyId, 'inbox:update', { timestamp: Date.now() });
                                            }
                                        }

                                        toolResult = { success: true, message: `O arquivo ${fileName} foi enviado no WhatsApp do cliente com sucesso. Agora responda confirmando que enviou.` };
                                        logger.debug(`[FLOW-ENGINE] 📎 Media Tool: Sent ${fileName}`);
                                    } catch (err: any) {
                                        ctx['_last_tool_error'] = err.message;
                                        toolResult = { success: false, message: `Falha ao enviar arquivo: ${err.message}` };
                                    }
                                } else {
                                    ctx['_last_tool_error'] = `Arquivo não encontrado: ${fileName}`;
                                    toolResult = { success: false, message: `Arquivo não encontrado: ${fileName}.` };
                                }
                            } else {
                                toolResult = await executeCalendarTool(
                                    toolCall.function.name,
                                    toolArgs,
                                    ctx.companyId,
                                    {
                                        contactName: ctx.contactName || '',
                                        contactEmail: ctx.contactEmail || null,
                                        contactPhone: ctx.contactPhone,
                                        contactId: ctx.contactId,
                                        conversationId: ctx.variables.conversation_id as string | undefined,
                                        config: calendarToolConfig!,
                                    }
                                );
                            }

                            logger.debug(`[FLOW-ENGINE] ✅ Tool result: ${toolCall.function.name}`, toolResult);

                            chatHistory.push({
                                role: 'tool' as const,
                                tool_call_id: toolCall.id,
                                content: JSON.stringify(toolResult.data || toolResult),
                            });

                            // Auto-send Meet link to lead after successful appointment creation
                            if (
                                toolCall.function.name === 'create_appointment' &&
                                toolResult.success &&
                                toolResult.meetLink &&
                                step.data.google_meet_enabled
                            ) {
                                try {
                                    const meetMsg = `📅 Link da sua videochamada:\n${toolResult.meetLink}`;
                                    await sendUnifiedMessage({
                                        provider: aiProvider as any,
                                        connectionId: aiConnectionId,
                                        to: ctx.contactPhone || '',
                                        message: meetMsg,
                                    });
                                    logger.debug('[FLOW-ENGINE] 📅 Meet link sent to lead');
                                } catch (meetSendErr) {
                                    console.warn('[FLOW-ENGINE] Failed to send Meet link:', meetSendErr);
                                }
                            }
                        }

                        completion = await executeWithFallback({
                            ...completionParams,
                            messages: chatHistory,
                        });
                        toolIterations++;
                    }

                    responseText = completion.choices[0]?.message?.content?.trim() || '';
                    
                    // ✅ FIX: Exhaustion Fallback
                    // Se o loop terminou por atingir max_iterations e a IA não gerou uma resposta textual (ainda está em tool_calls),
                    // injeta uma resposta amigável de espera para não deixar o cliente no vácuo.
                    if (!responseText && completion.choices[0]?.finish_reason === 'tool_calls') {
                        logger.warn('[FLOW-ENGINE] ⚠️ AI Agent reached max tool iterations with empty response. Injecting fallback.');
                        responseText = 'Estou verificando os dados no sistema, só um momento por favor...';
                    }
                    if (completion.usage) {
                        tokenInfo = {
                            promptTokens: completion.usage.prompt_tokens,
                            completionTokens: completion.usage.completion_tokens,
                            totalTokens: completion.usage.total_tokens,
                        };
                    }
                } catch (error: any) {
                    console.error('[FLOW-ENGINE] OpenAI Dialogue Error:', error.message || error);
                    // 🔧 BUG FIX: Graceful fallback em caso de erro 429/cota OpenAI
                    const isQuotaError = error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('insufficient');
                    const isContextError = error?.status === 400 && (error?.message?.includes('context length') || error?.message?.includes('maximum context'));
                    
                    if (isQuotaError) {
                        responseText = 'Peço desculpas, mas estou enfrentando uma leve instabilidade no sistema. Por favor, aguarde um instante enquanto direcionamos para um especialista.';
                    } else if (isContextError) {
                        logger.warn('[FLOW-ENGINE] ⚠️ Context length exceeded, generating friendly fallback...');
                        try {
                            const OPENAI_KEY = process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
                            const fbOpenai = new OpenAI({ apiKey: OPENAI_KEY });
                            const fbHistory = chatHistory.slice(-15).filter(m => m.role === 'user' || m.role === 'assistant');
                            const fbPrompt = "Você é um atendente humano. Ocorreu um erro técnico de 'Context Length Exceeded' porque o cliente mandou mensagens muito longas ou temos muitos documentos. Escreva uma mensagem curta e humanizada avisando o cliente que o volume de informações foi um pouco grande, que você está processando com calma, e pedindo para aguardar. Não use jargões de IA.";
                            
                            const fbCompletion = await fbOpenai.chat.completions.create({
                                model: 'gpt-4o-mini',
                                messages: [
                                    { role: 'system', content: fbPrompt },
                                    ...fbHistory
                                ]
                            });
                            responseText = fbCompletion.choices[0]?.message?.content?.trim() || 'Poxa, é bastante informação! Deixa eu analisar com calma, só um instante...';
                        } catch (fbErr) {
                            responseText = 'Deixa eu analisar essas informações com calma, me dê só um instante por favor...';
                        }
                    } else {
                        throw error; // Let the step block catch it
                    }
                }

            } else {
                // ===== SINGLE-SHOT MODE: OpenAI generateContent equivalent =====
                const inputParts: string[] = [];

                if (step.data.include_lead_message !== false) {
                    const leadMessage = ctx.variables.last_response || ctx.variables.message_text || '';
                    if (leadMessage) {
                        inputParts.push(`[Mensagem do Lead]: ${leadMessage}`);
                    }
                }

                if (webhookContext) {
                    inputParts.push(webhookContext);
                }

                if (step.data.include_history !== false && ctx.contactId) {
                    const historyCount = step.data.history_count || 10;
                    try {
                        const conversation = await db.query.conversations.findFirst({
                            where: and(
                                eq(conversations.contactId, ctx.contactId),
                                eq(conversations.companyId, ctx.companyId)
                            ),
                            orderBy: [desc(conversations.lastMessageAt)],
                        });

                        if (conversation) {
                            const recentMessages = await db.select()
                                .from(messages)
                                .where(eq(messages.conversationId, conversation.id))
                                .orderBy(desc(messages.sentAt))
                                .limit(historyCount);

                            if (recentMessages.length > 0) {
                                const historyFormatted = recentMessages
                                    .reverse()
                                    .map(m => {
                                        const role = m.senderType === 'USER' || m.senderType === 'CONTACT' ? 'Lead' : 'Assistente';
                                        const cleanContent = (m.content || '').replace(/_+TOKENS:\d+/g, '').trim();
                                        return `${role}: ${cleanContent}`;
                                    })
                                    .join('\n');
                                inputParts.push(`[Histórico de Conversa(últimas ${recentMessages.length} msgs)]:\n${historyFormatted}`);
                            }
                        }
                    } catch (e) {
                        console.warn('[FLOW-ENGINE] Failed to fetch chat history:', e);
                    }
                }

                // ✅ FIX: Single-Shot Calendar Warning
                // O modo Single-Shot não suporta funções (tools) do Calendar. Se estiver ativado, a IA tentaria inventar horários.
                if (step.data.google_calendar_enabled) {
                    inputParts.push(`[AVISO DO SISTEMA]: Você está configurado no modo 'Resposta Única' (sem funções de sistema). Portanto, VOCÊ NÃO PODE agendar horários ou consultar o Google Calendar no momento. Se o cliente pedir um agendamento, informe que não é possível fazer isso agora de forma automática.`);
                }

                const userInput = inputParts.join('\n\n') || 'Sem input disponível';
                
                const messagesPayload: any[] = [];
                if (systemPrompt) messagesPayload.push({ role: 'system', content: systemPrompt });
                messagesPayload.push({ role: 'user', content: userInput });

                try {
                    const completion = await executeWithFallback({
                        model: modelName,
                        messages: messagesPayload,
                        temperature,
                    });
    
                    responseText = completion.choices[0]?.message?.content?.trim() || '';
                    if (completion.usage) {
                        tokenInfo = {
                            promptTokens: completion.usage.prompt_tokens,
                            completionTokens: completion.usage.completion_tokens,
                            totalTokens: completion.usage.total_tokens,
                        };
                    }
                } catch (error: any) {
                    console.error('[FLOW-ENGINE] OpenAI Single-Shot Error:', error.message || error);
                    // 🔧 BUG FIX: Graceful fallback em caso de erro 429/cota OpenAI
                    const isQuotaError = error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('insufficient');
                    const isContextError = error?.status === 400 && (error?.message?.includes('context length') || error?.message?.includes('maximum context'));
                    
                    if (isQuotaError) {
                        responseText = 'Peço desculpas, mas estou enfrentando uma leve instabilidade no sistema. Por favor, aguarde um instante enquanto direcionamos para um especialista.';
                    } else if (isContextError) {
                        logger.warn('[FLOW-ENGINE] ⚠️ Context length exceeded (Single-Shot), generating friendly fallback...');
                        try {
                            const OPENAI_KEY = process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
                            const fbOpenai = new OpenAI({ apiKey: OPENAI_KEY });
                            
                            // Remove o histórico enorme do prompt
                            const leadMessage = ctx.variables.last_response || ctx.variables.message_text || '';
                            const fbPrompt = "Você é um atendente humano via WhatsApp. Ocorreu um erro técnico de 'Context Length Exceeded' porque o documento enviado no fluxo era muito grande. Baseado na última mensagem do cliente, escreva uma mensagem curta, empática e humanizada avisando que a quantidade de informação ou arquivo foi um pouco grande, e que você está processando, pedindo para aguardar um instante ou resumir. Não use jargões de IA.";
                            
                            const fbCompletion = await fbOpenai.chat.completions.create({
                                model: 'gpt-4o-mini',
                                messages: [
                                    { role: 'system', content: fbPrompt },
                                    { role: 'user', content: `Última mensagem do cliente: ${leadMessage}` }
                                ]
                            });
                            responseText = fbCompletion.choices[0]?.message?.content?.trim() || 'Poxa, é bastante informação! Deixa eu analisar com calma, só um instante...';
                        } catch (fbErr) {
                            responseText = 'Deixa eu analisar essas informações com calma, me dê só um instante por favor...';
                        }
                    } else {
                        throw error;
                    }
                }
            }

            if (tokenInfo) {
                logger.debug(`[FLOW-ENGINE] 📊 Tokens: prompt=${tokenInfo.promptTokens}, completion=${tokenInfo.completionTokens}, total=${tokenInfo.totalTokens}`);
            }

            // 3. ENVIAR RESPOSTA ao lead (mesmo padrão do chat.ts / auto-approach)
            if (responseText && ctx.contactPhone) {
                logger.debug(`[FLOW-ENGINE] 🤖 AI sending via ${aiProvider} connection=${aiConnectionId} to=${ctx.contactPhone}`);

                // Dividir mensagem em partes para simular humano
                const parts = responseText.split('\n\n').filter((s: string) => s.trim());

                // ✅ FIX Bug #1: Normaliza fileType do banco ('pdf', 'jpg', etc.) para categoria
                // aceita pelo sendUnifiedMessage ('document' | 'image' | 'video' | 'audio')
                const resolveMediaCategory = (fileType: string | null | undefined, fileName: string | null | undefined): 'image' | 'video' | 'audio' | 'document' => {
                    const ft = (fileType || '').toLowerCase();
                    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

                    if (['image', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ft) ||
                        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';

                    if (['video', 'mp4', 'mov', 'avi', 'webm'].includes(ft) ||
                        ['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';

                    if (['audio', 'mp3', 'ogg', 'wav', 'm4a'].includes(ft) ||
                        ['mp3', 'ogg', 'wav', 'm4a'].includes(ext)) return 'audio';

                    return 'document'; // pdf, docx, xlsx, txt, etc.
                };

                // Helper de extração de tag ARQUIVO
                const extractFileTag = (text: string, files: any[]): { cleanText: string; file?: any } => {
                    let cleanText = text;
                    const fileMatch = cleanText.match(/\[ARQUIVO:([^\]]+)\]/i);
                    let sendFileName = null;
                    if (fileMatch) {
                        sendFileName = fileMatch[1].trim().toLowerCase();
                        cleanText = cleanText.replace(/\[ARQUIVO:[^\]]+\]/gi, '').trim();
                    }

                    if (!sendFileName) return { cleanText };

                    let found = files.find((f: any) => f.fileName?.toLowerCase() === sendFileName);
                    if (!found) {
                        found = files.find((f: any) => {
                            const name = f.fileName?.toLowerCase() || '';
                            return name.includes(sendFileName!) || sendFileName!.includes(name.replace(/\.[^.]+$/, ''));
                        });
                    }
                    if (!found && files.length > 0) {
                        found = files[0];
                    }
                    return { cleanText, file: found };
                };

                for (let i = 0; i < parts.length; i++) {
                    if (i > 0) await new Promise(r => setTimeout(r, 2000));
                    try {
                        const extracted = extractFileTag(parts[i].trim(), libraryFiles);
                        const finalMessage = extracted.cleanText;
                        const attachedFile = extracted.file;

                        // ✅ FIX Bug #1: usar resolveMediaCategory em vez de attachedFile.fileType raw
                        const resolvedMediaType = attachedFile
                            ? resolveMediaCategory(attachedFile.fileType, attachedFile.fileName)
                            : undefined;

                        if (attachedFile) {
                            logger.debug(`[FLOW-ENGINE] 📎 Sending media file: ${attachedFile.fileName} (raw type: ${attachedFile.fileType} → resolved: ${resolvedMediaType})`);
                        }

                        // Enviar via sendUnifiedMessage (suporta anexos nativos)
                        const sendResult = await sendUnifiedMessage({
                            provider: aiProvider as any,
                            connectionId: aiConnectionId,
                            to: ctx.contactPhone,
                            message: finalMessage,
                            mediaUrl: attachedFile ? attachedFile.fileUrl : undefined,
                            mediaType: resolvedMediaType,
                            mediaFileName: attachedFile ? attachedFile.fileName : undefined,
                        });

                        if (!sendResult.success) {
                            console.error(`[FLOW - ENGINE] ❌ AI send failed: ${sendResult.error} `);
                            continue;
                        }

                        logger.debug(`[FLOW - ENGINE] ✅ AI message sent: ${sendResult.messageId || 'ok'} `);

                        // Salvar no DB (mesmo padrão do auto-approach: company_id + SENT)
                        if (aiConversation) {
                            try {
                                const [savedMessage] = await db.insert(messages).values({
                                    companyId: ctx.companyId,
                                    conversationId: aiConversation.id,
                                    connectionId: aiConnectionId || null,
                                    providerMessageId: sendResult.messageId || null,
                                    senderType: 'AI',
                                    // 🔧 BUG FIX: Nunca persistir tokens no content — causava contaminação no histórico
                                    // e reprodução do padrão ___TOKENS pela IA nas próximas mensagens ao WhatsApp
                                    content: finalMessage || (attachedFile ? `[Arquivo enviado: ${attachedFile.fileName}]` : ''),
                                    contentType: attachedFile ? (attachedFile.fileType?.toUpperCase() || 'DOCUMENT') : 'TEXT',
                                    status: 'SENT',
                                    sentAt: new Date(),
                                    isAiGenerated: true,
                                }).returning();
                                
                                await db.update(conversations)
                                    .set({ lastMessageAt: new Date() })
                                    .where(eq(conversations.id, aiConversation.id));

                                if (savedMessage) {
                                    emitToCompany(ctx.companyId, 'chat:new-message', {
                                        conversationId: aiConversation.id,
                                        messageId: savedMessage.id,
                                        connectionId: aiConnectionId || null,
                                        contactPhone: ctx.contactPhone || '',
                                        contactName: ctx.contactName || '',
                                        content: savedMessage.content,
                                        contentType: savedMessage.contentType,
                                        mediaUrl: attachedFile ? attachedFile.fileUrl : null,
                                        isFromMe: true,
                                        senderType: 'AI',
                                        timestamp: new Date().toISOString(),
                                    });
                                    emitToCompany(ctx.companyId, 'inbox:update', { timestamp: Date.now() });
                                }
                            } catch (dbErr) {
                                console.warn('[FLOW-ENGINE] DB save failed:', dbErr);
                            }
                        }
                    } catch (sendErr) {
                        console.error(`[FLOW - ENGINE] ❌ AI message exception: `, sendErr);
                    }
                }
            }

            // 4. MODO DIÁLOGO
            if (step.data.dialogue_mode) {
                const turnCount = (ctx.variables[`ai_turns_${step.id} `] || 0) + 1;
                const maxTurns = step.data.max_turns || 10;

                // Verificar se objetivo foi cumprido
                if (step.data.completion_condition) {
                    try {
                        const evalPrompt = `Com base na conversa abaixo, a seguinte condição foi satisfeita ?\n\nCondição: "${step.data.completion_condition}"\n\nÚltima mensagem do lead: "${ctx.variables.last_response || ''}"\nResposta do agente: "${responseText}"\n\nResponda APENAS com SIM ou NÃO.`;
                        const evalResult = await executeWithFallback({
                            model: 'gpt-4o-mini',
                            messages: [{ role: 'user', content: evalPrompt }],
                            temperature: 0,
                        });
                        const evalResponse = (evalResult.choices[0]?.message?.content?.trim() || '').toUpperCase();

                        if (evalResponse === 'SIM' || evalResponse.startsWith('SIM.') || evalResponse.startsWith('SIM,') || evalResponse.startsWith('SIM ')) {
                            return {
                                sourceHandle: 'completed',
                                newVars: {
                                    last_ai_response: responseText,
                                    [`ai_${step.id} `]: responseText,
                                    [`ai_turns_${step.id} `]: turnCount,
                                    ai_completion_reason: 'objective_met',
                                    ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
                                },
                                message: `AI Agent: objective met after ${turnCount} turns${tokenInfo ? ` | Tokens: ${tokenInfo.totalTokens}` : ''} `,
                            };
                        }
                    } catch (e) {
                        console.warn('[FLOW-ENGINE] AI completion check failed:', e);
                    }
                }

                // Verificar max turnos
                if (turnCount >= maxTurns) {
                    return {
                        sourceHandle: 'max_turns',
                        newVars: {
                            last_ai_response: responseText,
                            [`ai_${step.id} `]: responseText,
                            [`ai_turns_${step.id} `]: turnCount,
                            ai_completion_reason: 'max_turns_reached',
                            ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
                        },
                        message: `AI Agent: max turns(${maxTurns}) reached${tokenInfo ? ` | Tokens: ${tokenInfo.totalTokens}` : ''} `,
                    };
                }

                // Ainda em diálogo — pause e esperar próxima mensagem
                const newVarsToReturn: Record<string, any> = {
                    last_ai_response: responseText,
                    [`ai_${step.id} `]: responseText,
                    [`ai_turns_${step.id} `]: turnCount,
                    ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
                };

                const timeoutEnabled = step.data.timeout_enabled || step.data.response_timeout_enabled;
                if (timeoutEnabled) {
                    const timeoutAmountStr = step.data.timeout_amount || step.data.response_timeout_minutes || '30';
                    const timeoutAmount = parseInt(String(timeoutAmountStr));
                    const timeoutUnit = step.data.timeout_unit || 'minutes';
                    const multipliers: Record<string, number> = {
                        seconds: 1000,
                        minutes: 60 * 1000,
                        hours: 60 * 60 * 1000,
                        days: 24 * 60 * 60 * 1000,
                    };
                    const ms = timeoutAmount * (multipliers[timeoutUnit] || 60000);
                    if (ms > 0) {
                        newVarsToReturn._ai_timeout_at = Date.now() + ms;
                        newVarsToReturn._ai_step_id = step.id;
                    }
                }

                return {
                    action: 'pause',
                    newVars: newVarsToReturn,
                    message: `AI Agent: turn ${turnCount}/${maxTurns}, waiting for lead response${tokenInfo ? ` | Tokens: ${tokenInfo.totalTokens}` : ''}`,
                };
            }

            // 5. MODO SINGLE-SHOT (sem diálogo)
            return {
                sourceHandle: 'completed',
                newVars: {
                    last_ai_response: responseText,
                    [`ai_${step.id} `]: responseText,
                    ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
                },
                message: `AI: ${responseText.slice(0, 80)}${tokenInfo ? ` | Tokens: ${tokenInfo.totalTokens}` : ''} `,
            };
        }

        // ---- Follow Up AI ----
        case 'follow_up_ai': {
            if (ctx.variables[`follow_up_sent_${step.id}`]) {
                // If it resumes and this is true, it means the lead replied.
                return {
                    sourceHandle: 'responded',
                    message: 'Follow-Up: Lead respondeu',
                };
            }

            const resolvedKeys = await resolveAIKeys(ctx.companyId);
            const provider = step.data.provider || 'openai';
            const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
            const GEMINI_KEY = resolvedKeys.geminiApiKey || process.env.GEMINI_API_KEY || '';
            
            if (provider === 'openai' && !OPENAI_KEY) return { message: 'Follow-Up: No OpenAI API key' };
            if (provider === 'gemini' && !GEMINI_KEY) return { message: 'Follow-Up: No Gemini API key' };
            
            if (step.data.require_global_bot || step.data.require_lead_bot) {
                if (ctx.variables.bot_enabled === false && step.data.require_lead_bot) {
                    return { message: 'Follow-Up: Bot disabled for lead' };
                }
            }

            const modelName = step.data.model || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash');
            const followupPrompt = await interpolateTemplate(step.data.followup_prompt || '', ctx);
            
            const historyCount = step.data.history_count || 20;
            const chatHistory: any[] = [];
            let aiConversation = null;

            if (ctx.contactId) {
                try {
                    aiConversation = await db.query.conversations.findFirst({
                        where: and(
                            eq(conversations.contactId, ctx.contactId),
                            eq(conversations.companyId, ctx.companyId)
                        ),
                        with: { connection: true },
                        orderBy: [desc(conversations.lastMessageAt)],
                    });

                    if (aiConversation) {
                        const recentMessages = await db.select()
                            .from(messages)
                            .where(eq(messages.conversationId, aiConversation.id))
                            .orderBy(desc(messages.sentAt))
                            .limit(historyCount);

                        const chronological = recentMessages.reverse();
                        for (const m of chronological) {
                            if (m.senderType === 'SYSTEM') continue;
                            const isLead = m.senderType === 'USER' || m.senderType === 'CONTACT';
                            const role = isLead ? 'user' : 'assistant';
                            const content = (m.content || '').replace(/_+TOKENS:\d+/g, '').trim();
                            if (!content) continue;
                            chatHistory.push({ role, content });
                        }
                    }
                } catch (e) {}
            }
            
            const historyText = chatHistory.map(m => `${m.role === 'user' ? 'Lead' : 'Assessor'}: ${m.content}`).join('\n');
            const systemContext = `[Contexto do Sistema]: O lead leu a última mensagem do Assessor no histórico acima, mas NÃO RESPONDEU. Sua tarefa é gerar uma mensagem de "repescagem" (follow-up) para tentar reengajar o lead, seguindo ESTRITAMENTE o objetivo e as regras acima. NÃO repita a mensagem anterior, e crie algo novo que estimule a resposta.`;
            const finalPrompt = `${followupPrompt}\n\n[Histórico Recente]:\n${historyText || 'Sem histórico'}\n\n${systemContext}`;
            
            let responseText = '';
            let tokenInfo: any = null;
            
            if (provider === 'openai') {
                const openai = new OpenAI({ apiKey: OPENAI_KEY });
                try {
                    const completion = await openai.chat.completions.create({
                        model: modelName,
                        messages: [{ role: 'user', content: finalPrompt }],
                        temperature: 0.7,
                    });
                    responseText = completion.choices[0]?.message?.content?.trim() || '';
                    if (completion.usage) {
                        tokenInfo = { totalTokens: completion.usage.total_tokens };
                    }
                } catch (e) {
                    console.error('[FLOW-ENGINE] Follow-Up OpenAI error:', e);
                    return { message: 'Follow-Up erro na OpenAI' };
                }
            } else {
                try {
                    const { GoogleGenerativeAI } = require('@google/generative-ai');
                    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
                    const geminiModel = genAI.getGenerativeModel({ model: modelName });
                    const result = await geminiModel.generateContent(finalPrompt);
                    responseText = result.response.text().trim();
                    tokenInfo = { totalTokens: result.response.usageMetadata?.totalTokenCount || 0 };
                } catch (e) {
                    console.error('[FLOW-ENGINE] Follow-Up Gemini error:', e);
                    return { message: 'Follow-Up erro no Gemini' };
                }
            }
            
            const parts = step.data.format_for_send 
                ? responseText.split('⌁⌁⌁').map(p => p.trim()).filter(Boolean)
                : [responseText];

            let aiConnectionId = step.data.connection_id || aiConversation?.connectionId || ctx.connectionId;

            // Determinar provider real buscando a conexão resolvida
            let aiProvider = 'apicloud';
            try {
                const resolvedConn = await db.query.connections.findFirst({
                    where: eq(connections.id, aiConnectionId)
                });
                if (['baileys', 'evolution'].includes(resolvedConn?.connectionType || '')) {
                    aiProvider = 'evolution';
                }
            } catch (e) {
                console.warn('[FLOW-ENGINE] Failed to resolve connection type for follow_up_ai, falling back to ctx.provider:', e);
                aiProvider = ctx.provider || 'apicloud';
            }

            for (let i = 0; i < parts.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 2000));
                try {
                    const sendResult = await sendUnifiedMessage({
                        provider: aiProvider as any,
                        connectionId: aiConnectionId,
                        to: ctx.contactPhone,
                        message: parts[i],
                    });
                    if (sendResult.success && aiConversation) {
                        await db.insert(messages).values({
                            companyId: ctx.companyId,
                            conversationId: aiConversation.id,
                            connectionId: aiConnectionId || null,
                            providerMessageId: sendResult.messageId || null,
                            senderType: 'AI',
                            content: parts[i],
                            contentType: 'TEXT',
                            status: 'SENT',
                            sentAt: new Date(),
                            isAiGenerated: true,
                        });
                        await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, aiConversation.id));
                    }
                } catch (e) {}
            }
            
            const timeoutAmountStr = step.data.timeout_amount || step.data.response_timeout_minutes || '8';
            const timeoutAmount = parseInt(String(timeoutAmountStr));
            const timeoutUnit = step.data.timeout_unit || (step.data.response_timeout_minutes ? 'minutes' : 'hours');
            const multipliers: Record<string, number> = {
                seconds: 1000, minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000,
            };
            const ms = timeoutAmount * (multipliers[timeoutUnit] || 60000);
            
            const newVarsToReturn: Record<string, any> = {
                [`follow_up_sent_${step.id}`]: true,
                last_ai_response: responseText,
                ...(tokenInfo ? { ai_tokens: tokenInfo } : {}),
            };
            
            if (ms > 0) {
                newVarsToReturn._ai_timeout_at = Date.now() + ms;
                newVarsToReturn._ai_step_id = step.id;
            }
            
            return {
                action: 'pause',
                newVars: newVarsToReturn,
                message: `Follow-Up enviado, aguardando resposta... (Timeout: ${timeoutAmount} ${timeoutUnit})`,
            };
        }

        // ---- Intent Router (AI classification) ----
        case 'intent_router': {
            const intents = step.data.intents || [];
            if (intents.length === 0) return { sourceHandle: 'fallback', message: 'Intent: no intents configured' };

            const instruction = step.data.instruction || 'Classifique a intenção do usuário.';
            const model = step.data.model || 'gpt-4o-mini';
            const contextWindow = step.data.context_window || 5;

            let chatHistoryText = '';
            
            if (contextWindow > 1 && ctx.conversationId) {
                try {
                    const recentMessages = await db.select()
                        .from(messages)
                        .where(eq(messages.conversationId, ctx.conversationId))
                        .orderBy(desc(messages.sentAt))
                        .limit(contextWindow);
                    
                    const chronological = recentMessages.reverse();
                    for (const m of chronological) {
                        if (m.senderType === 'SYSTEM') continue;
                        const role = m.senderType === 'USER' || m.senderType === 'CONTACT' ? 'Cliente' : 'Atendente';
                        const content = ((m as any).aiTranscription || m.content || '').replace(/_+TOKENS:\d+/g, '').trim();
                        if (content) chatHistoryText += `${role}: ${content}\n`;
                    }
                } catch (e) {
                    console.warn('[FLOW-ENGINE] Failed to fetch chat history for intent_router:', e);
                }
            }
            
            if (!chatHistoryText) {
                const lastMessage = ctx.variables.last_response || ctx.variables.message_text || '';
                const lastAiMsg = ctx.variables.last_ai_response;
                if (lastAiMsg) {
                    chatHistoryText = `Atendente: ${lastAiMsg}\nCliente: ${lastMessage}`;
                } else {
                    chatHistoryText = `Cliente: ${lastMessage}`;
                }
            }

            const classificationPrompt = `
Você é um roteador de intenções.
Sua tarefa é analisar o histórico de conversa e classificar a ÚLTIMA mensagem do cliente em EXATAMENTE UMA destas categorias disponíveis:
[${intents.join(', ')}]

Instrução Customizada do Roteador:
"${instruction}"

Histórico da Conversa:
${chatHistoryText}

REGRAS RÍGIDAS:
1. Responda ÚNICA E EXCLUSIVAMENTE com o nome exato da categoria escolhida.
2. Não adicione pontuação, explicações ou texto extra.
3. Se a intenção do cliente não se encaixar claramente em nenhuma das categorias acima, responda EXATAMENTE a palavra "OUTRO".
`.trim();

            const resolvedKeys = await resolveAIKeys(ctx.companyId);
            const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
            const openai = new OpenAI({ apiKey: OPENAI_KEY });

            let classified = 'OUTRO';
            try {
                const result = await openai.chat.completions.create({
                    model: model,
                    messages: [{ role: 'user', content: classificationPrompt }],
                    temperature: 0,
                });
                classified = (result.choices[0]?.message?.content?.trim() || '').toUpperCase();
            } catch (e) {
                console.error('[FLOW-ENGINE] OpenAI error in intent_router:', e);
            }
            
            // Clean up possible hallucinations (e.g. removing quotes or periods)
            classified = classified.replace(/['"\.]/g, '');

            // 1. Tentar exact match
            let matchedIntent = intents.find((i: string) => classified === i.toUpperCase());
            
            // 2. Se não achar, tentar partial match robusto
            if (!matchedIntent) {
                 matchedIntent = intents.find((i: string) => classified.includes(i.toUpperCase()));
            }

            return {
                sourceHandle: matchedIntent || 'fallback',
                newVars: { classified_intent: matchedIntent || 'outro' },
                message: `Intent: ${matchedIntent || 'fallback'} `,
            };
        }

        // ---- Follow-up AI (V2: time-based + AI prompt) ----
        case 'follow_up_ai': {
            const timeoutMinutes = parseInt(step.data.response_timeout_minutes || '60');

            // Check if lead has responded recently (within the timeout window)
            let hasRespondedRecently = !!ctx.variables.last_response;

            // More accurate: check last message timestamp from DB
            if (ctx.contactId && ctx.companyId) {
                try {
                    const lastIncoming = await db.query.messages.findFirst({
                        where: and(
                            eq(messages.conversationId, ctx.conversationId || ''),
                            eq(messages.direction, 'incoming')
                        ),
                        orderBy: [desc(messages.createdAt)],
                    });

                    if (lastIncoming?.createdAt) {
                        const minutesSinceLastMsg = (Date.now() - new Date(lastIncoming.createdAt).getTime()) / 60000;
                        hasRespondedRecently = minutesSinceLastMsg < timeoutMinutes;
                    }
                } catch (e) {
                    console.error('[FLOW-ENGINE] Follow-up AI timestamp check error:', e);
                }
            }

            // If not responded and followup_prompt is configured, generate AI follow-up
            if (!hasRespondedRecently && step.data.followup_prompt) {
                try {
                    const resolvedKeys = await resolveAIKeys(ctx.companyId);
                    const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';
                    const openai = new OpenAI({ apiKey: OPENAI_KEY });

                    const prompt = await interpolateTemplate(step.data.followup_prompt, ctx);
                    const result = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                    });
                    const followUpMsg = result.choices[0]?.message?.content?.trim() || '';

                    if (followUpMsg) {
                        await sendUnifiedMessage({
                            provider: ctx.provider as any,
                            connectionId: ctx.connectionId,
                            to: ctx.contactPhone || ctx.contactId,
                            message: followUpMsg,
                        });
                    }
                } catch (e) {
                    console.error('[FLOW-ENGINE] Follow-up AI generation error:', e);
                }
            }

            return {
                sourceHandle: hasRespondedRecently ? 'responded' : 'not_responded',
                newVars: { followup_result: hasRespondedRecently ? 'responded' : 'not_responded' },
                message: `Follow-up: ${hasRespondedRecently ? 'responded' : 'not_responded'}`,
            };
        }

        // ---- Send AI Response ----
        case 'send_ai_response': {
            const aiResponse = ctx.variables.last_ai_response || '';
            if (aiResponse) {
                // Split by paragraphs if enabled
                const splits = step.data.split_enabled !== false
                    ? aiResponse.split('\n\n').filter((s: string) => s.trim())
                    : [aiResponse];

                const delaySec = step.data.delay_seconds || 2;
                for (let i = 0; i < splits.length; i++) {
                    if (i > 0) await new Promise(r => setTimeout(r, delaySec * 1000));
                    await sendUnifiedMessage({
                        provider: ctx.provider as any,
                        connectionId: ctx.connectionId,
                        to: ctx.contactPhone || ctx.contactId,
                        message: splits[i].trim(),
                    });
                }
            }
            return { message: `AI response sent(${aiResponse.length} chars)` };
        }

        // ---- HTTP Request (Full V2) ----
            default:
                return { message: 'Unknown AI node type' };
        }
    }
}
