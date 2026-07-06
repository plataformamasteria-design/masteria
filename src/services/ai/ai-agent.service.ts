import type { QualificationSignals, MeetingDetectionResult } from '@/services/crm/lead-progression.service';
import { db } from '@/lib/db';
import {
    contacts,
    conversations,
    messages,
    aiPersonas,
    aiCredentials,
    whatsappDeliveryReports,
    connections,
    kanbanLeads,
    kanbanBoards,
    kanbanStagePersonas,
    automationFlowExecutions
} from '@/lib/db/schema';
import { and, eq, desc, sql, inArray, isNull } from 'drizzle-orm';
import type { Contact, Message } from '@/lib/types';
import { logger } from '@/lib/logger';
import { logContactEvent } from '@/lib/contact-events';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';
import {
    detectLanguage,
    getPersonaPromptSections,
    assembleDynamicPrompt,
    estimateTokenCount
} from '@/lib/prompt-utils';
import { analyzeProfile, getPsychographicPromptInstructions } from '@/lib/neurolinguistics/profile-analyzer';
import { scheduleMeetingToolDefinition, scheduleMeeting } from '@/lib/ai-tools/schedule-meeting';
import { cancelMeetingToolDefinition, rescheduleMeetingToolDefinition, cancelMeeting, rescheduleMeeting } from '@/lib/ai-tools/manage-meeting';
import { checkAvailabilityToolDefinition, checkAvailability } from '@/lib/ai-tools/check-availability';
import { webhookDispatcher } from '@/services/webhook-dispatcher.service';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';
import { cancelFollowUps, scheduleFollowUp } from '@/lib/ai-followup-scheduler';
import { apiCache } from '@/lib/api-cache';
import { QuotaService } from '@/lib/quotas';
import { buildEnrichedContactContext } from '@/lib/contact-context';
import { detectAndProgressLead } from '@/services/crm/lead-progression.service';
import { logAutomation } from '@/lib/automation-engine';

type LogContext = any;
import { AutomationTriggerContext } from '@/lib/automation-engine';


export async function fetchImageAsInlineData(url: string) {
    try {
        if (!url) return null;
        const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) return null;
        
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        
        return {
            inlineData: {
                data: base64,
                mimeType: contentType
            }
        };
    } catch (e) {
        logger.warn('[AutomationEngine] Failed to fetch image for Gemini:', (e as Error).message);
        return null;
    }
}

export async function selectIntelligentPersona(
    context: AutomationTriggerContext,
    defaultPersonaId: string | null
): Promise<string | null> {
    const { contact, conversation, companyId } = context;
    const logContextBase: LogContext = { companyId, conversationId: conversation.id };

    try {
        const activeLeadResults = await db.select().from(kanbanLeads).where(and(
            eq(kanbanLeads.contactId, contact.id),
            eq(kanbanLeads.companyId, companyId)
        )).limit(1);
        const activeLeadResult = activeLeadResults[0];

        const contactType = conversation.contactType || 'PASSIVE';

        if (activeLeadResult) {
            // TODO: implement board relationship loading
            const boardData = { name: 'Funil', funnelType: 'GENERAL' } as { name: string; funnelType?: string };
            await logAutomation('INFO', `Lead encontrado no funil "${boardData.name}" (Tipo: ${boardData.funnelType || 'GENERAL'}, EstÃ¡gio: ${activeLeadResult.stageId})`, logContextBase);

            // Validar que as configuraÃ§Ãµes pertencem Ã  empresa atravÃ©s do board
            const stagePersonaConfigs = await db.select({
                id: kanbanStagePersonas.id,
                boardId: kanbanStagePersonas.boardId,
                stageId: kanbanStagePersonas.stageId,
                activePersonaId: kanbanStagePersonas.activePersonaId,
                passivePersonaId: kanbanStagePersonas.passivePersonaId,
                activeDisabled: kanbanStagePersonas.activeDisabled,
                passiveDisabled: kanbanStagePersonas.passiveDisabled,
            })
                .from(kanbanStagePersonas)
                .innerJoin(kanbanBoards, eq(kanbanStagePersonas.boardId, kanbanBoards.id))
                .where(and(
                    eq(kanbanStagePersonas.boardId, activeLeadResult.boardId),
                    eq(kanbanStagePersonas.stageId, activeLeadResult.stageId),
                    eq(kanbanBoards.companyId, companyId)
                ))
                .limit(1);
            const stagePersonaConfig = stagePersonaConfigs[0];

            if (stagePersonaConfig) {
                // Check disabled flag first
                const isDisabled = contactType === 'ACTIVE'
                    ? stagePersonaConfig.activeDisabled
                    : stagePersonaConfig.passiveDisabled;

                if (isDisabled) {
                    await logAutomation('INFO', `ðŸš« [Prioridade 1] Bot INATIVO (desativado) para estÃ¡gio "${activeLeadResult.stageId}", Tipo="${contactType}"`, logContextBase);
                    return null;
                }

                const selectedPersonaId = contactType === 'ACTIVE'
                    ? stagePersonaConfig.activePersonaId
                    : stagePersonaConfig.passivePersonaId;

                if (selectedPersonaId) {
                    await logAutomation('INFO', `âœ… [Prioridade 1] Agente IA selecionado (nÃ­vel estÃ¡gio): Funil="${boardData.name}", EstÃ¡gio="${activeLeadResult.stageId}", Tipo="${contactType}"`, logContextBase);
                    return selectedPersonaId;
                } else {
                    await logAutomation('INFO', `âš ï¸ [Prioridade 1] Stage config encontrado mas sem persona configurada (Tipo: ${contactType}). Fazendo fallback...`, logContextBase);
                }
            }

            const boardPersonaConfigs = await db.select({
                id: kanbanStagePersonas.id,
                boardId: kanbanStagePersonas.boardId,
                stageId: kanbanStagePersonas.stageId,
                activePersonaId: kanbanStagePersonas.activePersonaId,
                passivePersonaId: kanbanStagePersonas.passivePersonaId,
                activeDisabled: kanbanStagePersonas.activeDisabled,
                passiveDisabled: kanbanStagePersonas.passiveDisabled,
            })
                .from(kanbanStagePersonas)
                .innerJoin(kanbanBoards, eq(kanbanStagePersonas.boardId, kanbanBoards.id))
                .where(and(
                    eq(kanbanStagePersonas.boardId, activeLeadResult.boardId),
                    isNull(kanbanStagePersonas.stageId),
                    eq(kanbanBoards.companyId, companyId)
                ))
                .limit(1);
            const boardPersonaConfig = boardPersonaConfigs[0];

            if (boardPersonaConfig) {
                // Check disabled flag first
                const isDisabled = contactType === 'ACTIVE'
                    ? boardPersonaConfig.activeDisabled
                    : boardPersonaConfig.passiveDisabled;

                if (isDisabled) {
                    await logAutomation('INFO', `ðŸš« [Prioridade 2] Bot INATIVO (desativado) para funil "${boardData.name}", Tipo="${contactType}"`, logContextBase);
                    return null;
                }

                const selectedPersonaId = contactType === 'ACTIVE'
                    ? boardPersonaConfig.activePersonaId
                    : boardPersonaConfig.passivePersonaId;

                if (selectedPersonaId) {
                    await logAutomation('INFO', `âœ… [Prioridade 2] Agente IA selecionado (nÃ­vel funil): Funil="${boardData.name}", Tipo="${contactType}"`, logContextBase);
                    return selectedPersonaId;
                } else {
                    await logAutomation('INFO', `âš ï¸ [Prioridade 2] Board config encontrado mas sem persona configurada (Tipo: ${contactType}). Fazendo fallback...`, logContextBase);
                }
            } else {
                await logAutomation('INFO', `âš ï¸ [Prioridade 2] Nenhuma config de board encontrada. Fazendo fallback para roteamento de conexÃ£o...`, logContextBase);
            }
        } else {
            await logAutomation('INFO', `Contato sem lead ativo no Kanban. Seguindo hierarquia de fallback...`, logContextBase);
        }

        if (defaultPersonaId) {
            await logAutomation('INFO', `âœ… [Prioridade 3] Usando agente padrÃ£o da conexÃ£o WhatsApp (assignedPersonaId: ${defaultPersonaId})`, logContextBase);
            return defaultPersonaId;
        } else {
            await logAutomation('INFO', `âš ï¸ [Prioridade 3] Nenhum agente padrÃ£o configurado na conexÃ£o (assignedPersonaId: null)`, logContextBase);
        }

        if (conversation.assignedPersonaId) {
            await logAutomation('INFO', `âœ… [Prioridade 4] Usando agente configurado manualmente na conversa (Ãºltimo fallback): ${conversation.assignedPersonaId}`, logContextBase);
            return conversation.assignedPersonaId;
        }

        await logAutomation('INFO', `âš ï¸ [Prioridade 5] Nenhum agente configurado. Sistema nÃ£o responderÃ¡ automaticamente.`, logContextBase);
        return null;

    } catch (error) {
        await logAutomation('ERROR', `Erro ao selecionar agente IA inteligente: ${(error as Error).message}`, logContextBase);

        if (defaultPersonaId) return defaultPersonaId;
        if (conversation.assignedPersonaId) return conversation.assignedPersonaId;
        return null;
    }
}

export async function callExternalAIAgent(
    context: AutomationTriggerContext,
    personaId: string,
    options?: { dryRunSend?: boolean }
) {
    const { companyId, conversation, contact, message } = context;
    const logContextBase: LogContext = { companyId, conversationId: conversation.id };

    // ðŸ§  ANÃLISE NEUROLINGUÃSTICA (VAK + CHASE HUGHES) - Executar SEMPRE, independente se a IA vai responder
    const userMessageContent = message.content || '';
    const psychographicProfile = analyzeProfile(userMessageContent);

    await logAutomation('INFO', `ðŸ§  AnÃ¡lise NeurolinguÃ­stica: VAK=${psychographicProfile.vakProfile}, Need=${psychographicProfile.socialNeed}, Pace=${psychographicProfile.communicationPace}`, logContextBase);

    // âœ… SALVAR PERFIL NO BANCO DE DADOS
    if (psychographicProfile.vakProfile !== 'UNKNOWN' || psychographicProfile.socialNeed) {
        try {
            await db.update(contacts)
                .set({
                    vakProfile: psychographicProfile.vakProfile,
                    dominantSocialNeed: psychographicProfile.socialNeed || null,
                    communicationPace: psychographicProfile.communicationPace,
                    lastPsychographicUpdate: new Date(),
                })
                .where(and(
                    eq(contacts.id, contact.id),
                    eq(contacts.companyId, companyId)
                ));
            await logAutomation('INFO', `ðŸ§  Perfil atualizado no DB: ${psychographicProfile.vakProfile}`, logContextBase);
        } catch (dbError) {
            logger.error('[Automation Engine] Erro ao salvar perfil neurolinguÃ­stico:', dbError);
        }
    }

    // DEBUG: Verificar se a nova versÃ£o do cÃ³digo estÃ¡ rodando
    await logAutomation('INFO', `[DEBUG VERSION] callExternalAIAgent v2.1 (Fallback Debug Enabled)`, logContextBase);

    await logAutomation('INFO', `Conversa roteada para o Agente de IA (Persona ID: ${personaId}).`, logContextBase);

    // âœ… CORREÃ‡ÃƒO CRÃTICA: Buscar persona ANTES do try para garantir que currentProvider estÃ¡ sempre disponÃ­vel
    let currentProvider: string | null = null;
    let persona: any = null;

    // Buscar persona FORA do try para garantir que currentProvider estÃ¡ disponÃ­vel no catch
    try {
        const personas = await db.select().from(aiPersonas).where(and(
            eq(aiPersonas.companyId, companyId),
            eq(aiPersonas.id, personaId)
        )).limit(1);
        persona = personas[0];

        if (!persona) {
            await logAutomation('ERROR', `Persona ${personaId} nÃ£o encontrada no banco de dados.`, logContextBase);
            return false;
        }

        // ðŸ”’ VERIFICAÃ‡ÃƒO DE SEGURANÃ‡A (ANTES DE TUDO)
        try {
            // âœ… Fix: Use static import to avoid runtime resolution issues
            const securityResult = await performInputSecurityCheck(message.content || '', {
                companyId,
                conversationId: conversation.id, connectionId: conversation.connectionId,
                contactId: contact.id,
                contactPhone: contact.phone,
            });

            if (!securityResult.shouldProceed) {
                await logAutomation('WARN', `ðŸš¨ SEGURANÃ‡A: Mensagem bloqueada por ameaÃ§a detectada (${securityResult.inputCheck.threats.map(t => t.type).join(', ')})`, logContextBase);

                // Enviar resposta padrÃ£o de bloqueio
                const connectionData = await db.select().from(connections).where(eq(connections.id, conversation.connectionId!)).limit(1);
                if (connectionData[0]) {
                    await sendUnifiedMessage({
                        provider: ['baileys', 'evolution'].includes(connectionData[0].connectionType || '') ? 'evolution' : 'apicloud',
                        connectionId: conversation.connectionId!,
                        to: contact.phone,
                        message: securityResult.blockedResponse || 'Desculpe, nÃ£o posso processar esse tipo de solicitaÃ§Ã£o.',
                    });
                }
                return false;
            }

            if (securityResult.inputCheck.threatLevel === 'SUSPICIOUS') {
                await logAutomation('INFO', `âš ï¸ SEGURANÃ‡A: Mensagem suspeita detectada, mas permitida: ${securityResult.inputCheck.threats.map(t => t.type).join(', ')}`, logContextBase);
            }
        } catch (securityError) {
            // NÃ£o falhar se o mÃ³dulo de seguranÃ§a falhar
            logger.error('[Automation Engine] Erro no mÃ³dulo de seguranÃ§a:', securityError);
        }

        // âœ… VERIFICAÃ‡ÃƒO DE GATILHOS (TRIGGER KEYWORDS)
        // Se o agente tiver palavras-chave configuradas E a opÃ§Ã£o estiver ativa
        if (persona.isTriggerActive && persona.triggerKeywords && Array.isArray(persona.triggerKeywords) && persona.triggerKeywords.length > 0) {

            // Verificar se jÃ¡ houve interaÃ§Ã£o da IA nas Ãºltimas 24h
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentAIMessagesCheck = await db.select({ id: messages.id }).from(messages).where(and(
                eq(messages.companyId, companyId),
                eq(messages.conversationId, conversation.id),
                eq(messages.senderType, 'AI'),
                gte(messages.sentAt, twentyFourHoursAgo)
            )).limit(1);

            const hasRespondedIn24h = recentAIMessagesCheck.length > 0;

            // SÃ³ aplicar o filtro se for a PRIMEIRA resposta nas Ãºltimas 24h
            if (!hasRespondedIn24h) {
                const messageContent = (message.content || '').toLowerCase();
                const hasMatch = persona.triggerKeywords.some((keyword: string) =>
                    messageContent.includes(keyword.toLowerCase().trim())
                );

                if (!hasMatch) {
                    await logAutomation('INFO', `⛔ Agente IA bloqueado: Nova conversa sem palavra-chave. Keywords configuradas: [${persona.triggerKeywords.join(', ')}]. Conteúdo: "${messageContent.substring(0, 50)}..."`, logContextBase);
                    return false; // BLOQUEIA resposta da IA
                } else {
                    await logAutomation('INFO', `✅ Gatilho de palavra-chave detectado. Prosseguindo com resposta...`, logContextBase);
                }
            } else {
                await logAutomation('INFO', `ℹ️ Conversa em andamento (já respondeu nas últimas 24h). Ignorando verificação de palavras-chave.`, logContextBase);
            }
        }

        // ✅ FIX: Respeitar o provider configurado na persona (não forçar OpenAI)
        const originalProvider = (persona.provider || '').toUpperCase();
        currentProvider = originalProvider || 'OPENAI';

        await logAutomation('INFO', `Provider configurado: ${currentProvider} (Persona: ${persona.name}, Model: ${persona.model})`, logContextBase);
    } catch (error: any) {
        // Se falhar ao buscar persona, retornar false
        await logAutomation('ERROR', `Falha ao buscar persona ${personaId}: ${error.message}`, logContextBase);
        return false;
    }

    // âœ… Agora que temos persona e currentProvider garantidos, continuar com o resto da lÃ³gica
    // VariÃ¡veis que precisam estar disponÃ­veis no catch para fallback
    let systemPrompt = '';
    let recentMessages: Array<Pick<Message, 'id' | 'content' | 'senderType' | 'sentAt'>> = [];

    try {
        let effectiveProvider = currentProvider;
        const effectiveModel = persona.model;

        // Verificar se temos chaves do Google configuradas APENAS SE for GOOGLE
        if (effectiveProvider === 'GOOGLE') {
            const resolvedKeys = await resolveAIKeys(companyId);
            const googleKey = resolvedKeys.geminiApiKey || process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY_SECONDARY || process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2;
            if (!googleKey) {
                await logAutomation('ERROR', 'Chave Google nÃ£o encontrada (verificado: Global, _SECONDARY, GOOGLE_GEMINI_AGENTS1, _2). Abortando automaÃ§Ã£o.', logContextBase);
                throw new Error('Chave Google nÃ£o configurada.');
            }
        }

        await logAutomation('INFO', `Usando persona: ${persona.name} (Provider: ${effectiveProvider}, Model: ${effectiveModel})`, logContextBase);

        // [QUOTA CHECK] Verify AI token allowance
        // const { QuotaService } = await import('./quotas'); // Removido dynamic import
        const quotaCheck = await QuotaService.checkQuota(companyId, 'ai_tokens');
        if (!quotaCheck.success) {
            await logAutomation('ERROR', `âŒ QUOTA ESGOTADA: ${quotaCheck.message}`, logContextBase);
            throw new Error(quotaCheck.message);
        }

        // ðŸ•’ DELAYS HUMANIZADOS: Detectar se Ã© primeira resposta ou demais respostas (24h window)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Validar que as mensagens pertencem Ã  empresa
        const recentAIMessages = await db.select().from(messages).where(and(
            eq(messages.companyId, companyId),
            eq(messages.conversationId, conversation.id),
            eq(messages.senderType, 'AI'),
            gte(messages.sentAt, twentyFourHoursAgo)
        )).limit(1);

        const isFirstResponse = recentAIMessages.length === 0;

        // ðŸ“Š CONTADOR DE MENSAGENS DIÃRIAS (Para regra da 3Âª mensagem em Ã¡udio)
        const dailyMessageCountResult = await db.select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(and(
                eq(messages.companyId, companyId),
                eq(messages.conversationId, conversation.id),
                eq(messages.senderType, 'AI'),
                gte(messages.sentAt, twentyFourHoursAgo)
            ));
        const dailyMessageCount = Number(dailyMessageCountResult[0]?.count || 0);

        // Regra: 3Âª mensagem do dia (index 2 se 0-based, ou count=2 significando que jÃ¡ existem 2)
        // Se count = 0 -> 1Âª msg
        // Se count = 1 -> 2Âª msg
        // Se count = 2 -> 3Âª msg (TRIGGER)
        const isThirdMessage = dailyMessageCount === 2;
        await logAutomation('INFO', `ðŸ“Š Contagem diÃ¡ria de mensagens IA: ${dailyMessageCount} (Esta serÃ¡ a 3Âª? ${isThirdMessage})`, logContextBase);

        // Calcular delay humanizado baseado na configuraÃ§Ã£o do agente (com defaults seguros)
        let minDelay = (isFirstResponse ? persona.firstResponseMinDelay : persona.followupResponseMinDelay) || 5;
        let maxDelay = (isFirstResponse ? persona.firstResponseMaxDelay : persona.followupResponseMaxDelay) || 15;

        // ðŸŽ§ DELAY DE ÃUDIO: Adicionar tempo extra se a mensagem do usuÃ¡rio for Ã¡udio (simular escuta)
        // Como nÃ£o temos a duraÃ§Ã£o exata no DB, estimamos pelo tamanho da transcriÃ§Ã£o (15 chars ~ 1 seg)
        // Ex: 150 chars = +10s de delay
        if (message.contentType === 'AUDIO' || message.contentType === 'VOICE' || (message.content && message.content.startsWith('[Ãudio'))) {
            const transcriptionLength = message.content ? message.content.length : 0;
            const audioListenTime = Math.ceil(transcriptionLength / 15);

            // Adicionar tempo de escuta ao delay mÃ­nimo
            minDelay += audioListenTime;
            maxDelay += audioListenTime;

            await logAutomation('INFO', `ðŸŽ§ Delay ajustado para Ã¡udio: +${audioListenTime}s (Baseado em ${transcriptionLength} chars transcritos)`, logContextBase);
        }

        // AJUSTE DINÃ‚MICO DE DELAY (PACING)
        // Se o cliente Ã© RÃPIDO (Visual) ou LENTO (CinestÃ©sico), ajustamos o delay para espelhar
        if (psychographicProfile.communicationPace === 'FAST') {
            minDelay = Math.max(2, Math.floor(minDelay * 0.7)); // 30% mais rÃ¡pido
            maxDelay = Math.max(5, Math.floor(maxDelay * 0.7));
            await logAutomation('INFO', `âš¡ Pacing: Cliente RÃPIDO (Visual/Curto). Acelerando resposta (-30%).`, logContextBase);
        } else if (psychographicProfile.communicationPace === 'SLOW') {
            minDelay = Math.floor(minDelay * 1.3); // 30% mais lento
            maxDelay = Math.floor(maxDelay * 1.3);
            await logAutomation('INFO', `ðŸ¢ Pacing: Cliente LENTO (CinestÃ©sico/Longo). Desacelerando resposta (+30%).`, logContextBase);
        }

        // Guard: garantir que min <= max (corrigir ranges malformados)
        if (minDelay > maxDelay) {
            await logAutomation('WARN', `âš ï¸  Invalid delay range detected (min: ${minDelay}, max: ${maxDelay}). Swapping values.`, logContextBase);
            [minDelay, maxDelay] = [maxDelay, minDelay];
        }

        // Cap de seguranÃ§a para evitar delays excessivos (mÃ¡ximo 60s)
        if (maxDelay > 60) maxDelay = 60;
        if (minDelay > 55) minDelay = 55;

        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

        const responseType = isFirstResponse ? 'primeira resposta (24h)' : 'demais respostas';
        await logAutomation('INFO', `ðŸ•’ Delay humanizado: ${randomDelay}s (${responseType}, range: ${minDelay}-${maxDelay}s)`, logContextBase);

        // Aplicar delay antes de gerar resposta
        await sleep(randomDelay * 1000);

        // âœ… FIX: Buscar mensagens mais recentes primeiro (DESC) e reverter para ordem cronolÃ³gica
        // Isso garante que pegamos as mensagens MAIS NOVAS, nÃ£o as antigas
        // Validar que as mensagens pertencem Ã  empresa
        // âœ… OTIMIZAÃ‡ÃƒO: Selecionar apenas campos necessÃ¡rios para economizar memÃ³ria
        const allMessages = await db.select({
            id: messages.id,
            content: messages.content,
            senderType: messages.senderType,
            sentAt: messages.sentAt,
            mediaUrl: messages.mediaUrl,
            contentType: messages.contentType,
            aiTranscription: messages.aiTranscription
        })
            .from(messages)
            .where(and(
                eq(messages.companyId, companyId),
                eq(messages.conversationId, conversation.id)
            ))
            .orderBy(desc(messages.sentAt))
            .limit(15); // Reduzido de 20 para 15 (usamos apenas 10 no LLM)

        // Reverter para ordem cronolÃ³gica (mais antiga â†’ mais recente)
        const chronologicalMessages = allMessages.reverse();

        // Garantir que a mensagem atual (trigger) estÃ¡ incluÃ­da no histÃ³rico
        // Se nÃ£o estiver, adicionar explicitamente
        const triggerMessageExists = chronologicalMessages.some(msg => msg.id === message.id);
        if (!triggerMessageExists) {
            chronologicalMessages.push(message);
            await logAutomation('INFO', `Mensagem atual (trigger) adicionada explicitamente ao contexto`, logContextBase);
        }

        // Pegar apenas as Ãºltimas 10 mensagens para enviar ao LLM (evitar excesso de tokens)
        recentMessages = chronologicalMessages.slice(-10);

        // ==========================================
        // 🚨 LAZY TRANSCRIPTION (JUST-IN-TIME)
        // ==========================================
        
        let lazyTranscriptionApiKey: string | undefined = undefined;
        if (persona.credentialId) {
            try {
                const [cred] = await db.select().from(aiCredentials).where(eq(aiCredentials.id, persona.credentialId)).limit(1);
                if (cred && cred.apiKey && !cred.apiKey.startsWith('AIzaSy')) {
                    lazyTranscriptionApiKey = cred.apiKey;
                }
            } catch(e) {}
        }

        for (const m of recentMessages) {
            if (m.contentType === 'AUDIO' && m.mediaUrl && !(m as any).aiTranscription) {
                try {
                    await logAutomation('INFO', `[Lazy Transcription] Transcrevendo áudio ${m.id} sob demanda...`, logContextBase);
                    const mediaResponse = await fetch(m.mediaUrl);
                    if (mediaResponse.ok) {
                        const arrayBuffer = await mediaResponse.arrayBuffer();
                        const mediaBuffer = Buffer.from(arrayBuffer);
                        const { transcribeAudioOpenAI } = await import('@/services/openai-transcription.service');
                        const transcription = await transcribeAudioOpenAI(mediaBuffer, 'audio/ogg', companyId, lazyTranscriptionApiKey);
                        
                        if (transcription && transcription.trim().length > 0 && !transcription.includes('[Sem fala detectada]')) {
                            const newTranscriptionText = `[Ãudio Transcrito]: ${transcription}`;
                            await db.update(messages).set({ aiTranscription: newTranscriptionText }).where(eq(messages.id, m.id));
                            (m as any).aiTranscription = newTranscriptionText;
                            await logAutomation('INFO', `[Lazy Transcription] âœ… Ãudio transcrito com sucesso!`, logContextBase);
                        } else {
                            // Marca para nÃ£o tentar transcrever de novo
                            await db.update(messages).set({ aiTranscription: '[Ãudio sem fala detectada]' }).where(eq(messages.id, m.id));
                            (m as any).aiTranscription = '[Ãudio sem fala detectada]';
                        }
                    }
                } catch (err: any) {
                    await logAutomation('ERROR', `[Lazy Transcription] Erro: ${err.message}`, logContextBase);
                }
            }
        }

        await logAutomation('INFO', `Incluindo ${recentMessages.length} mensagens do histÃ³rico (incluindo mensagem atual)`, logContextBase);

        // SISTEMA DE PROMPTS DINÃ‚MICOS (RAG)
        // 1. Detectar idioma da mensagem atual
        const detectedLanguage = detectLanguage(message.content);
        await logAutomation('INFO', `Idioma detectado: ${detectedLanguage}`, logContextBase);

        // 2. Buscar seÃ§Ãµes relevantes do prompt
        // systemPrompt jÃ¡ declarado no escopo externo

        // Verificar se o agente estÃ¡ configurado para usar RAG
        if (persona.useRag) {
            const promptSections = await getPersonaPromptSections(companyId, personaId, detectedLanguage);

            if (promptSections.length > 0) {
                // Se existem seÃ§Ãµes e RAG estÃ¡ ativo, usar prompts modulares
                const contextInfo = await buildEnrichedContactContext(companyId, contact.id, contact.name || 'Cliente', contact.phone);
                systemPrompt = INTERNAL_RULES + '\n\n' + assembleDynamicPrompt(promptSections, contextInfo, userMessageContent);
                await logAutomation('INFO', `Sistema RAG ativo: ${promptSections.length} seÃ§Ãµes carregadas (${estimateTokenCount(systemPrompt)} tokens estimados)`, logContextBase);
            } else {
                // RAG ativo mas sem seÃ§Ãµes - avisar e usar fallback
                systemPrompt = persona.systemPrompt || `VocÃª Ã© ${persona.name}, um atendente especializado da empresa no WhatsApp.`;
                systemPrompt = INTERNAL_RULES + '\n\n' + systemPrompt;
                const contextInfoFallback = await buildEnrichedContactContext(companyId, contact.id, contact.name || 'Cliente', contact.phone);
                systemPrompt += contextInfoFallback;
                systemPrompt += getPsychographicPromptInstructions(psychographicProfile);
                await logAutomation('WARN', `RAG ativo mas sem seÃ§Ãµes encontradas. Usando systemPrompt tradicional + Profile (${estimateTokenCount(systemPrompt)} tokens estimados)`, logContextBase);
            }
        } else {
            // RAG desativado: usar systemPrompt tradicional da tabela ai_personas
            systemPrompt = persona.systemPrompt || `VocÃª Ã© ${persona.name}, um atendente especializado da empresa no WhatsApp.`;
            systemPrompt = INTERNAL_RULES + '\n\n' + systemPrompt;
            const contextInfoNoRag = await buildEnrichedContactContext(companyId, contact.id, contact.name || 'Cliente', contact.phone);
            systemPrompt += contextInfoNoRag;
            systemPrompt += getPsychographicPromptInstructions(psychographicProfile);
            await logAutomation('INFO', `RAG desativado: usando systemPrompt tradicional + Profile (${estimateTokenCount(systemPrompt)} tokens estimados)`, logContextBase);
        }

        // ðŸ§  INJEÃ‡ÃƒO DE GATILHOS E RECURSOS (LINKS/PIX/CHECKOUT)
        if (persona.resources && Array.isArray(persona.resources) && persona.resources.length > 0) {
            const activeResources = persona.resources.filter((r: any) => r.isActive);
            if (activeResources.length > 0) {
                let resourcesPrompt = `\n\n[AVAILABLE RESOURCES]\nUse these resources EXACTLY as provided when requested or relevant:\n`;
                activeResources.forEach((r: any) => {
                    resourcesPrompt += `- ${r.type}: [${r.name}] (${r.content}) - ${r.description || ''}\n`;
                });
                resourcesPrompt += `\nINSTRUCTION: When providing Links, Pix Keys, or Codes, SEND ONLY TEXT. DO NOT generate audio for these items.`;
                resourcesPrompt += `\nINSTRUCTION: If you decide to send a resource, embed it naturally in your response DO NOT invent links. Use ONLY the ones provided above.`;
                systemPrompt += resourcesPrompt;
                await logAutomation('INFO', `ðŸ”— ${activeResources.length} recursos injetados no prompt.`, logContextBase);
            }
        }

        // ðŸ§  INJEÃ‡ÃƒO DE VARIÃVEIS DE OFERTA (PRODUTO/PREÃ‡O)
        if (persona.variables && typeof persona.variables === 'object' && Object.keys(persona.variables).length > 0) {
            let variablesPrompt = `\n\n[INFORMAÃ‡Ã•ES DA OFERTA (PRODUTO)]:\n`;
            for (const [key, value] of Object.entries(persona.variables)) {
                variablesPrompt += `- ${key.toUpperCase()}: ${value}\n`;
            }
            systemPrompt += variablesPrompt;
            await logAutomation('INFO', `ðŸ’° ${Object.keys(persona.variables).length} variÃ¡veis de oferta injetadas no prompt.`, logContextBase);
        }

        // ðŸ§  INJEÃ‡ÃƒO DE PRESETS DE COMPORTAMENTO (HUMANIZAÃ‡ÃƒO)
        const bp = persona.behaviorPresets || {};
        const personaAudioMode = (persona as any).audioMode || 'text';
        const willSendAudio = personaAudioMode === 'audio' || personaAudioMode === 'both';

        if (Object.keys(bp).length > 0) {
            let behaviorPrompt = `\n\n[REGRAS DE ESTILO ADICIONAIS]:\n`;

            // ðŸ“¢ REGRA CRÃTICA: AbreviaÃ§Ãµes sÃ³ aplicam a texto, NUNCA a Ã¡udio
            // TTS lÃª "vc" literalmente ao invÃ©s de "vocÃª" = ruim
            if (bp.useAbbreviations && !willSendAudio) {
                behaviorPrompt += `- Use abreviaÃ§Ãµes humanas naturais (vc, tbm, tÃ¡, blz).\n`;
            } else if (willSendAudio) {
                // InstruÃ§Ã£o explÃ­cita para Ã¡udio: palavras completas para pronÃºncia natural
                behaviorPrompt += `- âš ï¸ ÃUDIO ATIVO: NÃƒO use abreviaÃ§Ãµes (vc, tbm, tÃ¡). Escreva palavras completas (vocÃª, tambÃ©m, estÃ¡) para pronÃºncia natural.\n`;
            }

            if (bp.maxEmojisPerMessage) behaviorPrompt += `- Limite de emojis: mÃ¡ximo ${bp.maxEmojisPerMessage} por mensagem.\n`;
            if (bp.boldSingleCTA) behaviorPrompt += `- Negrite apenas o CTA principal ou o valor (ex: *LINK*, *PIX*, *R$ 49,90*).\n`;
            if (bp.variedGreetings && bp.variedGreetings.length > 0) {
                behaviorPrompt += `- Varie suas saudaÃ§Ãµes/aberturas usando termos como: ${bp.variedGreetings.join(', ')}.\n`;
            }
            systemPrompt += behaviorPrompt;
        }

        // ðŸ§  AJUSTE DE VOZ ESPECÃFICO (ElevenLabs Turbo/Flash v2.5)
        // Modelos v2.5 (Turbo/Flash) geralmente nÃ£o suportam SSML <break> tÃ£o bem quanto o v1/v2 ou tÃªm comportamento imprevisÃ­vel.
        // Vamos aplicar a regra anti-SSML para eles tambÃ©m.
        const voiceModel = (persona.voiceSettings as any)?.modelId;
        if (voiceModel === 'eleven_turbo_v2_5' || voiceModel === 'eleven_flash_v2_5') {
            systemPrompt += "\n\n[VOICE CONTROL RULES]:\n- You are using a low-latency ElevenLabs model (v2.5).\n- CRITICAL: Do NOT use SSML tags like <break/>.\n- To create pauses, use natural punctuation: ellipses (...) for thoughtful pauses and dashes (â€”) or line breaks for separation.\n- Output pure text only.";
        } else if (voiceModel === 'eleven_v3') {
            systemPrompt += "\n\n[VOICE CONTROL RULES - V3 ALPHA]:\n- You are using the highly expressive ElevenLabs v3 Alpha model.\n- ACTING INSTRUCTIONS: Be dynamic, use emotional range, and leverage context.\n- You CAN use ellipses (...) for dramatic pauses.\n- Focus on natural, human-like delivery.";
        }

        // ðŸ§  INJEÃ‡ÃƒO DE REGRAS DE CONTEXTO (SAUDAÃ‡ÃƒO E FORMATO)
        if (dailyMessageCount > 0) {
            systemPrompt += "\n\nðŸš¨ REGRA ABSOLUTA DE CONTEXTO: VocÃª JÃ estÃ¡ em conversa ativa com este lead. PROIBIDO repetir mensagens iniciais de boas-vindas, saudaÃ§Ãµes, apresentaÃ§Ã£o ou qualquer script de primeira mensagem. IGNORE qualquer instruÃ§Ã£o anterior que diga para enviar mensagens de 'primeira interaÃ§Ã£o'. Continue EXATAMENTE de onde a conversa parou. VÃ¡ direto ao assunto.";
        }
        if (isThirdMessage) {
            systemPrompt += "\n\nðŸŽ¤ MODO ÃUDIO ATIVO: Sua resposta serÃ¡ convertida em Ã¡udio. Fale de forma coloquial, use marcadores de fala natural (tipo 'entÃ£o', 'olha sÃ³') e evite listas ou formataÃ§Ã£o complexa.";
            systemPrompt += "\nâ›” REGRA CRÃTICA ÃUDIO: NUNCA inclua cÃ³digos PIX, chaves PIX, links ou URLs na resposta. Diga apenas 'vou te enviar o pix/link aqui' e eu enviarei separadamente como texto.";
        } else {
            systemPrompt += "\n\nðŸ“ FORMATO: MÃ¡ximo 190 caracteres. MÃ¡ximo 3 parÃ¡grafos curtos.";
        }

        let aiResponse = '';
        let estimatedTokens = 0;

        // TENTATIVA 1: OPENAI (NOVO PADRÃƒO DA ESPECIFICAÃ‡ÃƒO)
        if (effectiveProvider === 'OPENAI') {
            const modelName = (persona as any)?.model || 'gpt-4o-mini';
            await logAutomation('INFO', `Processando com OpenAI (Model: ${modelName})...`, logContextBase);

            try {
                const { OpenAI } = await import('openai');
                
                let credentialApiKey: string | null = null;
                if (persona.credentialId) {
                    const [credential] = await db.select().from(aiCredentials).where(eq(aiCredentials.id, persona.credentialId)).limit(1);
                    if (credential?.apiKey) credentialApiKey = credential.apiKey;
                }
                
                const resolvedKeys = await resolveAIKeys(companyId);
                const openaiKey = credentialApiKey || resolvedKeys.openaiApiKey;
                if (!openaiKey) throw new Error("OPENAI_API_KEY is not configured or missing in credentials.");

                const openai = new OpenAI({ apiKey: openaiKey });

                // Prepara tools formatados pra OpenAI
                const tools: any[] = [];
                if (persona.enableScheduling) {
                    const mapToOpenAiTool = (def: any) => ({
                        type: 'function',
                        function: {
                            name: def.name,
                            description: def.description,
                            parameters: def.parameters
                        }
                    });
                    
                    tools.push(mapToOpenAiTool(scheduleMeetingToolDefinition));
                    tools.push(mapToOpenAiTool(cancelMeetingToolDefinition));
                    tools.push(mapToOpenAiTool(rescheduleMeetingToolDefinition));
                    tools.push(mapToOpenAiTool(checkAvailabilityToolDefinition));

                    const nowBRT_scheduling = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
                    const dataFormatada = `${String(nowBRT_scheduling.getUTCDate()).padStart(2, '0')}/${String(nowBRT_scheduling.getUTCMonth() + 1).padStart(2, '0')}/${nowBRT_scheduling.getUTCFullYear()}`;
                    const horaFormatada = `${String(nowBRT_scheduling.getUTCHours()).padStart(2, '0')}:${String(nowBRT_scheduling.getUTCMinutes()).padStart(2, '0')}`;
                    
                    systemPrompt += `\n\n[DATA E HORA ATUAL]:\n- Hoje Ã© ${dataFormatada}, Hora atual: ${horaFormatada} (BRT, UTC-3)\n- REGRA ABSOLUTA: Use check_availability ANTES de sugerir ou validar qualquer horÃ¡rio. NÃ£o aceite agendar no passado.`;
                    
                    let meetingContext = '';
                    try {
                        const existingMeetings = await db.select().from(aiScheduledMeetings).where(and(eq(aiScheduledMeetings.companyId, companyId), eq(aiScheduledMeetings.contactId, contact.id), eq(aiScheduledMeetings.status, 'scheduled'))).orderBy(desc(aiScheduledMeetings.scheduledAt)).limit(5);
                        if (existingMeetings.length > 0) {
                            meetingContext = '\n\n[REUNIÃ•ES ATIVAS]:';
                            for (const m of existingMeetings) {
                                const mDate = m.scheduledAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                                const mTime = m.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
                                meetingContext += `\n- "${m.title}" | ${mDate} Ã s ${mTime} | Meet: ${m.meetLink || 'N/A'}`;
                            }
                        }
                        const [contactData] = await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, contact.id)).limit(1);
                        if (contactData?.email) meetingContext += `\n\n[EMAIL]: ${contactData.email}`;
                    } catch (e) {}
                    
                    systemPrompt += meetingContext + `\n\n[REGRAS DE AGENDAMENTO]:\n- Chame check_availability primeiro.\n- OfereÃ§a horÃ¡rios que check_availability validou.\n- Ao confirmar, chame schedule_meeting.`;
                    if (persona.schedulingPrompt) systemPrompt += `\n${persona.schedulingPrompt}`;
                }

                const messages: any[] = [{ role: 'system', content: systemPrompt }];
                
                for (const m of recentMessages) {
                    const role = (m.senderType === 'CONTACT' || m.senderType === 'USER') ? 'user' : 'assistant';
                    let content: any = m.content || '';
                    if (m.contentType === 'IMAGE' && m.mediaUrl) {
                        content = [
                            { type: "text", text: content || "[IMAGEM ENVIADA]" },
                            { type: "image_url", image_url: { url: m.mediaUrl } }
                        ];
                    } else if (m.contentType === 'AUDIO') {
                        content = (m as any).aiTranscription || '[SISTEMA: O usuÃ¡rio enviou um Ãudio sem transcriÃ§Ã£o]';
                    } else if (!content || content.trim() === '' || content === 'ðŸŽµ Ãudio') {
                        if (m.contentType === 'DOCUMENT') content = '[SISTEMA: O usuÃ¡rio enviou um Arquivo/Documento]';
                        else if (m.contentType === 'VIDEO') content = '[SISTEMA: O usuÃ¡rio enviou um VÃ­deo]';
                        else if (m.contentType === 'STICKER') content = '[SISTEMA: O usuÃ¡rio enviou uma Figurinha/Sticker]';
                        else content = '[Mensagem vazia]';
                    }

                    messages.push({ role, content });
                }

                const completion = await openai.chat.completions.create({
                    model: modelName,
                    messages: messages,
                    ...(tools.length > 0 ? { tools } : {}),
                    temperature: 0.7,
                });

                const responseMsg = completion.choices[0].message;
                
                if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
                    const toolCall = responseMsg.tool_calls[0];
                    const faName = toolCall.function.name;
                    const faArgs = JSON.parse(toolCall.function.arguments);

                    await logAutomation('INFO', `ðŸ“… IA OpenAI chamou ${faName}: ${JSON.stringify(faArgs)}`, logContextBase);

                    try {
                        if (faName === 'schedule_meeting') {
                            const meetingResult = await scheduleMeeting({ companyId, conversationId: conversation.id, connectionId: conversation.connectionId, contactId: contact.id, ...faArgs });
                            aiResponse = meetingResult.message;
                            if (meetingResult.suggestedSlots && meetingResult.suggestedSlots.length > 0) aiResponse += `\nHorÃ¡rios disponÃ­veis: ${meetingResult.suggestedSlots.join(', ')}`;
                        } else if (faName === 'cancel_meeting') {
                            const cancelResult = await cancelMeeting({ companyId, conversationId: conversation.id, connectionId: conversation.connectionId, contactId: contact.id, ...faArgs });
                            aiResponse = cancelResult.message;
                        } else if (faName === 'reschedule_meeting') {
                            const reschResult = await rescheduleMeeting({ companyId, conversationId: conversation.id, connectionId: conversation.connectionId, contactId: contact.id, ...faArgs });
                            aiResponse = reschResult.message;
                            if (reschResult.suggestedSlots && reschResult.suggestedSlots.length > 0) aiResponse += `\nSugestÃµes: ${reschResult.suggestedSlots.join(', ')}`;
                        } else if (faName === 'check_availability') {
                            const checkResult = await checkAvailability({ companyId, ...faArgs });
                            aiResponse = checkResult.message;
                            if (checkResult.availableSlots && checkResult.availableSlots.length > 0) {
                                aiResponse += ` (Gatilho da Agenda: Por favor, liste alguns destes para o cliente: ${checkResult.availableSlots.slice(0, 4).join(', ')})`;
                            }
                        }
                    } catch (e: any) {
                        aiResponse = 'Desculpe, tive um problema ao processar o agendamento da agenda.';
                    }
                } else {
                    aiResponse = responseMsg.content || '';
                }

                estimatedTokens = completion.usage?.total_tokens || 0;

            } catch (error: any) {
                await logAutomation('ERROR', `Falha no processamento OpenAI: ${error.message}`, logContextBase);
                effectiveProvider = 'GOOGLE'; // Falha engatilha fallback pro google se setado
            }
        }

        // TENTATIVA 2: GOOGLE GEMINI (Se configurado ou se OpenAI falhou no Fallback)
        if (effectiveProvider === 'GOOGLE' || effectiveProvider === 'GEMINI') {
            const modelName = (persona as any)?.model || 'gemini-2.5-flash';
            try {
                // ðŸ” Carregar API key da credencial do banco de dados (prioridade 1)
                let credentialApiKey: string | null = null;
                if (persona.credentialId) {
                    const [credential] = await db.select().from(aiCredentials)
                        .where(eq(aiCredentials.id, persona.credentialId))
                        .limit(1);
                    if (credential?.apiKey) {
                        credentialApiKey = credential.apiKey;
                        await logAutomation('INFO', `âœ… API Key carregada da Persona (credentialId: ${persona.credentialId.substring(0, 8)}...)`, logContextBase);
                    } else {
                        await logAutomation('WARN', `âš ï¸ credentialId configurado na Persona mas credencial nÃ£o encontrada`, logContextBase);
                    }
                }

                const resolvedKeys = await resolveAIKeys(companyId);

                const keysToTry = [
                    credentialApiKey, // ðŸ” Prioridade 1: Credencial vinculada Ã  Persona
                    resolvedKeys.geminiApiKey, // ðŸ” Prioridade 2: Credencial da Empresa ou Global ou Env
                ].filter(k => !!k);

                let googleSuccess = false;
                // âœ… FIX CRÃTICO: Declarar modelName ANTES do loop para estar disponÃ­vel no catch
                const modelNameForLoop = persona?.model || 'gemini-2.5-flash';

                await logAutomation('INFO', `[V3-FIX] modelName resolvido: ${modelNameForLoop}, keys disponÃ­veis: ${keysToTry.length}`, logContextBase);

                for (const key of keysToTry) {
                    if (googleSuccess) break;
                    const genAI = new GoogleGenerativeAI(key!);

                    try {
                        await logAutomation('INFO', `Tentando Google Gemini Direct (${modelName})...`, logContextBase);

                        const functionDeclarations: any[] = [];
                        if (persona.enableScheduling) {
                            functionDeclarations.push(scheduleMeetingToolDefinition);
                            functionDeclarations.push(cancelMeetingToolDefinition);
                            functionDeclarations.push(rescheduleMeetingToolDefinition);
                            functionDeclarations.push(checkAvailabilityToolDefinition);

                            // â° INJETAR CONSCIÃŠNCIA TEMPORAL (DATA/HORA ATUAL em BRT)
                            const nowUTC_scheduling = new Date();
                            const BRT_OFFSET = -3 * 60 * 60 * 1000;
                            const nowBRT_scheduling = new Date(nowUTC_scheduling.getTime() + BRT_OFFSET);
                            const diasSemana = ['Domingo', 'Segunda-feira', 'TerÃ§a-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'SÃ¡bado'];
                            const diaSemana = diasSemana[nowBRT_scheduling.getUTCDay()];
                            const dataFormatada = `${String(nowBRT_scheduling.getUTCDate()).padStart(2, '0')}/${String(nowBRT_scheduling.getUTCMonth() + 1).padStart(2, '0')}/${nowBRT_scheduling.getUTCFullYear()}`;
                            const horaFormatada = `${String(nowBRT_scheduling.getUTCHours()).padStart(2, '0')}:${String(nowBRT_scheduling.getUTCMinutes()).padStart(2, '0')}`;

                            systemPrompt += `\n\n[DATA E HORA ATUAL]:
- Dia: ${diaSemana}, ${dataFormatada}
- Hora: ${horaFormatada} (HorÃ¡rio de BrasÃ­lia, UTC-3)
- REGRA ABSOLUTA: NUNCA sugira ou confirme horÃ¡rios que jÃ¡ passaram. Se agora sÃ£o ${horaFormatada}, qualquer horÃ¡rio anterior a este Ã© INVÃLIDO para hoje.
- Para agendamentos: SEMPRE use check_availability ANTES de sugerir qualquer horÃ¡rio ao contato.`;

                            // ðŸ“… Inject meeting context: existing meetings for this contact
                            let meetingContext = '';
                            try {
                                const existingMeetings = await db.select()
                                    .from(aiScheduledMeetings)
                                    .where(and(
                                        eq(aiScheduledMeetings.companyId, companyId),
                                        eq(aiScheduledMeetings.contactId, contact.id),
                                        eq(aiScheduledMeetings.status, 'scheduled')
                                    ))
                                    .orderBy(desc(aiScheduledMeetings.scheduledAt))
                                    .limit(5);

                                if (existingMeetings.length > 0) {
                                    meetingContext = '\n\n[REUNIÃ•ES ATIVAS DO CONTATO]:';
                                    for (const m of existingMeetings) {
                                        const mDate = m.scheduledAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                                        const mTime = m.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
                                        meetingContext += `\n- "${m.title}" | ${mDate} Ã s ${mTime} | Meet: ${m.meetLink || 'N/A'}`;
                                    }
                                }

                                // Inject contact email if available
                                const [contactData] = await db.select({ email: contacts.email })
                                    .from(contacts)
                                    .where(eq(contacts.id, contact.id))
                                    .limit(1);
                                if (contactData?.email) {
                                    meetingContext += `\n\n[EMAIL DO CONTATO]: ${contactData.email}`;
                                }
                            } catch (ctxErr) {
                                logger.error('[AutomationEngine] Error fetching meeting context:', ctxErr);
                            }

                            // Inject default scheduling rules (always active when scheduling is enabled)
                            systemPrompt += meetingContext + `\n\n[REGRAS DE AGENDAMENTO]:
- REGRA #0 (PRIORITÃRIA): ANTES de sugerir QUALQUER horÃ¡rio ao contato, SEMPRE chame check_availability primeiro para verificar os horÃ¡rios REALMENTE disponÃ­veis na agenda
- NUNCA invente horÃ¡rios de cabeÃ§a. SOMENTE ofereÃ§a horÃ¡rios que check_availability confirmou como disponÃ­veis
- Se check_availability retornar que nÃ£o hÃ¡ horÃ¡rios disponÃ­veis hoje, ofereÃ§a automaticamente o prÃ³ximo dia disponÃ­vel
- NUNCA sugira horÃ¡rios que jÃ¡ passaram (verifique a [DATA E HORA ATUAL] acima)
- Quando o contato confirmar data e horÃ¡rio, chame schedule_meeting IMEDIATAMENTE
- NÃƒO peÃ§a confirmaÃ§Ã£o extra apÃ³s o contato jÃ¡ ter confirmado
- Se o contato disser "Sim", "ok", "pode ser" ou confirmar, execute o agendamento sem perguntas adicionais
- Use APENAS as tools (check_availability, schedule_meeting, cancel_meeting, reschedule_meeting) para aÃ§Ãµes de agendamento
- Para CANCELAR reuniÃ£o, use cancel_meeting. Para REAGENDAR, use reschedule_meeting
- NUNCA peÃ§a o email do contato novamente se jÃ¡ estiver listado acima em [EMAIL DO CONTATO]
- VocÃª TEM acesso ao histÃ³rico de reuniÃµes do contato listado acima. Use essas informaÃ§Ãµes

[NORMALIZAÃ‡ÃƒO DE DATA/HORA]:
- REGRA DE NORMALIZAÃ‡ÃƒO: Ao chamar schedule_meeting, check_availability ou reschedule_meeting, normalize os campos date e time:
  - DATE: Converta a entrada do contato para o formato mais simples aceito: "hoje", "amanhÃ£", "segunda", "terÃ§a" (dia da semana), "DD/MM/YYYY" ou "YYYY-MM-DD"
  - TIME: SEMPRE converta para formato 24h "HH:MM". Exemplos: "3 da tarde" â†’ "15:00", "4pm" â†’ "16:00", "meio-dia" â†’ "12:00", "manhÃ£" â†’ "09:00"
  - Se o contato disser apenas "manhÃ£", "tarde" ou "noite" sem horÃ¡rio especÃ­fico, use esse texto como time â€” o sistema interpretarÃ¡ como 09:00, 14:00 e 19:00 respectivamente
  - NUNCA passe textos livres ou frases completas nos campos date/time. Extraia apenas a data e apenas o horÃ¡rio separadamente`;
                            // Append custom scheduling instructions if configured
                            if (persona.schedulingPrompt) {
                                systemPrompt += `\n${persona.schedulingPrompt}`;
                            }
                        }

                        const toolsArray: any[] = [];
                        if (functionDeclarations.length > 0) {
                            toolsArray.push({ functionDeclarations });
                        }
                        if (persona.google_search_enabled) {
                            toolsArray.push({ googleSearch: {} });
                        }

                        const model = genAI.getGenerativeModel({
                            model: modelName,
                            systemInstruction: {
                                role: 'system',
                                parts: [{ text: systemPrompt }]
                            },
                            ...(toolsArray.length > 0 ? { tools: toolsArray } : {}),
                        });

                        const rawHistory: any[] = [];
                        for (const m of recentMessages.slice(0, -1)) {
                            const role = (m.senderType === 'CONTACT' || m.senderType === 'USER') ? 'user' : 'model';
                            const parts: any[] = [];

                            if (m.contentType === 'IMAGE' && m.mediaUrl) {
                                const inlineDataPart = await fetchImageAsInlineData(m.mediaUrl);
                                if (inlineDataPart) parts.push(inlineDataPart);
                            }
                            
                            if (m.contentType === 'AUDIO') {
                                parts.push({ text: (m as any).aiTranscription || '[SISTEMA: O usuÃ¡rio enviou um Ãudio sem transcriÃ§Ã£o]' });
                            } else if (m.content && m.content.trim() !== '' && m.content !== 'ðŸŽµ Ãudio') {
                                const cleanContent = m.content.replace(/_+TOKENS:\d+/g, '').trim();
                                parts.push({ text: cleanContent });
                            } else {
                                // Message Parsing Shield: Prevent empty turns for unsupported media
                                if (m.contentType === 'DOCUMENT') parts.push({ text: '[SISTEMA: O usuÃ¡rio enviou um Arquivo/Documento]' });
                                else if (m.contentType === 'VIDEO') parts.push({ text: '[SISTEMA: O usuÃ¡rio enviou um VÃ­deo]' });
                                else if (m.contentType === 'STICKER') parts.push({ text: '[SISTEMA: O usuÃ¡rio enviou uma Figurinha/Sticker]' });
                            }

                            if (parts.length > 0) {
                                rawHistory.push({ role, parts });
                            }
                        }

                        const validHistory: { role: string; parts: any[] }[] = [];
                        let lastRole = '';

                        for (const h of rawHistory) {
                            if (h.role === 'model' && validHistory.length === 0) continue;
                            if (h.role === lastRole && validHistory.length > 0) {
                                // âœ… FIX: Mesclar parts ao invÃ©s de apenas concatenar texto
                                validHistory[validHistory.length - 1].parts.push(...h.parts);
                                continue;
                            }

                            validHistory.push(h as any);
                            lastRole = h.role;
                        }

                        const chatSafe = model.startChat({
                            history: validHistory as any,
                            generationConfig: {
                                maxOutputTokens: 1000,
                                temperature: 0.7,
                            }
                        });

                        const lastMsgObj = recentMessages[recentMessages.length - 1];
                        let lastMsgContent = lastMsgObj?.content;
                        
                        if (lastMsgObj?.contentType === 'AUDIO') {
                             lastMsgContent = (lastMsgObj as any).aiTranscription || '[SISTEMA: O usuÃ¡rio enviou um Ãudio sem transcriÃ§Ã£o]';
                        } else if (!lastMsgContent || lastMsgContent.trim() === '' || lastMsgContent === 'ðŸŽµ Ãudio') {
                             // Remove hardcoded 'tenho interesse' hallucination trigger
                             if (lastMsgObj?.contentType === 'DOCUMENT') lastMsgContent = '[SISTEMA: O usuÃ¡rio enviou um Arquivo/Documento]';
                             else if (lastMsgObj?.contentType === 'VIDEO') lastMsgContent = '[SISTEMA: O usuÃ¡rio enviou um VÃ­deo]';
                             else if (lastMsgObj?.contentType === 'STICKER') lastMsgContent = '[SISTEMA: O usuÃ¡rio enviou uma Figurinha/Sticker]';
                             else lastMsgContent = '[SISTEMA: O usuÃ¡rio enviou um conteÃºdo nÃ£o suportado ou vazio]';
                        }
                        
                        // ðŸ“¸ Tratar a Ãºltima mensagem como array de parts se for imagem
                        let finalSendPayload: any = lastMsgContent;
                        if (lastMsgObj?.contentType === 'IMAGE' && lastMsgObj?.mediaUrl) {
                            const inlineDataPart = await fetchImageAsInlineData(lastMsgObj.mediaUrl);
                            if (inlineDataPart) {
                                finalSendPayload = [inlineDataPart, { text: lastMsgContent }];
                            }
                        }

                        await logAutomation('INFO', `[V3-DEBUG] Enviando mensagem final ao Gemini (Model: ${modelName}, isMultimodal: ${Array.isArray(finalSendPayload)})`, logContextBase);
                        const result = await chatSafe.sendMessage(finalSendPayload);
                        const response = await result.response;

                        // ðŸ“… Handle function calls (schedule_meeting tool)
                        const functionCalls = response.functionCalls();
                        if (functionCalls && functionCalls.length > 0) {
                            const call = functionCalls[0];
                            if (call.name === 'schedule_meeting') {
                                await logAutomation('INFO', `ðŸ“… IA chamou schedule_meeting: ${JSON.stringify(call.args)}`, logContextBase);
                                try {
                                    const meetingResult = await scheduleMeeting({
                                        companyId,
                                        conversationId: conversation.id, connectionId: conversation.connectionId,
                                        contactId: contact.id,
                                        ...(call.args as any),
                                    });
                                    aiResponse = meetingResult.message;
                                    // NOTE: meetLink is already embedded in meetingResult.message
                                    // Do NOT append it again to avoid duplicate links
                                    if (meetingResult.suggestedSlots && meetingResult.suggestedSlots.length > 0) {
                                        aiResponse += `\nHorÃ¡rios disponÃ­veis: ${meetingResult.suggestedSlots.join(', ')}`;
                                    }
                                    await logAutomation('INFO', `ðŸ“… Resultado do agendamento: ${meetingResult.success ? 'âœ…' : 'âŒ'} ${meetingResult.message}`, logContextBase);
                                } catch (meetingError: any) {
                                    await logAutomation('ERROR', `ðŸ“… Erro ao executar schedule_meeting: ${meetingError.message}`, logContextBase);
                                    aiResponse = 'Desculpe, tive um problema ao tentar agendar a reuniÃ£o. Pode tentar novamente?';
                                }
                            } else if (call.name === 'cancel_meeting') {
                                await logAutomation('INFO', `ðŸš« IA chamou cancel_meeting: ${JSON.stringify(call.args)}`, logContextBase);
                                try {
                                    const cancelResult = await cancelMeeting({
                                        companyId,
                                        conversationId: conversation.id, connectionId: conversation.connectionId,
                                        contactId: contact.id,
                                        ...(call.args as any),
                                    });
                                    aiResponse = cancelResult.message;
                                    await logAutomation('INFO', `ðŸš« Resultado do cancelamento: ${cancelResult.success ? 'âœ…' : 'âŒ'} ${cancelResult.message}`, logContextBase);
                                } catch (cancelError: any) {
                                    await logAutomation('ERROR', `ðŸš« Erro ao executar cancel_meeting: ${cancelError.message}`, logContextBase);
                                    aiResponse = 'Desculpe, tive um problema ao cancelar a reuniÃ£o. Pode tentar novamente?';
                                }
                            } else if (call.name === 'reschedule_meeting') {
                                await logAutomation('INFO', `ðŸ”„ IA chamou reschedule_meeting: ${JSON.stringify(call.args)}`, logContextBase);
                                try {
                                    const rescheduleResult = await rescheduleMeeting({
                                        companyId,
                                        conversationId: conversation.id, connectionId: conversation.connectionId,
                                        contactId: contact.id,
                                        ...(call.args as any),
                                    });
                                    aiResponse = rescheduleResult.message;
                                    await logAutomation('INFO', `ðŸ”„ Resultado do reagendamento: ${rescheduleResult.success ? 'âœ…' : 'âŒ'} ${rescheduleResult.message}`, logContextBase);
                                } catch (rescheduleError: any) {
                                    await logAutomation('ERROR', `ðŸ”„ Erro ao executar reschedule_meeting: ${rescheduleError.message}`, logContextBase);
                                    aiResponse = 'Desculpe, tive um problema ao reagendar a reuniÃ£o. Pode tentar novamente?';
                                }
                            } else if (call.name === 'check_availability') {
                                await logAutomation('INFO', `ðŸ” IA chamou check_availability: ${JSON.stringify(call.args)}`, logContextBase);
                                try {
                                    const availabilityResult = await checkAvailability({
                                        companyId,
                                        ...(call.args as any),
                                    });
                                    await logAutomation('INFO', `ðŸ” Resultado check_availability: ${availabilityResult.totalAvailable} slots disponÃ­veis em ${availabilityResult.date} (${availabilityResult.dayOfWeek})`, logContextBase);

                                    // Send availability result back to Gemini so it can compose a natural response
                                    const availFunctionResponse = {
                                        role: 'function' as const,
                                        parts: [{
                                            functionResponse: {
                                                name: 'check_availability',
                                                response: availabilityResult,
                                            },
                                        }],
                                    };

                                    const followUp = await chatSafe.sendMessage([availFunctionResponse.parts[0]]);
                                    const followUpResponse = await followUp.response;

                                    // Check if the model wants to call another tool (e.g., schedule_meeting)
                                    const followUpCalls = followUpResponse.functionCalls();
                                    if (followUpCalls && followUpCalls.length > 0) {
                                        const nextCall = followUpCalls[0];
                                        if (nextCall.name === 'schedule_meeting') {
                                            await logAutomation('INFO', `ðŸ“… IA chamou schedule_meeting apÃ³s check_availability: ${JSON.stringify(nextCall.args)}`, logContextBase);
                                            const meetingResult = await scheduleMeeting({
                                                companyId,
                                                conversationId: conversation.id, connectionId: conversation.connectionId,
                                                contactId: contact.id,
                                                ...(nextCall.args as any),
                                            });
                                            aiResponse = meetingResult.message;
                                            await logAutomation('INFO', `ðŸ“… Resultado do agendamento: ${meetingResult.success ? 'âœ…' : 'âŒ'} ${meetingResult.message}`, logContextBase);
                                        } else {
                                            aiResponse = followUpResponse.text() || availabilityResult.message;
                                        }
                                    } else {
                                        aiResponse = followUpResponse.text() || availabilityResult.message;
                                    }
                                } catch (availError: any) {
                                    await logAutomation('ERROR', `ðŸ” Erro ao executar check_availability: ${availError.message}`, logContextBase);
                                    aiResponse = 'Desculpe, tive um problema ao verificar a disponibilidade. Pode tentar novamente?';
                                }
                            }
                        } else {
                            aiResponse = response.text();
                        }

                        if (aiResponse) {
                            // ðŸ›¡ï¸ SANITIZAÃ‡ÃƒO DE METADADOS
                            aiResponse = aiResponse
                                .replace(/^\[(Ãudio|Audio)\s*Transcri(to|bed)\]:?\s*/i, '')
                                .replace(/^(Ãudio|Audio)\s*Transcri(to|bed)(\.|:)?\s*/i, '')
                                .replace(/^"?\[.*?\]"?/g, '')
                                .trim();

                            estimatedTokens = estimateTokenCount(systemPrompt) + estimateTokenCount(aiResponse);
                            googleSuccess = true;
                            await logAutomation('INFO', `âœ… Sucesso com Google Gemini (${modelName})`, logContextBase);
                            break;
                        }
                    } catch (gErr: any) {
                        const errorDetails = {
                            message: gErr.message,
                            status: gErr.status,
                            keySuffix: key ? key.slice(-4) : 'null'
                        };
                        await logAutomation('WARN', `Falha no Google Gemini (${modelName}): ${gErr.message}`, { ...logContextBase, details: errorDetails });
                        
                        const isQuotaError = gErr?.status === 429 || gErr?.message?.includes('quota') || gErr?.message?.includes('insufficient') || gErr?.message?.includes('Too Many Requests');
                        if (isQuotaError) {
                            aiResponse = 'Peço desculpas, mas estou enfrentando uma leve instabilidade no sistema. Por favor, aguarde um instante enquanto direcionamos para um especialista.';
                            googleSuccess = true;
                            await logAutomation('INFO', `✅ Fallback gracefully activated due to Gemini Quota Exceeded (429)`, logContextBase);
                            break;
                        }
                    }
                }

                if (!googleSuccess) {
                    throw new Error(`Todas as tentativas com Google Gemini (${modelName}) falharam.`);
                }

            } catch (error: any) {
                await logAutomation('ERROR', `Falha crÃ­tica no Google Gemini: ${error.message}`, logContextBase);
                throw error; // Abortar se Google falhar
            }
        }

        // TENTATIVA 2: OPENROUTER (REMOVIDO)
        // Fallback removido conforme solicitaÃ§Ã£o do usuÃ¡rio para usar apenas Google Gemini.

        if (!aiResponse || aiResponse.trim().length === 0) {
            throw new Error('IA retornou resposta vazia.');
        }
        await QuotaService.incrementUsage(companyId, 'ai_tokens', estimatedTokens);

        // Enviar resposta para o WhatsApp
        // âœ… CORREÃ‡ÃƒO: Verificar tipo de conexÃ£o e usar mÃ©todo apropriado
        // Buscar conexÃ£o para verificar o tipo
        const [connectionData] = await db.select().from(connections).where(and(
            eq(connections.id, conversation.connectionId!),
            eq(connections.companyId, companyId)
        )).limit(1);

        if (!connectionData) {
            throw new Error(`ConexÃ£o ${conversation.connectionId} nÃ£o encontrada.`);
        }

        const isEvolution = ['baileys', 'evolution'].includes(connectionData.connectionType || '');

        // ðŸŽ¤ LÃ“GICA NATIVA DE ÃUDIO (Fase 5)
        const audioModeEnabled = (persona as any).audioModeEnabled ?? false;
        const audioMode = (persona as any).audioMode || 'text';
        const voiceSettings = (persona as any).voiceSettings || { voiceId: 'Aoede', speed: 1.0, stability: 0.5 };

        // â›” REGRA ABSOLUTA: EXTRAÃ‡ÃƒO DE CONTEÃšDO SENSÃVEL - SEMPRE SERÃƒO ENVIADOS POR TEXTO
        // Isso acontece ANTES de qualquer decisÃ£o de Ã¡udio/texto
        // Captura: URLs (incluindo meet.google.com), PIX (BR Code), emails, preÃ§os (R$), telefones
        const textOnlyRegex = /(https?:\/\/[^\s]+|000201[A-Za-z0-9.\-@/\s]{20,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}(?=\s|$)|(?:pix|chave|chavepix|copia\s*e\s*cola)[:\s]+[^\s]{10,}|R\$\s*[\d.,]+|[\d.,]+\s*reais|\(\d{2}\)\s*\d{4,5}-?\d{4})/gi;
        const extractedPaymentResources = aiResponse.match(textOnlyRegex) || [];
        let sanitizedAiResponse = aiResponse.replace(textOnlyRegex, '').replace(/\s+/g, ' ').trim();
        // SeguranÃ§a extra: remover menÃ§Ãµes residuais de pix com dados
        sanitizedAiResponse = sanitizedAiResponse.replace(/pix[:\s]*[0-9A-Za-z.\-@]{10,}/gi, '').trim();

        if (extractedPaymentResources.length > 0) {
            await logAutomation('INFO', `ðŸ”’ REGRA GLOBAL: ExtraÃ­dos ${extractedPaymentResources.length} PIX/Links - serÃ£o enviados APENAS por texto.`, logContextBase);
        }

        // DecisÃ£o de Envio (Smart Mode + InteligÃªncia Comportamental VAK)
        // ----------------------------------------------------
        // Prioridade:
        // 0. REGRA ABSOLUTA: ConteÃºdo sensÃ­vel â†’ sempre texto
        // 1. Toggle OFF â†’ seguir VAK do contato
        // 2. Toggle ON â†’ seguir modo selecionado (text/audio/both)
        // ----------------------------------------------------

        let finalFormat: 'TEXT' | 'AUDIO' = 'TEXT';
        const userSentAudio = (message.contentType === 'AUDIO' || (message.content && message.content.startsWith('[Ãudio')));
        const isEarlyInConversation = dailyMessageCount < 3; // 0, 1, 2 = 3 mensagens
        const isLongResponse = sanitizedAiResponse.length > 160;
        const contactVakProfile = (contact as any).vakProfile || 'UNKNOWN';

        if (extractedPaymentResources.length > 0) {
            // â›” REGRA ABSOLUTA: Se tem Link/PIX/PreÃ§o/Telefone, NUNCA enviar Ã¡udio.
            finalFormat = 'TEXT';
        } else if (!audioModeEnabled) {
            // ðŸ§  Toggle DESATIVADO â†’ Seguir InteligÃªncia Comportamental (VAK) do contato
            if (contactVakProfile === 'AUDITORY') {
                finalFormat = 'AUDIO';
            } else if (contactVakProfile === 'UNKNOWN' && userSentAudio) {
                finalFormat = 'AUDIO'; // Reciprocidade quando VAK desconhecido
            } else {
                finalFormat = 'TEXT'; // VISUAL, KINESTHETIC, MIXED â†’ texto
            }
            await logAutomation('INFO', `ðŸ§  VAK Mode: Perfil=${contactVakProfile}, UserAudio=${userSentAudio}`, logContextBase);
        } else {
            // ðŸŽšï¸ Toggle ATIVADO â†’ Seguir modo selecionado
            if (audioMode === 'text') {
                finalFormat = 'TEXT'; // Sempre texto, sem exceÃ§Ãµes
            } else if (audioMode === 'audio') {
                finalFormat = 'AUDIO'; // Sempre Ã¡udio (Consultor Real)
            } else {
                // Modo 'both' (MÃ¡ximo Engajamento) â†’ Smart com VAK
                if (userSentAudio) {
                    finalFormat = 'AUDIO'; // Reciprocidade
                } else if (contactVakProfile === 'AUDITORY') {
                    finalFormat = 'AUDIO'; // VAK auditivo
                } else if (isEarlyInConversation) {
                    finalFormat = 'TEXT'; // Warming Up
                } else {
                    finalFormat = isLongResponse ? 'AUDIO' : 'TEXT';
                }
            }
        }

        // Mapeamento para flags de controle (Mutuamente Exclusivos para conteÃºdo conversacional)
        const shouldSendAudio = (finalFormat === 'AUDIO');
        let shouldSendText = (finalFormat === 'TEXT');

        await logAutomation('INFO', `ðŸ§  DecisÃ£o de Formato: ${finalFormat} (UserAudio=${userSentAudio}, Count=${dailyMessageCount}, Len=${sanitizedAiResponse.length})`, logContextBase);

        // 1. EXECUÃ‡ÃƒO DE Ã UDIO (se aplicÃ¡vel)
        let audioSentSuccessfully = false;
        if (shouldSendAudio) {
            await logAutomation('INFO', `ðŸŽ¤ PROCESSANDO Ã UDIO (Modo: ${audioMode}, Voz: ${voiceSettings.voiceId})`, logContextBase);

            // âœ… USANDO sanitizedAiResponse (jÃ¡ limpo de PIX/Links na extraÃ§Ã£o global acima)
            const audioSafeText = sanitizedAiResponse;

            try {
                // SÃ³ gera Ã¡udio se sobrar texto conversacional relevante (mÃ­nimo 10 chars)
                if (audioSafeText.length > 10) {
                    let wavBuffer: Buffer | null = await generateSpeech(audioSafeText, {
                        provider: (persona as any).voiceProvider || 'gemini',
                        voiceId: voiceSettings.voiceId || 'Aoede',
                        settings: voiceSettings,
                        companyId: companyId
                    });
                    let audioBuffer: Buffer | null = await convertToOgg(wavBuffer);

                    // âœ… MEMORY: Liberar wavBuffer imediatamente apÃ³s conversÃ£o
                    wavBuffer = null;

                    const s3Key = `media_enviada/${uuidv4()}.ogg`;
                    const s3Url = await uploadFileToS3(companyId, s3Key, audioBuffer, 'audio/ogg');

                    if (s3Url) {
                        const audioSendResult = await sendUnifiedMessage({
                            provider: isEvolution ? 'evolution' : 'apicloud',
                            connectionId: conversation.connectionId!,
                            to: contact.phone,
                            message: '',
                            mediaUrl: s3Url,
                            mediaBuffer: audioBuffer,
                            mediaType: 'audio',
                            isVoice: true
                        });

                        if (audioSendResult.success) {
                            await db.insert(messages).values({
                                companyId: companyId,
                                conversationId: conversation.id, connectionId: conversation.connectionId,
                                senderType: 'AI',
                                senderId: 'ai_agent_voice',
                                content: audioSafeText || '[Ãudio]',
                                contentType: 'AUDIO',
                                mediaUrl: s3Url,
                                status: 'sent',
                                providerMessageId: audioSendResult.messageId || null,
                                sentAt: new Date(),
                            }).onConflictDoUpdate({
                                target: messages.providerMessageId,
                                set: {
                                    mediaUrl: s3Url,
                                    content: audioSafeText || '[Ãudio]', // Garantir content correto
                                    senderType: 'AI', // Garantir sender type correto
                                }
                            });
                            await logAutomation('INFO', 'ðŸŽ¤ Resposta de Ã¡udio enviada.', logContextBase);
                            audioSentSuccessfully = true;

                            // âœ… MEMORY: Liberar audioBuffer apÃ³s envio bem-sucedido
                            audioBuffer = null;

                            // âœ… MEMORY: Dar oportunidade ao GC de coletar buffers
                            setImmediate(() => {
                                if (global.gc) global.gc();
                            });
                        }
                    }
                }
                // NOTA: PIX/Links sÃ£o enviados FORA deste bloco (apÃ³s todo o fluxo Ã¡udio/texto)
            } catch (ttsError: any) {
                await logAutomation('ERROR', `Falha no TTS: ${ttsError.message}. ForÃ§ando modo texto.`, logContextBase);
                shouldSendText = true; // Fallback garantido
            }
        }

        // 2. EXECUÃ‡ÃƒO DE TEXTO (se aplicÃ¡vel ou se Ã¡udio falhou)
        // âš ï¸ CORREÃ‡ÃƒO: Se Ã¡udio foi enviado com sucesso, NÃƒO enviar texto duplicado (exceto fallback)
        // Texto sÃ³ Ã© enviado se: DecisÃ£o foi TEXTO OU (DecisÃ£o foi ÃUDIO mas falhou)
        const shouldActuallySendText = shouldSendText || (shouldSendAudio && !audioSentSuccessfully);

        if (shouldActuallySendText) {
            // âœ… SANITIZAÃ‡ÃƒO DE SAÃDA (AbreviaÃ§Ãµes, etc.)
            let sanitizedResponse = aiResponse.trim().replace(/^["']|["']$/g, '');

            if (persona.behaviorPresets?.useAbbreviations) {
                const abbrevMap: Record<string, string> = {
                    'vocÃª': 'vc', 'tambÃ©m': 'tbm', 'estÃ¡': 'tÃ¡', 'beleza': 'blz',
                    'entÃ£o': 'ent', 'depois': 'dps', 'amigo': 'amg', 'contato': 'ctt', 'obrigado': 'obg', 'obrigada': 'obg'
                };
                for (const [key, val] of Object.entries(abbrevMap)) {
                    sanitizedResponse = sanitizedResponse.replace(new RegExp(`\\b${key}\\b`, 'gi'), val);
                }
            }

            // âœ… SPLITTER DE RECURSOS (Link/Pix/PreÃ§os/Telefones)
            const resourceRegex = /(https?:\/\/[^\s]+|000201[A-Za-z0-9\s.\-@]{20,}|R\$\s*[\d.,]+|[\d.,]+\s*reais|\(\d{2}\)\s*\d{4,5}-?\d{4})/gi;
            const hasResource = resourceRegex.test(sanitizedResponse);
            let messageParts: string[] = [];

            // ðŸ”€ SPLITTER EXPLÃCITO [SPLIT]: Permite que o prompt instrua a IA a separar mensagens
            // Uso no prompt: "Mensagem 1 [SPLIT] Mensagem 2" â†’ enviadas como 2 mensagens separadas no WhatsApp
            if (sanitizedResponse.includes('[SPLIT]')) {
                messageParts = sanitizedResponse.split('[SPLIT]')
                    .map((part: string) => part.trim())
                    .filter((part: string) => part.length > 0)
                    .slice(0, 5); // MÃ¡ximo 5 partes para seguranÃ§a
                await logAutomation('INFO', `âœ‚ï¸ Splitter [SPLIT]: ${messageParts.length} mensagens separadas detectadas.`, logContextBase);
            } else if (hasResource && (persona.behaviorPresets?.splitResources ?? true)) {
                const textOnly = sanitizedResponse.replace(resourceRegex, '').replace(/\s+/g, ' ').trim();
                const resourcesFound = sanitizedResponse.match(resourceRegex) || [];
                // âœ… FIX: Deduplica recursos para evitar envio duplicado quando a IA repete o mesmo link/PIX
                const uniqueResources = [...new Set(resourcesFound.map((r: string) => r.trim()))];
                if (textOnly) messageParts.push(textOnly);
                messageParts.push(...uniqueResources);
                await logAutomation('INFO', `âœ‚ï¸ Splitter Ativo: ${resourcesFound.length} recursos detectados, ${uniqueResources.length} Ãºnicos enviados.`, logContextBase);
            } else {
                messageParts = sanitizedResponse.split(/\n\s*\n/).filter((part: string) => part.trim().length > 0).slice(0, 3);
            }

            for (const part of messageParts) {
                if (part.trim()) {
                    const [insertedMsg] = await db.insert(messages).values({
                        companyId, conversationId: conversation.id, connectionId: conversation.connectionId, senderType: 'AI', senderId: 'ai_agent',
                        content: part.trim(), contentType: 'TEXT', status: 'sending', sentAt: new Date(),
                    }).returning({ id: messages.id });

                    try {
                        const result = await sendUnifiedMessage({
                            provider: isEvolution ? 'evolution' : 'apicloud',
                            connectionId: conversation.connectionId!,
                            to: contact.phone,
                            message: part.trim(),
                        });
                        await db.update(messages).set({ providerMessageId: result.messageId || null, status: 'sent', sentAt: new Date() }).where(eq(messages.id, insertedMsg.id));
                    } catch (e) {
                        await db.update(messages).set({ status: 'failed' }).where(eq(messages.id, insertedMsg.id));
                        throw e;
                    }
                    await sleep(resourceRegex.test(part) ? 800 : 500);
                }
            }
        }

        // â›” REGRA GLOBAL OBRIGATÃ“RIA: ENVIAR PIX/LINKS SEMPRE COMO TEXTO
        // Este bloco Ã© executado APENAS se o formato principal foi ÃUDIO (ou seja, texto nÃ£o enviado)
        // PIX e Links NUNCA devem ser falados, apenas enviados por texto
        // Se texto foi enviado (shouldActuallySendText), Block 2 jÃ¡ lidou com os links!
        if (extractedPaymentResources.length > 0 && !shouldActuallySendText) {
            // âœ… FIX: Deduplica recursos extraÃ­dos
            const uniquePaymentResources = [...new Set(extractedPaymentResources.map((r: string) => r.trim()))];
            await logAutomation('INFO', `ðŸ”’ Enviando ${uniquePaymentResources.length} PIX/Links OBRIGATORIAMENTE por texto (Modo Ãudio)...`, logContextBase);
            await sleep(audioSentSuccessfully ? 800 : 300); // Delay maior se Ã¡udio foi enviado primeiro

            for (const resource of uniquePaymentResources) {
                const [insertedResourceMsg] = await db.insert(messages).values({
                    companyId,
                    conversationId: conversation.id,
                    connectionId: conversation.connectionId,
                    senderType: 'AI',
                    senderId: 'ai_agent',
                    content: resource,
                    contentType: 'TEXT',
                    status: 'sending',
                    sentAt: new Date(),
                }).returning({ id: messages.id });

                try {
                    const resourceSendResult = await sendUnifiedMessage({
                        provider: isEvolution ? 'evolution' : 'apicloud',
                        connectionId: conversation.connectionId!,
                        to: contact.phone,
                        message: resource,
                    });
                    await db.update(messages).set({
                        providerMessageId: resourceSendResult.messageId || null,
                        status: 'sent'
                    }).where(eq(messages.id, insertedResourceMsg.id));
                    await logAutomation('INFO', `âœ… PIX/Link enviado por texto: ${resource.substring(0, 40)}...`, logContextBase);
                } catch (resourceError) {
                    await db.update(messages).set({ status: 'failed' }).where(eq(messages.id, insertedResourceMsg.id));
                    await logAutomation('ERROR', `âŒ Falha ao enviar PIX/Link: ${(resourceError as Error).message}`, logContextBase);
                }
                await sleep(500);
            }
        }

        apiCache.invalidatePattern(`conversations:${companyId}`);
        import('@/lib/socket').then(({ emitInboxUpdate }) => emitInboxUpdate(companyId)).catch(() => {});

        // âœ… Log dinÃ¢mico baseado no provider usado
        const providerName = 'Google Gemini';
        await logAutomation('INFO', `IA respondeu com sucesso usando ${providerName}.`, logContextBase);

        // âœ… SISTEMA DE QUALIFICAÃ‡ÃƒO AUTOMÃTICA
        // Detectar se o lead deve avanÃ§ar para o prÃ³ximo estÃ¡gio com base na conversa
        await detectAndProgressLead(context, recentMessages, aiResponse);

        // ðŸ“… SISTEMA DE DETECÃ‡ÃƒO DE REUNIÃƒO MARCADA
        // Detectar se uma reuniÃ£o foi agendada e mover para stage especÃ­fico
        const conversationText = recentMessages.map(m => m.content).join('\n');
        const meetingDetection = detectMeetingScheduled(conversationText, aiResponse);

        if (meetingDetection.isMeetingScheduled) {
            await moveLeadToSemanticStage(context, 'meeting_scheduled', meetingDetection.evidence, meetingDetection.scheduledTime);
        }

        // âœ… SISTEMA DE FOLLOW-UP AUTOMÃTICO
        // Agendar follow-up se a persona tiver essa funcionalidade habilitada
        if (persona.followupEnabled) {
            try {
                // âœ… FIX: Use static import (already imported at top of file)
                await scheduleFollowUp(conversation.id, personaId, companyId);
                await logAutomation('INFO', `ðŸ“… Follow-up agendado (${persona.followupDelayMinutes}min)`, logContextBase);
            } catch (followupError) {
                await logAutomation('WARN', `Falha ao agendar follow-up: ${(followupError as Error).message}`, logContextBase);
            }
        }

        return true;

    } catch (error: any) {
        const errorMsg = error.message || '';
        const errorCode = error.code || error.status || error.statusCode;
        const errorStatus = error.status || error.statusCode;
        let sanitizedMessage = maskPII(errorMsg);

        // âœ… CORREÃ‡ÃƒO CRÃTICA: Detectar erros de quota e outros erros recuperÃ¡veis para fallback
        // Incluir erros de quota (RESOURCE_EXHAUSTED, 429, billing, quota exceeded) e erros de rede/servidor
        const isQuotaError =
            errorMsg.includes('quota') ||
            errorMsg.includes('429') ||
            errorMsg.includes('RESOURCE_EXHAUSTED') ||
            errorMsg.includes('insufficient_quota') ||
            errorMsg.includes('billing') ||
            errorMsg.includes('quota exceeded') ||
            errorMsg.toLowerCase().includes('rate limit') ||
            errorCode === 'RESOURCE_EXHAUSTED' ||
            errorCode === 429 ||
            errorStatus === 429 ||
            errorStatus === 'RESOURCE_EXHAUSTED' ||
            errorStatus >= 500 ||
            errorMsg.includes('fetch failed') ||
            errorMsg.includes('timeout') ||
            errorMsg.includes('overloaded');

        if (isQuotaError) {
            // âœ… CORREÃ‡ÃƒO CRÃTICA: Usar currentProvider que foi setado ANTES do try
            // Se ainda nÃ£o temos provider (improvÃ¡vel), tentar inferir do erro
            const detectedProvider: string | null = currentProvider;

            // Log detalhado do erro de quota para debug
            await logAutomation('WARN', `âš ï¸ Erro de quota detectado (${detectedProvider || 'unknown'}). Message: "${errorMsg}", Code: ${errorCode}, Status: ${errorStatus}. Triggering fallback...`, logContextBase);

            sanitizedMessage = "âš ï¸ COTA EXCEDIDA: Limite de requisiÃ§Ãµes atingido. Verifique a configuraÃ§Ã£o da sua API key e saldo na plataforma do provedor.";
            // Enviar resposta padrÃ£o em caso de erro de cota
            try {
                const [connectionData] = await db.select().from(connections).where(and(
                    eq(connections.id, conversation.connectionId!),
                    eq(connections.companyId, companyId)
                )).limit(1);
                if (connectionData) {
                    const defaultText = 'Estamos com alta demanda no momento. Vou te responder em instantes.';
                    if (options?.dryRunSend) {
                        await db.insert(messages).values({ companyId, conversationId: conversation.id, connectionId: conversation.connectionId, senderType: 'AI', senderId: 'ai_agent', content: defaultText, contentType: 'TEXT' });
                        await logAutomation('INFO', 'DRY-RUN: Resposta padrÃ£o simulada apÃ³s erro de cota no Gemini', logContextBase);
                    } else {
                        await sendUnifiedMessage({
                            provider: ['baileys', 'evolution'].includes(connectionData.connectionType || '') ? 'evolution' : 'apicloud',
                            connectionId: conversation.connectionId!,
                            to: contact.phone,
                            message: defaultText
                        });
                        await db.insert(messages).values({ companyId, conversationId: conversation.id, connectionId: conversation.connectionId, senderType: 'AI', senderId: 'ai_agent', content: defaultText, contentType: 'TEXT' });
                        await logAutomation('INFO', 'âœ… Resposta padrÃ£o enviada apÃ³s erro de cota no Gemini', logContextBase);
                    }
                    return true;
                }
            } catch (e) {
                await logAutomation('ERROR', 'Falha crÃ­tica ao enviar resposta padrÃ£o', logContextBase);
            }

        } else if (error.metaCode === 131031) {
            sanitizedMessage = "âŒ CONTA BLOQUEADA (Meta): Sua conta do WhatsApp Business foi bloqueada ou suspensa pela Meta. Verifique o Gerenciador de NegÃ³cios.";
            await logAutomation('ERROR', sanitizedMessage, logContextBase);
        } else if (error.metaCode === 131049) {
            sanitizedMessage = "âš ï¸ DELIVERY BLOCK (Meta): A Meta bloqueou este envio para 'manter o engajamento saudÃ¡vel do ecossistema'. A mensagem pode ser spam ou o contato nÃ£o autorizou.";
            await logAutomation('WARN', sanitizedMessage, logContextBase);
        } else {
            await logAutomation('ERROR', `Falha ao comunicar com a IA: ${sanitizedMessage}`, logContextBase);
        }

        return false;
    }
}


const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
