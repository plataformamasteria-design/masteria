// src/lib/campaign-sender.ts
// NOTE: Removed 'use server' directive - this file is called from BullMQ Worker

import { db } from '@/lib/db';
import {
    campaigns,
    contactsToContactLists,
    contacts,
    smsGateways,
    smsDeliveryReports,
    templates,
    mediaAssets,
    whatsappDeliveryReports,
    connections,
    messageTemplates,
    conversations,
    messages,
    voiceAgents,
    contactsToTags,
    kanbanLeads
} from '@/lib/db/schema';
import { eq, inArray, and, sql, desc } from 'drizzle-orm';
import { ensureTenantAccess } from '@/lib/db/tenant-guard';
import { decrypt } from './crypto';
import { uploadMediaToMeta } from './metaMediaUpload';
import { sendWhatsappTemplateMessage } from './facebookApiService';
import type { MediaAsset as MediaAssetType, MetaApiMessageResponse, MetaHandle } from './types';
import { evolutionApiService } from '@/services/evolution-api.service';
import { NotificationService } from '@/lib/notifications/notification-service';
import { UserNotificationsService } from './notifications/user-notifications.service';
import { webhookDispatcher } from '@/services/webhook-dispatcher.service';
import * as CircuitBreaker from '@/lib/circuit-breaker';
import { normalizeBrazilianSMS } from './utils/phone';

const DEBUG = process.env.DEBUG === 'true';

// Helper para dividir um array em lotes
function chunkArray<T>(array: T[], size: number): T[][] {
    if (size <= 0) return [array]; // Retorna um único lote se o tamanho for inválido
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Helper para criar uma pausa
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper para criar/atualizar conversa e salvar mensagem de campanha
async function createCampaignConversationAndMessage(
    companyId: string,
    contactId: string,
    connectionId: string,
    providerMessageId: string | null,
    messageContent: string,
    _campaignId: string,
    disableBotOnSend: boolean = false,
    isTemplate: boolean = false
): Promise<void> {
    try {
        await db.transaction(async (tx) => {
            // Buscar conversa mais recente do contato nesta empresa
            let [conversation] = await tx
                .select()
                .from(conversations)
                .where(and(
                    eq(conversations.contactId, contactId),
                    eq(conversations.companyId, companyId)
                ))
                .orderBy(desc(conversations.lastMessageAt))
                .limit(1);

            if (conversation) {
                // Atualiza conversa existente e centraliza na conexão do disparo
                const [updatedConvo] = await tx
                    .update(conversations)
                    .set({
                        connectionId: connectionId, // Consolida o histórico
                        lastMessageAt: new Date(),
                        status: 'IN_PROGRESS',
                        archivedAt: null,
                        archivedBy: null,
                        aiActive: disableBotOnSend ? false : undefined,
                    })
                    .where(eq(conversations.id, conversation.id))
                    .returning();
                conversation = updatedConvo;
            } else {
                // Cria nova conversa se não existir nenhuma
                [conversation] = await tx
                    .insert(conversations)
                    .values({
                        companyId,
                        contactId,
                        connectionId,
                        status: 'IN_PROGRESS',
                        lastMessageAt: new Date(),
                        aiActive: !disableBotOnSend,
                    })
                    .returning();
            }

            if (!conversation) {
                throw new Error('Falha ao criar ou atualizar conversa para mensagem de campanha.');
            }

            // Salvar mensagem de campanha visível no frontend como balão enviado
            await tx.insert(messages).values({
                companyId,
                conversationId: conversation.id,
                connectionId: connectionId, // FIX: Inclui o connectionId para não sumir no filtro do frontend
                providerMessageId,
                senderType: 'AGENT', // Fix: Renderiza como mensagem normal, não log de sistema
                content: messageContent,
                contentType: isTemplate ? 'TEMPLATE' : 'TEXT',
                status: 'SENT',
                sentAt: new Date(),
            });
        });
    } catch (error) {
        console.error('[Campaign] Erro ao criar conversa/mensagem:', error);
        // Não lançar erro para não interromper o fluxo da campanha
    }
}

// Helper para determinar se um erro é transiente (retryable)
function isTransientError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || error?.response?.status;

    // Network errors transientes
    if (errorMessage.includes('timeout') ||
        errorMessage.includes('econnreset') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('network') ||
        errorMessage.includes('socket hang up')) {
        return true;
    }

    // HTTP 5xx errors (server-side transientes)
    if (errorCode >= 500 && errorCode < 600) {
        return true;
    }

    // Rate limit temporário (429)
    if (errorCode === 429) {
        return true;
    }

    // Erros permanentes: 4xx (exceto 429), invalid params, etc
    return false;
}

// Helper para retry com exponential backoff
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 2000
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Se não é transiente ou última tentativa, falha imediatamente
            if (!isTransientError(error) || attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff: 2s → 4s → 8s
            const delayMs = initialDelayMs * Math.pow(2, attempt);
            if (DEBUG) logger.debug(`[RETRY] Tentativa ${attempt + 1}/${maxRetries} falhou com erro transiente. Tentando novamente em ${delayMs}ms...`, error);
            await sleep(delayMs);
        }
    }

    throw lastError;
}

// Helper para extrair texto do body de um template (message_templates usa components jsonb)
function extractBodyText(template: any): string {
    // Se tem campo body direto (templates legado), usa ele
    if (template.body && typeof template.body === 'string') {
        return template.body;
    }

    // Se tem components (message_templates novo), extrai do BODY component
    if (template.components && Array.isArray(template.components)) {
        const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
        if (bodyComponent?.text) {
            return bodyComponent.text;
        }
    }

    return '';
}

// Helper para extrair header type de um template
function extractHeaderType(template: any): string | null {
    // Se tem headerType direto (templates legado), usa ele
    if (template.headerType) {
        return template.headerType;
    }

    // Se tem components (message_templates novo), extrai do HEADER component
    if (template.components && Array.isArray(template.components)) {
        const headerComponent = template.components.find((c: any) => c.type === 'HEADER');
        if (headerComponent?.format) {
            return headerComponent.format;
        }
    }

    return null;
}

// Helper para resolver template de ambas tabelas e normalizar estrutura
interface ResolvedTemplate {
    name: string;
    language: string;
    bodyText: string;
    headerType: string | null;
    hasMedia: boolean;
    mediaLink?: string | null;
    mediaAssetId?: string | null;
}

function resolveTemplate(template: any): ResolvedTemplate {
    const bodyText = extractBodyText(template);
    const headerType = extractHeaderType(template);
    const hasMedia = headerType ? ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType.toUpperCase()) : false;

    let mediaLink = null;
    let mediaAssetId = null;
    if (template.components && Array.isArray(template.components)) {
        const headerComponent = template.components.find((c: any) => c.type === 'HEADER');
        if (headerComponent?.example) {
             mediaAssetId = headerComponent.example.mediaAssetId;
             const handle = headerComponent.example.header_handle?.[0];
             const url = headerComponent.example.header_url?.[0];
             const resolvedUrl = url || (handle?.startsWith('http') ? handle : null);
             mediaLink = headerComponent.example.mediaUrl || resolvedUrl;
        }
    }

    return {
        name: template.name,
        language: template.language,
        bodyText,
        headerType,
        hasMedia,
        mediaLink,
        mediaAssetId
    };
}

// ==========================================
// WHATSAPP CAMPAIGN SENDER
// ==========================================

// Interface para retorno do envio de mensagem
interface CampaignMessageResult {
    success: boolean;
    contactId: string;
    providerMessageId?: string | null;
    error?: string;
}

// Sub-função: Enviar via Evolution API
async function sendViaEvolution(
    connectionId: string,
    contact: typeof contacts.$inferSelect,
    resolvedTemplate: ResolvedTemplate,
    variableMappings: Record<string, { type: 'dynamic' | 'fixed'; value: string }>,
    companyId: string,
    skipValidation: boolean = false
): Promise<CampaignMessageResult> {
    // Verificar status da sessão
    let sessionStatusData: any;
    let sessionStatus: string | null = null;
    
    try {
        sessionStatusData = await evolutionApiService.getConnectionState(connectionId);
        sessionStatus = sessionStatusData?.instance?.state || null;
    } catch (e) {
        sessionStatus = null;
    }
    
    logger.debug(`[Campaign-Evolution] Preparando envio | ConnectionID: ${connectionId} | Status: ${sessionStatus || 'NOT_FOUND'} | Contato: ${contact.phone}`);

    if (sessionStatus !== 'open') {
        const errorMsg = sessionStatus ? `Sessão ${sessionStatus} - não está conectada` : 'Sessão não encontrada no Evolution API';
        console.error(`[Campaign-Evolution] ERRO: ${errorMsg} | ConnectionID: ${connectionId}`);
        return {
            success: false,
            contactId: contact.id,
            error: errorMsg,
        };
    }

    // Substitui variáveis no body text
    let messageText = resolvedTemplate.bodyText;
    const bodyVariables = messageText.match(/\{\{(\d+)\}\}/g) || [];

    for (const placeholder of bodyVariables) {
        const varKey = placeholder.replace(/\{|\}/g, '');
        const mapping = variableMappings[varKey];
        let text = `[variável ${varKey} não mapeada]`;

        if (mapping) {
            if (mapping.type === 'fixed') {
                text = mapping.value;
            } else if (mapping.type === 'dynamic') {
                const dynamicValue = contact[mapping.value as keyof typeof contact];
                if (dynamicValue !== null && dynamicValue !== undefined) {
                    text = String(dynamicValue);
                } else {
                    text = `[dado ausente]`;
                }
            }
        }

        messageText = messageText.replace(placeholder, text);
    }

    logger.debug(`[Campaign-Evolution] Texto final da mensagem: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`);

    try {
        const { formatJid } = await import('@/lib/utils/whatsapp');
        const phoneJid = formatJid(contact.phone);
        const number = phoneJid?.split('@')[0];

        // Envolve com retry logic para erros transientes
        const result = await withRetry(async () => {
            return await evolutionApiService.sendMessage(
                connectionId,
                number || contact.phone,
                messageText
            );
        });

        const messageId = result?.key?.id;

        if (messageId) {
            if (DEBUG) logger.debug(`[Campaign-Evolution] ✅ Mensagem enviada com sucesso | Contato: ${contact.phone} | MessageID: ${messageId}`);
            return {
                success: true,
                contactId: contact.id,
                providerMessageId: messageId,
            };
        } else {
            console.error(`[Campaign-Evolution] ❌ Evolution retornou null | Contato: ${contact.phone} | ConnectionID: ${connectionId}`);
            return {
                success: false,
                contactId: contact.id,
                error: 'Evolution retornou erro - sessão pode ter caído durante o envio',
            };
        }
    } catch (error) {
        console.error(`[Campaign-Evolution] ❌ Exceção ao enviar | Contato: ${contact.phone} | Erro: ${(error as Error).message}`);
        return {
            success: false,
            contactId: contact.id,
            error: (error as Error).message,
        };
    }
}

// Sub-função: Enviar via Meta API (código atual refatorado)
async function sendViaMetaApi(
    connection: typeof connections.$inferSelect,
    contact: typeof contacts.$inferSelect,
    resolvedTemplate: ResolvedTemplate,
    variableMappings: Record<string, { type: 'dynamic' | 'fixed'; value: string }>,
    campaign: typeof campaigns.$inferSelect
): Promise<CampaignMessageResult> {
    try {
        const bodyVariables = resolvedTemplate.bodyText.match(/\{\{(\d+)\}\}/g) || [];

        const bodyParams = bodyVariables.map(placeholder => {
            const varKey = placeholder.replace(/\{|\}/g, '');
            const mapping = variableMappings[varKey];
            let text = `[variável ${varKey} não mapeada]`;

            if (mapping) {
                if (mapping.type === 'fixed') {
                    text = mapping.value;
                } else if (mapping.type === 'dynamic') {
                    const dynamicValue = contact[mapping.value as keyof typeof contact];
                    if (dynamicValue !== null && dynamicValue !== undefined) {
                        text = String(dynamicValue);
                    } else {
                        text = `[dado ausente]`;
                    }
                }
            }
            return { type: 'text', text };
        });

        const components: Record<string, unknown>[] = [];

        if (resolvedTemplate.hasMedia) {
            const assetIdToUse = campaign.mediaAssetId || resolvedTemplate.mediaAssetId;
            const headerType = resolvedTemplate.headerType!.toLowerCase() as 'image' | 'video' | 'document';
            const mediaObject: { id?: string; link?: string; filename?: string } = {};

            if (assetIdToUse) {
                if (!connection.wabaId) throw new Error(`Conexão ${connection.config_name} não possui WABA ID configurado.`);
                const { handle, asset } = await getMediaData(assetIdToUse, connection.id, connection.wabaId, campaign.companyId);
                mediaObject.id = handle;
                if (headerType === 'document' && asset.name) {
                    mediaObject.filename = asset.name;
                }
            } else if ((resolvedTemplate as any).temporaryAssetHandle) {
                mediaObject.id = (resolvedTemplate as any).temporaryAssetHandle;
            } else if (resolvedTemplate.mediaLink) {
                 mediaObject.link = resolvedTemplate.mediaLink;
            } else {
                 throw new Error(`A campanha usa o template ${resolvedTemplate.name} com mídia, mas não foi possível recuperar o arquivo de mídia original.`);
            }
            
            components.push({ type: 'header', parameters: [{ type: headerType, [headerType]: mediaObject }] });
        }

        if (bodyParams.length > 0) {
            components.push({ type: 'body', parameters: bodyParams });
        }

        // Envolve com retry logic para erros transientes (5xx, timeout, network)
        const response = await withRetry(async () => {
            return await sendWhatsappTemplateMessage({
                connection,
                to: contact.phone,
                templateName: resolvedTemplate.name,
                languageCode: resolvedTemplate.language,
                components,
            });
        });

        return {
            success: true,
            contactId: contact.id,
            providerMessageId: (response as unknown as MetaApiMessageResponse).messages?.[0]?.id || null,
        };

    } catch (error) {
        let errorMessage = (error as Error).message;
        
        // Intercepta erro 403 de mídia expirada da Meta (código 131053)
        if (errorMessage.includes('131053') && errorMessage.includes('403')) {
            errorMessage = "❌ A imagem/mídia original do template expirou na Meta (Erro 403). Você PRECISA recriar a campanha e anexar o arquivo manualmente no passo 'Mídia da Mensagem' para conseguir enviar.";
        }

        return {
            success: false,
            contactId: contact.id,
            error: errorMessage,
        };
    }
}

// Wrapper unificado: Detecta tipo de conexão e delega para sub-função apropriada
async function sendCampaignMessage(
    connection: typeof connections.$inferSelect,
    contact: typeof contacts.$inferSelect,
    resolvedTemplate: ResolvedTemplate,
    variableMappings: Record<string, { type: 'dynamic' | 'fixed'; value: string }>,
    campaign: typeof campaigns.$inferSelect
): Promise<CampaignMessageResult> {
    const isEvolution = ['baileys', 'evolution'].includes(connection.connectionType || '');

    if (isEvolution) {
        return sendViaEvolution(connection.id, contact, resolvedTemplate, variableMappings, campaign.companyId);
    } else {
        return sendViaMetaApi(connection, contact, resolvedTemplate, variableMappings, campaign);
    }
}

async function getMediaData(assetId: string, connectionId: string, wabaId: string, companyId: string): Promise<{ handle: string; asset: MediaAssetType }> {
    // Validar que o asset pertence à empresa
    const asset = await ensureTenantAccess(assetId, mediaAssets, companyId);
    if (!asset) {
        throw new Error(`Media Asset com ID ${assetId} não encontrado ou não pertence à empresa.`);
    }

    const existingHandles = ((asset as any).metaHandles || []) as MetaHandle[];
    const existingHandle = existingHandles.find(h => h.wabaId === wabaId);
    if (existingHandle) {
        return { handle: existingHandle.handle, asset: asset as MediaAssetType };
    }

    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:9002' : 'https://masteria.app');
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }
    if (!baseUrl) {
        throw new Error("A variável de ambiente NEXT_PUBLIC_BASE_URL não está configurada.");
    }

    const handleResponse = await fetch(`${baseUrl}/api/v1/media/${assetId}/handle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
        signal: AbortSignal.timeout(15000), // Timeout de 15s
    });

    const handleData = await handleResponse.json() as { error?: string, handle?: string };
    if (!handleResponse.ok || !handleData.handle) {
        throw new Error(handleData.error || 'Falha ao obter o media handle da Meta.');
    }
    return { handle: handleData.handle, asset: asset as MediaAssetType };
}


export async function sendWhatsappCampaign(campaign: typeof campaigns.$inferSelect): Promise<void> {
    // 1. Marcar a campanha como 'SENDING'
    await db.update(campaigns).set({ status: 'SENDING' }).where(eq(campaigns.id, campaign.id));

    try {
        if (!campaign.companyId) throw new Error(`Campanha ${campaign.id} não tem companyId.`);
        if (!campaign.connectionId) throw new Error(`Campanha ${campaign.id} não tem connectionId.`);

        // Validação dual-path: precisa de template OU mensagem direta
        if (!campaign.templateId && !campaign.message) {
            throw new Error(`Campanha ${campaign.id} deve ter templateId ou message definido.`);
        }

        const isRetryMode = campaign.retryContactIds && campaign.retryContactIds.length > 0;

        if (!isRetryMode && (!campaign.contactListIds || campaign.contactListIds.length === 0)) {
            if (process.env.NODE_ENV !== 'production') console.debug(`Campanha ${campaign.id} concluída: sem listas de contatos.`);
            await db.update(campaigns).set({ status: 'COMPLETED', completedAt: new Date() }).where(and(
                eq(campaigns.id, campaign.id),
                eq(campaigns.companyId, campaign.companyId)
            ));
            return;
        }

        // Buscar conexão primeiro para detectar tipo (validando tenant)
        const [connection] = await db.select().from(connections).where(and(
            eq(connections.id, campaign.connectionId),
            eq(connections.companyId, campaign.companyId)
        )).limit(1);

        if (!connection) throw new Error(`Conexão ID ${campaign.connectionId} não encontrada.`);

        const isEvolution = ['baileys', 'evolution'].includes(connection.connectionType || '');

        let resolvedTemplate: ResolvedTemplate;

        // Path A: Campanha baseada em template (Meta API ou Baileys legado)
        if (campaign.templateId) {
            // Tenta buscar o template na tabela templates (legado) e message_templates (novo)
            // Validando que o template pertence à empresa
            let template = (await db.select().from(templates).where(and(
                eq(templates.id, campaign.templateId),
                eq(templates.companyId, campaign.companyId)
            )))[0];
            if (!template) {
                // Tenta buscar na tabela message_templates (validando tenant)
                template = (await db.select().from(messageTemplates).where(and(
                    eq(messageTemplates.id, campaign.templateId),
                    eq(messageTemplates.companyId, campaign.companyId)
                )))[0] as any;
            }
            if (!template) throw new Error(`Template ID ${campaign.templateId} não encontrado ou não pertence à empresa.`);

            resolvedTemplate = resolveTemplate(template);

            // Valida mídia para Meta API
            if (!isEvolution && resolvedTemplate.hasMedia) {
                const hasMediaSource = campaign.mediaAssetId || resolvedTemplate.mediaAssetId || resolvedTemplate.mediaLink;
                if (!hasMediaSource) {
                    throw new Error(`Campanha ${campaign.id} exige um anexo de mídia, mas o template original não possui mídia salva e nenhuma foi fornecida.`);
                }
                
                // FALLBACK LEGADO: Se não temos mediaAssetId salvos, mas temos um mediaLink da CDN do WhatsApp,
                // a Meta bloqueia envios via link. Precisamos baixar e fazer upload na hora para a Resumable API.
                const needsUpload = !campaign.mediaAssetId && !resolvedTemplate.mediaAssetId && 
                                    resolvedTemplate.mediaLink && resolvedTemplate.mediaLink.includes('whatsapp.net');
                
                if (needsUpload) {
                    try {
                        if (!connection.wabaId) throw new Error("Conexão sem WABA ID configurado");
                        const accessToken = decrypt(connection.accessToken!);
                        
                        const mediaRes = await fetch(resolvedTemplate.mediaLink!);
                        if (!mediaRes.ok) throw new Error("Falha HTTP " + mediaRes.status);
                        
                        const arrayBuffer = await mediaRes.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const mimeType = mediaRes.headers.get('content-type') || 'application/octet-stream';
                        
                        if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] Fazendo upload de mídia legado para a Resumable API...`);
                        
                        const handle = await uploadMediaToMeta(
                            connection.phoneNumberId!, // Meta API usa phoneNumberId para uploadMediaToMeta
                            accessToken,
                            buffer,
                            mimeType,
                            'template_media_legado'
                        );
                        
                        // Injetamos o mediaAssetId temporário para não usar o link
                        (resolvedTemplate as any).temporaryAssetHandle = handle;
                    } catch (uploadErr) {
                        console.error(`[Campanha WhatsApp ${campaign.id}] Falha ao fazer upload de mídia legado:`, uploadErr);
                        // Continua, mas o envio pode falhar com 403 depois se tentar usar o link direto
                    }
                }
            }
        }
        // Path B: Campanha de mensagem direta (Baileys sem template)
        else {
            resolvedTemplate = {
                name: 'direct_message',
                language: 'und',
                bodyText: campaign.message!,
                headerType: null,
                hasMedia: false,
            };
        }

        // OTIMIZAÇÃO DE MEMÓRIA: Buscar apenas os IDs primeiro para evitar carregar milhares de objetos pesados
        let allContactIds: string[] = [];

        if (isRetryMode) {
            if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] Modo de reenvio: processando ${campaign.retryContactIds!.length} contatos que falharam`);
            allContactIds = campaign.retryContactIds!;
        } else {
            const includedContactIds = new Set<string>();
            const excludedContactIds = new Set<string>();

            // 1. INCLUSIONS
            // 1.1 Lists
            if (campaign.contactListIds && campaign.contactListIds.length > 0) {
                const listRows = await db
                    .select({ id: contactsToContactLists.contactId })
                    .from(contactsToContactLists)
                    .where(inArray(contactsToContactLists.listId, campaign.contactListIds));
                for (const row of listRows) includedContactIds.add(row.id);
            }
            
            // 1.2 Tags
            if (campaign.tagIds && campaign.tagIds.length > 0) {
                const tagRows = await db
                    .select({ id: contactsToTags.contactId })
                    .from(contactsToTags)
                    .where(inArray(contactsToTags.tagId, campaign.tagIds));
                for (const row of tagRows) includedContactIds.add(row.id);
            }
            
            // 1.3 Funnels / Stages
            if (campaign.funnelIds && campaign.funnelIds.length > 0) {
                const funnelRows = await db
                    .select({ id: kanbanLeads.contactId })
                    .from(kanbanLeads)
                    .where(inArray(kanbanLeads.boardId, campaign.funnelIds));
                for (const row of funnelRows) {
                    if (row.id) includedContactIds.add(row.id);
                }
            }
            if (campaign.funnelStageIds && campaign.funnelStageIds.length > 0) {
                const stageRows = await db
                    .select({ id: kanbanLeads.contactId })
                    .from(kanbanLeads)
                    .where(inArray(kanbanLeads.stageId, campaign.funnelStageIds));
                for (const row of stageRows) {
                    if (row.id) includedContactIds.add(row.id);
                }
            }

            // 2. EXCLUSIONS
            // 2.1 Exclude Lists
            if (campaign.excludeListIds && campaign.excludeListIds.length > 0) {
                const excludeListRows = await db
                    .select({ id: contactsToContactLists.contactId })
                    .from(contactsToContactLists)
                    .where(inArray(contactsToContactLists.listId, campaign.excludeListIds));
                for (const row of excludeListRows) excludedContactIds.add(row.id);
            }
            
            // 2.2 Exclude Tags
            if (campaign.excludeTagIds && campaign.excludeTagIds.length > 0) {
                const excludeTagRows = await db
                    .select({ id: contactsToTags.contactId })
                    .from(contactsToTags)
                    .where(inArray(contactsToTags.tagId, campaign.excludeTagIds));
                for (const row of excludeTagRows) excludedContactIds.add(row.id);
            }

            // 3. FINAL RESOLUTION
            for (const id of excludedContactIds) {
                includedContactIds.delete(id);
            }
            allContactIds = Array.from(includedContactIds);
        }

        // DEDUPLICAÇÃO DE IDs: Excluir contatos que já receberam mensagem nesta campanha
        const alreadySentReports = await db
            .select({ contactId: whatsappDeliveryReports.contactId })
            .from(whatsappDeliveryReports)
            .where(eq(whatsappDeliveryReports.campaignId, campaign.id));

        const alreadySentContactIds = new Set(alreadySentReports.map(r => r.contactId));

        let pendingContactIds = allContactIds.filter(id => !alreadySentContactIds.has(id));
        const totalPending = pendingContactIds.length;

        if (totalPending > 0 && alreadySentContactIds.size > 0) {
            if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] ✅ Deduplicação: ${alreadySentContactIds.size} contatos já enviados, ${totalPending} pendentes.`);
        }

        // Suporte a offset e limite de contatos via variableMappings
        const variableMappingsRaw = campaign.variableMappings as Record<string, any> || {};
        const contactOffset = variableMappingsRaw._contactOffset as number | undefined;
        const maxContacts = variableMappingsRaw._maxContacts as number | undefined;

        // Aplicar offset e limite nos IDs (muito mais eficiente)
        if (contactOffset && contactOffset > 0) {
            if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] Pulando os primeiros ${contactOffset} contatos (offset)`);
            pendingContactIds = pendingContactIds.slice(contactOffset);
        }

        if (maxContacts && pendingContactIds.length > maxContacts) {
            if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] Limitando para ${maxContacts} contatos (limite)`);
            pendingContactIds = pendingContactIds.slice(0, maxContacts);
        }

        if (pendingContactIds.length === 0) {
            if (process.env.NODE_ENV !== 'production') console.debug(`Campanha ${campaign.id} concluída: sem contatos nas listas.`);
            await db.update(campaigns).set({ status: 'COMPLETED', completedAt: new Date() }).where(eq(campaigns.id, campaign.id));
            return;
        }

        const batchSize = campaign.batchSize || 100; // Padrão de 100
        const _batchDelaySeconds = campaign.batchDelaySeconds || 5; // Padrão de 5 segundos

        // Suporte a delay aleatório individual para Baileys via variableMappings
        const variableMappings = campaign.variableMappings as Record<string, any> || {};
        const disableBotOnSend = Boolean(variableMappings._disableBot);

        // DELAY OBRIGATÓRIO PARA BAILEYS - Proteção anti-bloqueio WhatsApp
        const MIN_SAFE_DELAY = 5; // Mínimo absoluto de segurança
        const DEFAULT_MIN_DELAY = 11;
        const DEFAULT_MAX_DELAY = 33;

        const configuredMinDelay = variableMappings._minDelaySeconds as number | undefined;
        const configuredMaxDelay = variableMappings._maxDelaySeconds as number | undefined;

        let minDelaySeconds: number;
        let maxDelaySeconds: number;

        if (isEvolution) {
            // Se delays configurados, usa eles (respeitando mínimo de segurança)
            if (configuredMinDelay !== undefined && configuredMaxDelay !== undefined) {
                minDelaySeconds = Math.max(configuredMinDelay, MIN_SAFE_DELAY);
                maxDelaySeconds = Math.max(configuredMaxDelay, minDelaySeconds);
                if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] ✅ Delay configurado: ${minDelaySeconds}-${maxDelaySeconds}s`);
            } else {
                // Usa defaults se não configurado
                minDelaySeconds = DEFAULT_MIN_DELAY;
                maxDelaySeconds = DEFAULT_MAX_DELAY;
                if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] ✅ Delay padrão: ${DEFAULT_MIN_DELAY}-${DEFAULT_MAX_DELAY}s`);
            }
        } else {
            // Meta API: usar delay configurado ou default
            minDelaySeconds = configuredMinDelay ?? DEFAULT_MIN_DELAY;
            maxDelaySeconds = configuredMaxDelay ?? DEFAULT_MAX_DELAY;
        }

        // Evolution SEMPRE usa delay (obrigatório), Meta API pode usar paralelo
        const useRandomDelay = isEvolution || (minDelaySeconds !== undefined && maxDelaySeconds !== undefined);

        if (isEvolution) {
            if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] ⚠️ DELAY OBRIGATÓRIO EVOLUTION ATIVO: ${minDelaySeconds}-${maxDelaySeconds}s entre mensagens (proteção anti-bloqueio)`);
        } else if (useRandomDelay) {
            if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] Modo com delay aleatório: ${minDelaySeconds}-${maxDelaySeconds}s entre mensagens`);
        }

        // PROCESSAMENTO EM LOTES COM CARREGAMENTO SOB DEMANDA (Memory-Safe)
        const totalBatches = Math.ceil(pendingContactIds.length / batchSize);

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
            const startIdx = batchIdx * batchSize;
            const subBatchIds = pendingContactIds.slice(startIdx, startIdx + batchSize);

            // Carrega os dados FULL dos contatos apenas para este lote
            // SECURITY: Validar que todos os contatos pertencem à empresa da campanha
            const batch = await db
                .select()
                .from(contacts)
                .where(and(
                    inArray(contacts.id, subBatchIds),
                    eq(contacts.companyId, campaign.companyId)
                ));

            // Verificar se a campanha foi pausada antes de processar o lote
            // SECURITY: Validar tenant ao verificar status da campanha
            const [currentCampaign] = await db.select({ status: campaigns.status }).from(campaigns).where(and(
                eq(campaigns.id, campaign.id),
                eq(campaigns.companyId, campaign.companyId)
            ));
            if (currentCampaign?.status === 'PAUSED') {
                if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] Campanha pausada pelo usuário. Interrompendo envio.`);
                return;
            }

            if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] Processando lote ${batchIdx + 1}/${totalBatches} com ${batch.length} contatos carregados.`);

            let results: PromiseSettledResult<CampaignMessageResult>[];

            // Se for Baileys com delay aleatório, processa sequencialmente E SALVA IMEDIATAMENTE
            if (useRandomDelay) {
                for (const [contactIndex, contact] of batch.entries()) {
                    // Verificar pausa durante o processamento sequencial
                    // SECURITY: Validar tenant ao verificar status da campanha
                    if (contactIndex > 0 && contactIndex % 10 === 0) {
                        const [checkCampaign] = await db.select({ status: campaigns.status }).from(campaigns).where(and(
                            eq(campaigns.id, campaign.id),
                            eq(campaigns.companyId, campaign.companyId)
                        ));
                        if (checkCampaign?.status === 'PAUSED') {
                            if (DEBUG) logger.debug(`[Campanha WhatsApp ${campaign.id}] Campanha pausada durante processamento. Interrompendo.`);
                            return;
                        }
                    }

                    let result: CampaignMessageResult;
                    try {
                        result = await sendCampaignMessage(connection, contact, resolvedTemplate, variableMappings, campaign);
                    } catch (error) {
                        result = { success: false, contactId: contact.id, error: (error as Error)?.message || 'Erro desconhecido' };
                    }

                    // SALVAR DELIVERY REPORT IMEDIATAMENTE
                    try {
                        await db.insert(whatsappDeliveryReports).values({
                            campaignId: campaign.id,
                            contactId: contact.id,
                            companyId: campaign.companyId,
                            connectionId: campaign.connectionId!,
                            status: result.success ? 'SENT' : 'FAILED',
                            providerMessageId: result.providerMessageId || null,
                            failureReason: result.success ? null : (result.error || 'Erro desconhecido'),
                        } as any);

                        if (result.success) {
                            const isTemplate = resolvedTemplate.name !== 'direct_message';
                            const messageContent = isTemplate
                                ? `Template: ${resolvedTemplate.name}`
                                : resolvedTemplate.bodyText;

                            await createCampaignConversationAndMessage(
                                campaign.companyId!,
                                contact.id,
                                campaign.connectionId!,
                                result.providerMessageId || null,
                                messageContent,
                                campaign.id,
                                disableBotOnSend,
                                isTemplate
                            );
                        }
                    } catch (dbError) {
                        console.error(`[Campaign-Baileys] ❌ Erro ao salvar report/mensagem:`, dbError);
                    }

                    // Delay aleatório entre mensagens
                    if (contactIndex < batch.length - 1 || batchIdx < totalBatches - 1) {
                        const randomDelay = Math.floor(Math.random() * (maxDelaySeconds! - minDelaySeconds! + 1)) + minDelaySeconds!;
                        if (DEBUG && contactIndex % 5 === 0) logger.debug(`[Campanha WhatsApp ${campaign.id}] Aguardando ${randomDelay}s...`);
                        await sleep(randomDelay * 1000);
                    }
                }
            } else {
                // Modo paralelo (Meta API)
                const sendPromises = batch.map(contact =>
                    sendCampaignMessage(connection, contact, resolvedTemplate, variableMappings, campaign)
                );
                results = await Promise.allSettled(sendPromises);

                // Mapeia e salva em lote (mais eficiente para Meta)
                const deliveryReports = results.map((res, i) => {
                    const contact = batch[i];
                    if (!contact) return null;

                    if (res.status === 'fulfilled') {
                        const val = res.value;
                        return {
                            campaignId: campaign.id,
                            contactId: contact.id,
                            companyId: campaign.companyId,
                            connectionId: campaign.connectionId!,
                            status: val.success ? 'SENT' : 'FAILED',
                            providerMessageId: val.providerMessageId || null,
                            failureReason: val.success ? null : (val.error || 'Erro desconhecido'),
                        };
                    } else {
                        return {
                            campaignId: campaign.id,
                            contactId: contact.id,
                            companyId: campaign.companyId,
                            connectionId: campaign.connectionId!,
                            status: 'FAILED',
                            failureReason: (res.reason as Error)?.message || 'Erro desconhecido',
                        };
                    }
                }).filter((r): r is NonNullable<typeof r> => r !== null);

                if (deliveryReports.length > 0) {
                    await db.insert(whatsappDeliveryReports).values(deliveryReports as any);

                    // Criar conversas para os enviados
                    for (let i = 0; i < deliveryReports.length; i++) {
                        const report = deliveryReports[i];
                        if (report && report.status === 'SENT') {
                            const isTemplate = resolvedTemplate.name !== 'direct_message';
                            const messageContent = isTemplate ? `Template: ${resolvedTemplate.name}` : resolvedTemplate.bodyText;
                            await createCampaignConversationAndMessage(
                                campaign.companyId!,
                                report.contactId,
                                campaign.connectionId!,
                                report.providerMessageId || null,
                                messageContent,
                                campaign.id,
                                disableBotOnSend,
                                isTemplate
                            );
                        }
                    }
                }
            }
        }

        // Marcar como concluída
        // SECURITY: Validar tenant ao atualizar campanha
        await db.update(campaigns)
            .set({
                status: 'COMPLETED',
                sentAt: new Date(),
                completedAt: new Date()
            })
            .where(and(
                eq(campaigns.id, campaign.id),
                eq(campaigns.companyId, campaign.companyId)
            ));

        // Estatísticas para notificação
        // SECURITY: Validar tenant ao buscar relatórios de entrega
        const reportRows = await db
            .select({ count: sql<number>`count(*)` })
            .from(whatsappDeliveryReports)
            .where(and(
                eq(whatsappDeliveryReports.campaignId, campaign.id),
                eq(whatsappDeliveryReports.companyId, campaign.companyId),
                eq(whatsappDeliveryReports.status, 'SENT')
            ));

        const deliveredCount = Number(reportRows[0]?.count || 0);
        const totalSentCount = pendingContactIds.length;
        const deliveryRate = totalSentCount > 0 ? (deliveredCount / totalSentCount * 100) : 0;

        NotificationService.safeNotify(
            NotificationService.notifyCampaignSent.bind(NotificationService),
            'CampaignSender',
            campaign.companyId!,
            {
                name: campaign.name || 'Campanha sem nome',
                channel: 'whatsapp',
                sent: totalSentCount,
                delivered: deliveredCount,
                rate: deliveryRate,
            }
        );

        // Notificações adicionais
        try {
            await UserNotificationsService.notifyCampaignCompleted(
                campaign.companyId!,
                campaign.id,
                campaign.name || 'Campanha sem nome',
                totalSentCount
            );
        } catch (e) { /* ignore */ }

        try {
            await webhookDispatcher.dispatch(campaign.companyId!, 'campaign_sent', {
                campaignId: campaign.id,
                campaignName: campaign.name || 'Campanha sem nome',
                totalSent: totalSentCount,
                totalDelivered: deliveredCount,
            });
        } catch (e) { /* ignore */ }

    } catch (error) {
        console.error(`Falha crítica ao enviar campanha ${campaign.id}:`, error);
        try {
            require('fs').writeFileSync(`CRITICAL_ERROR_${campaign.id}.txt`, (error as Error).stack || String(error));
        } catch (fsErr) { }

        // SECURITY: Validar tenant ao atualizar status de falha
        await db.update(campaigns).set({ status: 'FAILED' }).where(and(
            eq(campaigns.id, campaign.id),
            eq(campaigns.companyId, campaign.companyId)
        ));
        throw error;
    }
}


// ==========================================
// SMS CAMPAIGN SENDER
// ==========================================

const VALID_SUCCESS_STATUSES = new Set(['SENT', 'SUCCESS', 'DELIVERED', 'ACCEPTED', 'OK']);
const VALID_PENDING_STATUSES = new Set(['PENDING', 'QUEUED', 'SCHEDULED', 'PROCESSING']);

function normalizeDeliveryStatus(rawStatus: string | undefined | null): 'SENT' | 'FAILED' | 'PENDING' {
    // Se não há status explícito, é FAILED (não assumir sucesso sem confirmação)
    if (!rawStatus) {
        return 'FAILED';
    }
    const upper = rawStatus.toUpperCase();
    if (VALID_SUCCESS_STATUSES.has(upper)) {
        return 'SENT';
    }
    if (VALID_PENDING_STATUSES.has(upper)) {
        return 'PENDING';
    }
    // Status desconhecido = FAILED
    return 'FAILED';
}

async function logSmsDelivery(campaign: typeof campaigns.$inferSelect, gateway: typeof smsGateways.$inferSelect, contacts: { id: string, phone: string }[], providerResponse: { success: boolean, mensagens?: { Codigo_cliente: string, id_mensagem: string, status?: string, error?: string }[], error?: string } & Record<string, unknown>): Promise<void> {
    const logs = contacts.map(contact => {
        const msgInfo = providerResponse.mensagens?.find(m => m.Codigo_cliente === contact.id);

        // Se o contato não está no retorno do provider, é FAILED (não recebeu confirmação)
        if (!msgInfo) {
            return {
                campaignId: campaign.id,
                contactId: contact.id,
                smsGatewayId: gateway.id,
                status: 'FAILED' as const,
                failureReason: providerResponse.error || 'Contato não encontrado na resposta do provider',
                providerMessageId: null,
            };
        }

        const status = normalizeDeliveryStatus(msgInfo.status);
        const isFailed = status === 'FAILED';

        let failureReason: string | null = null;
        if (isFailed) {
            failureReason = msgInfo.error || providerResponse.error || 'Status de envio não confirmado';
        }

        return {
            campaignId: campaign.id,
            contactId: contact.id,
            smsGatewayId: gateway.id,
            status,
            failureReason,
            providerMessageId: msgInfo.id_mensagem || null,
        };
    });

    if (logs.length > 0) {
        await db.insert(smsDeliveryReports).values(logs);
    }
}

async function sendSmsBatch(gateway: typeof smsGateways.$inferSelect, campaign: typeof campaigns.$inferSelect, batch: { id: string, phone: string }[]): Promise<Record<string, unknown>> {
    const provider = gateway.provider as 'witi' | 'seven' | 'mkom';
    const credentials = gateway.credentials as Record<string, string> | null;

    // Normalize all phone numbers for Brazilian SMS format
    const normalizedBatch = batch.map(contact => {
        const normalized = normalizeBrazilianSMS(contact.phone);
        if (normalized.ninthDigitAdded) {
            logger.debug(`[SMS] 📱 Nono dígito adicionado: ${normalized.original} → ${normalized.number}`);
        }
        if (!normalized.valid) {
            console.warn(`[SMS] ⚠️ Número inválido: ${contact.phone} - ${normalized.error}`);
        }
        return {
            ...contact,
            originalPhone: contact.phone,
            phone: normalized.number,
            phoneValid: normalized.valid,
            phoneError: normalized.error
        };
    });

    // Filter valid numbers only
    const validBatch = normalizedBatch.filter(c => c.phoneValid);
    const invalidCount = normalizedBatch.length - validBatch.length;

    if (invalidCount > 0) {
        console.warn(`[SMS] ⚠️ ${invalidCount} número(s) inválido(s) serão ignorados`);
    }

    if (validBatch.length === 0) {
        throw new Error('Nenhum número válido para enviar SMS');
    }

    switch (provider) {
        case 'witi': {
            // Check circuit breaker before making request
            if (CircuitBreaker.isOpen('sms_witi')) {
                throw new Error('Witi SMS gateway temporariamente indisponível devido a falhas recentes. Tente novamente em alguns minutos.');
            }

            if (!credentials || !credentials.token) {
                throw new Error("Credenciais 'token' ausentes para o gateway Witi.");
            }
            const apiKey = decrypt(credentials.token);
            if (!apiKey) throw new Error("Falha ao desencriptar o API Key da Witi.");

            const messages = validBatch.map(contact => ({ numero: contact.phone, mensagem: campaign.message!, Codigo_cliente: contact.id }));
            const payload = { tipo_envio: "common", referencia: campaign.name, mensagens: messages };
            const url = `https://sms.witi.me/sms/send.aspx?chave=${apiKey}`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(15000) // Timeout de 15s
                });
                const responseText = await response.text();

                if (!response.ok) {
                    CircuitBreaker.recordFailure('sms_witi');
                    throw new Error(`Witi API Error: ${responseText}`);
                }

                CircuitBreaker.recordSuccess('sms_witi');

                try {
                    const data = JSON.parse(responseText) as { status: string };
                    return { success: data.status !== 'ERRO', ...data };
                } catch (e) {
                    return { success: true, details: responseText };
                }
            } catch (error) {
                CircuitBreaker.recordFailure('sms_witi');
                throw error;
            }
        }

        case 'seven': {
            // Check circuit breaker before making request
            if (CircuitBreaker.isOpen('sms_seven')) {
                throw new Error('Seven.io SMS gateway temporariamente indisponível devido a falhas recentes. Tente novamente em alguns minutos.');
            }

            if (!credentials || !credentials.apiKey) {
                throw new Error("Credenciais 'apiKey' ausentes para o gateway seven.io.");
            }
            const sevenApiKey = decrypt(credentials.apiKey);
            if (!sevenApiKey) throw new Error("Falha ao desencriptar a API Key da seven.io.");

            const toNumbers = validBatch.map(c => c.phone).join(',');
            const sevenPayload = { to: toNumbers, text: campaign.message!, from: "ZAPMaster" };
            const sevenUrl = 'https://gateway.seven.io/api/sms';

            try {
                const sevenResponse = await fetch(sevenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Api-Key': sevenApiKey },
                    body: JSON.stringify(sevenPayload),
                    signal: AbortSignal.timeout(15000) // Timeout de 15s
                });
                const sevenResponseText = await sevenResponse.text();

                if (!sevenResponse.ok) {
                    CircuitBreaker.recordFailure('sms_seven');
                    throw new Error(`Seven.io API Error: Status ${sevenResponse.status} - ${sevenResponseText}`);
                }

                CircuitBreaker.recordSuccess('sms_seven');

                try {
                    return { success: true, ...JSON.parse(sevenResponseText) } as Record<string, unknown>;
                } catch (e) {
                    return { success: true, details: sevenResponseText };
                }
            } catch (error) {
                CircuitBreaker.recordFailure('sms_seven');
                throw error;
            }
        }

        case 'mkom': {
            // Check circuit breaker before making request
            if (CircuitBreaker.isOpen('sms_mkom')) {
                throw new Error('MKOM SMS gateway temporariamente indisponível devido a falhas recentes. Tente novamente em alguns minutos.');
            }

            if (!credentials || !credentials.token) {
                throw new Error("Credenciais 'token' ausentes para o gateway MKOM.");
            }
            const mkomToken = decrypt(credentials.token);
            if (!mkomToken) throw new Error("Falha ao desencriptar o Token JWT da MKOM.");

            // Validação fail-fast: cost_centre_id é obrigatório para MKOM
            const rawCostCentreId = credentials.cost_centre_id;
            if (!rawCostCentreId || String(rawCostCentreId).trim() === '' || String(rawCostCentreId) === '0') {
                throw new Error("Gateway MKOM requer cost_centre_id configurado. Por favor, edite o gateway nas configurações.");
            }
            const costCentreId = parseInt(rawCostCentreId);

            // MKOM API - Envio de SMS via MKSMS
            // Documentação oficial: https://sms.mkmservice.com/sms/api/transmission/v1
            // Números devem estar no formato E.164 com DDI (ex: 5511999999999)
            const campaignPrefix = campaign.id.substring(0, 8);
            const mkomMessages = validBatch.map(contact => {
                // Garantir formato E.164: não duplicar DDI se já existir
                let msisdn = contact.phone.replace(/\D/g, ''); // Remove não-numéricos
                if (!msisdn.startsWith('55')) {
                    msisdn = `55${msisdn}`;
                }
                return {
                    msisdn,
                    message: campaign.message!,
                    schedule: null, // Envio imediato
                    reference: `${campaignPrefix}_${contact.id}` // ID único: campaign + contact
                };
            });

            logger.debug(`[SMS MKOM] Enviando ${mkomMessages.length} mensagens via MKSMS API`);
            logger.debug(`[SMS MKOM] 📤 Payload Preview:`, JSON.stringify(mkomMessages.slice(0, 2).map(m => ({
                msisdn: m.msisdn,
                message: m.message.substring(0, 30) + '...',
                reference: m.reference
            })), null, 2));

            // Payload conforme documentação MKOM MKSMS
            const mkomPayload = {
                mailing: {
                    identifier: `MasterIA-Campaign-${campaign.id}`,
                    cost_centre_id: costCentreId
                },
                messages: mkomMessages
            };

            // Endpoint oficial MKOM MKSMS
            const mkomUrl = 'https://sms.mkmservice.com/sms/api/transmission/v1';

            try {
                logger.debug(`[SMS MKOM] 🌐 Chamando API: POST ${mkomUrl}`);
                const startTime = Date.now();

                const mkomResponse = await fetch(mkomUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${mkomToken}`
                    },
                    body: JSON.stringify(mkomPayload),
                    signal: AbortSignal.timeout(30000) // Timeout de 30s para lotes maiores
                });
                const mkomResponseText = await mkomResponse.text();
                const elapsed = Date.now() - startTime;

                logger.debug(`[SMS MKOM] 📥 Response Status: ${mkomResponse.status} (${elapsed}ms)`);
                logger.debug(`[SMS MKOM] 📥 Response Body:`, mkomResponseText);

                if (!mkomResponse.ok) {
                    console.error(`[SMS MKOM] ❌ API Error: Status ${mkomResponse.status}`);
                    CircuitBreaker.recordFailure('sms_mkom');
                    throw new Error(`MKOM API Error: Status ${mkomResponse.status} - ${mkomResponseText}`);
                }

                CircuitBreaker.recordSuccess('sms_mkom');
                logger.debug(`[SMS MKOM] ✅ Envio bem-sucedido!`);

                try {
                    // Formato de resposta MKOM: { mailing: { id: "..." }, messages: [{ success: boolean, reference: "...", id?: "..." }] }
                    const mkomData = JSON.parse(mkomResponseText) as {
                        mailing?: { id: string };
                        messages?: Array<{ success?: boolean; reference?: string; id?: string; status?: string; error?: string }>;
                        error?: string;
                        status?: string;
                    };
                    logger.debug(`[SMS MKOM] 📊 Parsed Response:`, JSON.stringify(mkomData, null, 2));

                    // Verificar se houve erro global
                    if (mkomData.error || mkomData.status === 'ERROR' || mkomData.status === 'ERRO') {
                        const errorMsg = mkomData.error || 'Erro desconhecido da API MKOM';
                        console.error(`[SMS MKOM] ❌ Erro global da API: ${errorMsg}`);
                        CircuitBreaker.recordFailure('sms_mkom');
                        return { success: false, error: errorMsg, mensagens: [] };
                    }

                    // Validar estrutura mínima da resposta - MKOM deve retornar array messages
                    if (!mkomData.messages || !Array.isArray(mkomData.messages)) {
                        // Sem array de mensagens: tratar como falha (estrutura inesperada)
                        console.error(`[SMS MKOM] ❌ Resposta sem array 'messages' válido - estrutura inesperada`);
                        CircuitBreaker.recordFailure('sms_mkom');
                        return {
                            success: false,
                            error: 'Estrutura de resposta MKOM inválida: campo messages ausente',
                            mensagens: validBatch.map(c => ({
                                Codigo_cliente: c.id,
                                id_mensagem: '',
                                status: 'FAILED',
                                error: 'Resposta MKOM sem confirmação de entrega'
                            }))
                        };
                    }

                    // Validar se messages tem pelo menos um item
                    if (mkomData.messages.length === 0) {
                        console.error(`[SMS MKOM] ❌ Array 'messages' vazio na resposta`);
                        CircuitBreaker.recordFailure('sms_mkom');
                        return {
                            success: false,
                            error: 'MKOM retornou array de mensagens vazio',
                            mensagens: validBatch.map(c => ({
                                Codigo_cliente: c.id,
                                id_mensagem: '',
                                status: 'FAILED',
                                error: 'MKOM não confirmou entrega'
                            }))
                        };
                    }

                    // Criar mapa de referências enviadas para cross-check
                    const sentContactRefs = new Set(validBatch.map(c => `${campaignPrefix}_${c.id}`));

                    // Processar cada mensagem com validação rigorosa de tipos
                    let invalidMsgCount = 0;
                    const processedMessages: Array<{
                        reference: string;
                        success: boolean;
                        status: string;
                        id?: string;
                        error?: string;
                    }> = [];

                    for (const m of mkomData.messages) {
                        // Validar reference: string não vazia e existente nos contatos enviados
                        const reference = (typeof m.reference === 'string' && m.reference.trim()) ? m.reference.trim() : '';

                        if (!reference) {
                            console.warn(`[SMS MKOM] ⚠️ Mensagem sem reference válido - ignorando`);
                            invalidMsgCount++;
                            continue;
                        }

                        // Verificar se reference corresponde a um contato enviado
                        if (!sentContactRefs.has(reference)) {
                            console.warn(`[SMS MKOM] ⚠️ Reference '${reference}' não corresponde a nenhum contato enviado`);
                            invalidMsgCount++;
                            continue;
                        }

                        // Determinar sucesso: DEVE ter confirmação explícita
                        let isSuccess = false;
                        let statusStr = 'FAILED';

                        if (typeof m.success === 'boolean') {
                            isSuccess = m.success;
                            statusStr = m.success ? 'SENT' : 'FAILED';
                        } else if (m.status && typeof m.status === 'string') {
                            const statusUpper = m.status.toUpperCase();
                            if (VALID_SUCCESS_STATUSES.has(statusUpper)) {
                                isSuccess = true;
                                statusStr = 'SENT';
                            } else if (VALID_PENDING_STATUSES.has(statusUpper)) {
                                isSuccess = true;
                                statusStr = 'PENDING';
                            } else {
                                isSuccess = false;
                                statusStr = 'FAILED';
                                console.warn(`[SMS MKOM] ⚠️ Status desconhecido: ${m.status}`);
                            }
                        }

                        processedMessages.push({
                            reference,
                            success: isSuccess,
                            status: statusStr,
                            id: m.id,
                            error: m.error
                        });
                    }

                    // Se validação falhou para muitas mensagens, é problema grave na estrutura
                    if (invalidMsgCount > 0) {
                        console.warn(`[SMS MKOM] ⚠️ ${invalidMsgCount} mensagem(ns) com estrutura inválida ignoradas`);
                    }

                    // Verificar se todos os contatos receberam resposta
                    const respondedRefs = new Set(processedMessages.map(m => m.reference));
                    const missingContacts = validBatch.filter(c => !respondedRefs.has(`${campaignPrefix}_${c.id}`));

                    // Adicionar contatos sem resposta como FAILED
                    for (const missing of missingContacts) {
                        console.warn(`[SMS MKOM] ⚠️ Contato ${missing.id} não recebeu confirmação do provider`);
                        processedMessages.push({
                            reference: `${campaignPrefix}_${missing.id}`,
                            success: false,
                            status: 'FAILED',
                            error: 'Sem confirmação de entrega do provider'
                        });
                    }

                    const successCount = processedMessages.filter(m => m.success).length;
                    const failCount = processedMessages.filter(m => !m.success).length;
                    const hasMissingResponses = missingContacts.length > 0;

                    // Mapear resposta para formato compatível com logSmsDelivery
                    // Extrair contact_id da referência (formato: campaignPrefix_contactId)
                    const mensagens = processedMessages.map(m => ({
                        Codigo_cliente: m.reference.includes('_') ? m.reference.split('_')[1] : m.reference,
                        id_mensagem: m.id || mkomData.mailing?.id || '',
                        status: m.status,
                        error: m.error
                    }));

                    // Determinar sucesso global:
                    // - allSuccess: TODOS os contatos receberam confirmação de sucesso
                    // - partialSuccess: Alguns com sucesso, mas houve falhas ou contatos sem resposta
                    // - Contatos sem resposta do provider = FALHA (não sucesso parcial)
                    const allSuccess = failCount === 0 && successCount > 0 && !hasMissingResponses && successCount === validBatch.length;
                    const partialSuccess = successCount > 0 && (failCount > 0 || hasMissingResponses);

                    // Acionar circuit breaker quando:
                    // 1. Nenhum sucesso
                    // 2. Muitos contatos sem resposta (> 50%)
                    if (successCount === 0 && validBatch.length > 0) {
                        console.error(`[SMS MKOM] ❌ Nenhuma mensagem confirmada como enviada`);
                        CircuitBreaker.recordFailure('sms_mkom');
                    } else if (hasMissingResponses && missingContacts.length > validBatch.length * 0.5) {
                        console.error(`[SMS MKOM] ❌ Mais de 50% dos contatos sem resposta do provider`);
                        CircuitBreaker.recordFailure('sms_mkom');
                    }

                    if (failCount > 0 || hasMissingResponses) {
                        console.warn(`[SMS MKOM] ⚠️ ${failCount} mensagem(ns) falharam, ${successCount} enviadas. Contatos sem resposta: ${missingContacts.length}`);
                    }

                    // success = true APENAS se todos os contatos foram confirmados com sucesso
                    // success = false se houve qualquer falha ou contato sem resposta
                    const mailingId = mkomData.mailing?.id;
                    return {
                        success: allSuccess,
                        partialSuccess,
                        mailingId: typeof mailingId === 'string' ? mailingId : (mailingId ? String(mailingId) : undefined),
                        mensagens,
                        successCount,
                        failCount,
                        missingCount: missingContacts.length
                    };
                } catch (e) {
                    // JSON inválido: tratar como falha e acionar circuit breaker
                    console.error(`[SMS MKOM] ❌ Response não é JSON válido:`, mkomResponseText);
                    CircuitBreaker.recordFailure('sms_mkom');
                    return {
                        success: false,
                        error: 'Resposta inválida da API MKOM',
                        details: mkomResponseText,
                        mensagens: validBatch.map(c => ({
                            Codigo_cliente: c.id,
                            id_mensagem: '',
                            status: 'FAILED',
                            error: 'Resposta inválida da API'
                        }))
                    };
                }
            } catch (error) {
                console.error(`[SMS MKOM] ❌ Erro na requisição:`, (error as Error).message);
                CircuitBreaker.recordFailure('sms_mkom');
                throw error;
            }
        }

        default:
            throw new Error(`Provedor de SMS "${gateway.provider}" não suportado.`);
    }
}

export async function sendSmsCampaign(campaign: typeof campaigns.$inferSelect): Promise<void> {
    // GUARD: Verificar se já foi completada para evitar duplicações em caso de re-trigger ou restart
    if (campaign.sentAt || campaign.completedAt) {
        logger.debug(`[Campanha SMS ${campaign.id}] Já foi completada (sentAt: ${campaign.sentAt}, completedAt: ${campaign.completedAt}). Ignorando re-trigger.`);
        return;
    }

    // SECURITY: Validar tenant ao atualizar status
    await db.update(campaigns).set({ status: 'SENDING' }).where(and(
        eq(campaigns.id, campaign.id),
        eq(campaigns.companyId, campaign.companyId)
    ));

    try {
        if (!campaign.companyId) throw new Error(`Campaign ${campaign.id} is missing companyId.`);
        if (!campaign.message) throw new Error(`Campaign ${campaign.id} has no message content.`);

        const isRetryMode = campaign.retryContactIds && campaign.retryContactIds.length > 0;

        if (!isRetryMode && (!campaign.contactListIds || campaign.contactListIds.length === 0)) {
            // SECURITY: Validar tenant ao atualizar status
            await db.update(campaigns).set({ status: 'COMPLETED', completedAt: new Date() }).where(and(
                eq(campaigns.id, campaign.id),
                eq(campaigns.companyId, campaign.companyId)
            ));
            if (process.env.NODE_ENV !== 'production') console.debug(`Campanha ${campaign.id} concluída: sem listas de contatos.`);
            return;
        }
        if (!campaign.smsGatewayId) throw new Error(`Campaign ${campaign.id} is missing an assigned SMS Gateway.`);

        // Validar que o gateway pertence à empresa da campanha
        const [gateway] = await db.select().from(smsGateways).where(and(
            eq(smsGateways.id, campaign.smsGatewayId),
            eq(smsGateways.companyId, campaign.companyId)
        )).limit(1);

        if (!gateway) throw new Error(`Gateway ID ${campaign.smsGatewayId} not found for campaign ${campaign.id} or does not belong to company.`);

        let campaignContacts;

        if (isRetryMode) {
            logger.debug(`[Campanha SMS ${campaign.id}] Modo de reenvio: processando ${campaign.retryContactIds!.length} contatos que falharam`);
            // Validar que os contatos pertencem à empresa
            campaignContacts = await db.selectDistinct({ phone: contacts.phone, id: contacts.id })
                .from(contacts)
                .where(and(
                    inArray(contacts.id, campaign.retryContactIds!),
                    eq(contacts.companyId, campaign.companyId)
                ));
        } else {
            const contactIdsSubquery = db.select({ contactId: contactsToContactLists.contactId })
                .from(contactsToContactLists)
                .where(inArray(contactsToContactLists.listId, campaign.contactListIds!));
            // Validar que os contatos pertencem à empresa
            campaignContacts = await db.selectDistinct({ phone: contacts.phone, id: contacts.id })
                .from(contacts)
                .where(and(
                    inArray(contacts.id, contactIdsSubquery),
                    eq(contacts.companyId, campaign.companyId)
                ));
        }

        if (campaignContacts.length === 0) {
            // SECURITY: Validar tenant ao atualizar status
            await db.update(campaigns).set({ status: 'COMPLETED', completedAt: new Date() }).where(and(
                eq(campaigns.id, campaign.id),
                eq(campaigns.companyId, campaign.companyId)
            ));
            if (process.env.NODE_ENV !== 'production') console.debug(`Campanha ${campaign.id} concluída: sem contatos nas listas selecionadas.`);
            return;
        }

        // Usar índice de retomada para proteção contra duplicação
        const startIndex = campaign.smsNextContactIndex || 0;
        const remainingContacts = campaignContacts.slice(startIndex);

        if (remainingContacts.length === 0) {
            logger.debug(`[Campanha SMS ${campaign.id}] Todos os contatos já foram processados (startIndex: ${startIndex}, total: ${campaignContacts.length}). Marcando como completa.`);
            // SECURITY: Validar tenant ao atualizar status
            await db.update(campaigns).set({ status: 'COMPLETED', sentAt: new Date(), completedAt: new Date() }).where(and(
                eq(campaigns.id, campaign.id),
                eq(campaigns.companyId, campaign.companyId)
            ));
            return;
        }

        if (startIndex > 0) {
            logger.debug(`[Campanha SMS ${campaign.id}] 🔄 Retomando campanha do índice ${startIndex}. Total: ${campaignContacts.length}, Restantes: ${remainingContacts.length}`);
        }

        const batchSize = campaign.batchSize || 100;
        const batchDelaySeconds = campaign.batchDelaySeconds || 5;
        const contactBatches = chunkArray(remainingContacts, batchSize);

        // Variável local para tracking do mailing ID (será preenchido após primeiro lote)
        let savedMailingId = campaign.smsProviderMailingId;

        for (const [batchIndex, batch] of contactBatches.entries()) {
            // Calcular o índice absoluto baseado no startIndex
            const absoluteIndex = startIndex + (batchIndex * batchSize);

            // Verificar se a campanha foi pausada antes de processar o próximo lote
            // SECURITY: Validar tenant ao verificar status da campanha
            const [currentCampaign] = await db.select({ status: campaigns.status }).from(campaigns).where(and(
                eq(campaigns.id, campaign.id),
                eq(campaigns.companyId, campaign.companyId)
            ));
            if (currentCampaign?.status === 'PAUSED') {
                logger.debug(`[Campanha SMS ${campaign.id}] Campanha pausada pelo usuário. Interrompendo envio no índice ${absoluteIndex}.`);
                return; // Sai da função sem marcar como completa ou falha
            }

            logger.debug(`[Campanha SMS ${campaign.id}] Processando lote ${batchIndex + 1}/${contactBatches.length} (índice ${absoluteIndex}) com ${batch.length} contatos.`);
            try {
                const providerResponse = await sendSmsBatch(gateway, campaign, batch);

                // Salvar mailing ID da MKOM se disponível e ainda não salvo
                const responseMailingId = typeof providerResponse.mailingId === 'string'
                    ? providerResponse.mailingId
                    : (providerResponse.mailingId ? String(providerResponse.mailingId) : null);

                if (responseMailingId && !savedMailingId) {
                    savedMailingId = responseMailingId;
                    // SECURITY: Validar tenant ao atualizar mailing ID
                    await db.update(campaigns).set({
                        smsProviderMailingId: responseMailingId
                    }).where(and(
                        eq(campaigns.id, campaign.id),
                        eq(campaigns.companyId, campaign.companyId)
                    ));
                    logger.debug(`[Campanha SMS ${campaign.id}] ✅ Mailing ID salvo: ${responseMailingId}`);
                }

                await logSmsDelivery(campaign, gateway, batch, providerResponse as any);

                // Atualizar próximo índice APENAS quando lote foi totalmente bem-sucedido
                // Se houve falhas parciais ou totais, não atualiza para permitir retry
                if (providerResponse.success) {
                    const nextIndex = absoluteIndex + batch.length;
                    // SECURITY: Validar tenant ao atualizar índice
                    await db.update(campaigns).set({
                        smsNextContactIndex: nextIndex
                    }).where(and(
                        eq(campaigns.id, campaign.id),
                        eq(campaigns.companyId, campaign.companyId)
                    ));
                    logger.debug(`[Campanha SMS ${campaign.id}] 📍 Índice atualizado: ${nextIndex}`);
                } else {
                    // Lote com falha parcial ou total - pausar campanha para intervenção manual
                    console.warn(`[Campanha SMS ${campaign.id}] ⚠️ Lote ${batchIndex + 1} teve falhas. Marcando campanha como PARTIAL_FAILURE para revisão.`);
                    // SECURITY: Validar tenant ao atualizar status
                    await db.update(campaigns).set({ status: 'PARTIAL_FAILURE' }).where(and(
                        eq(campaigns.id, campaign.id),
                        eq(campaigns.companyId, campaign.companyId)
                    ));
                    return; // Sai para permitir intervenção manual antes de continuar
                }

            } catch (error) {
                console.error(`[Campanha SMS ${campaign.id}] Erro no lote ${batchIndex + 1} (índice ${absoluteIndex}):`, error);
                await logSmsDelivery(campaign, gateway, batch, { success: false, error: (error as Error).message });
                // Não atualiza o índice em caso de erro de exceção, permitindo retry do mesmo lote
                // SECURITY: Validar tenant ao atualizar status de falha
                await db.update(campaigns).set({ status: 'FAILED' }).where(and(
                    eq(campaigns.id, campaign.id),
                    eq(campaigns.companyId, campaign.companyId)
                ));
                return; // Sai para permitir investigação antes de retentativa
            }

            if (batchIndex < contactBatches.length - 1) {
                logger.debug(`[Campanha SMS ${campaign.id}] Pausando por ${batchDelaySeconds} segundos...`);
                await sleep(batchDelaySeconds * 1000);
            }
        }

        await db.update(campaigns).set({ status: 'COMPLETED', sentAt: new Date(), completedAt: new Date() }).where(eq(campaigns.id, campaign.id));
        logger.debug(`[Campanha SMS ${campaign.id}] ✅ Campanha concluída com sucesso. Total de contatos processados: ${campaignContacts.length}`);

    } catch (error) {
        console.error(`Falha crítica ao enviar campanha SMS ${campaign.id}:`, error);
        await db.update(campaigns).set({ status: 'FAILED' }).where(eq(campaigns.id, campaign.id));
        throw error;
    }
}


// ==========================================
// VOICE CAMPAIGN SENDER
// ==========================================

import { retellService } from './retell-service';
import { voiceAIPlatform } from './voice-ai-platform';
import { voiceCalls, voiceDeliveryReports, voiceRetryQueue } from '@/lib/db/schema';

import { VoiceCallOutcome, VOICE_MAX_RETRY_ATTEMPTS, VOICE_RETRY_DELAY_MINUTES } from './voice-utils';
import { logger } from '@/lib/logger';


const _VOICE_BATCH_SIZE = 20;
const VOICE_BATCH_DELAY_SECONDS = 50;
const VOICE_MAX_CONCURRENT = 20; // Limite Retell (plano Pay-As-You-Go)

interface VoiceCallResult {
    success: boolean;
    contactId: string;
    callId?: string;
    error?: string;
    attemptNumber: number;
}

async function initiateVoiceCall(
    agent: { retellAgentId: string; id: string },
    contact: { id: string; phone: string; name?: string | null },
    companyId: string,
    fromNumber: string,
    attemptNumber: number = 1
): Promise<VoiceCallResult> {
    try {
        let toNumber = contact.phone.replace(/\D/g, '');
        if (!toNumber.startsWith('+')) {
            if (!toNumber.startsWith('55')) {
                toNumber = `+55${toNumber}`;
            } else {
                toNumber = `+${toNumber}`;
            }
        }

        const retellCall = await retellService.createPhoneCallWithVoicemailDetection({
            from_number: fromNumber,
            to_number: toNumber,
            override_agent_id: agent.retellAgentId,
            metadata: {
                contact_id: contact.id,
                company_id: companyId,
                attempt_number: String(attemptNumber),
            }
        });

        await db.insert(voiceCalls).values({
            companyId,
            agentId: agent.id,
            contactId: contact.id,
            retellCallId: retellCall.call_id,
            direction: 'outbound',
            fromNumber,
            toNumber,
            customerName: contact.name || undefined,
            status: retellCall.call_status || 'initiated',
            provider: 'retell',
            metadata: { attemptNumber },
        });

        logger.debug(`[Voice Campaign] ✅ Chamada iniciada para ${toNumber} | CallID: ${retellCall.call_id} | Tentativa: ${attemptNumber}`);
        return {
            success: true,
            contactId: contact.id,
            callId: retellCall.call_id,
            attemptNumber,
        };
    } catch (error) {
        console.error(`[Voice Campaign] ❌ Erro ao iniciar chamada para ${contact.phone} (tentativa ${attemptNumber}):`, error);
        return {
            success: false,
            contactId: contact.id,
            error: (error as Error).message,
            attemptNumber,
        };
    }
}

async function logVoiceDelivery(
    campaignId: string,
    voiceAgentId: string,
    results: VoiceCallResult[]
): Promise<void> {
    const reports = results.map(result => ({
        campaignId,
        contactId: result.contactId,
        voiceAgentId,
        providerCallId: result.callId || null,
        status: result.success ? 'INITIATED' : 'FAILED',
        callOutcome: 'pending' as const,
        attemptNumber: result.attemptNumber,
        failureReason: result.error || null,
    }));

    if (reports.length > 0) {
        await db.insert(voiceDeliveryReports).values(reports);
    }
}


export async function scheduleVoiceRetry(
    campaignId: string,
    contactId: string,
    voiceAgentId: string,
    companyId: string,
    currentAttempt: number,
    lastAttemptReason: string
): Promise<boolean> {
    const nextAttempt = currentAttempt + 1;

    if (nextAttempt > VOICE_MAX_RETRY_ATTEMPTS) {
        logger.debug(`[Voice Retry] Máximo de tentativas atingido para contato ${contactId}. Não será reagendado.`);
        return false;
    }

    const scheduledAt = new Date(Date.now() + VOICE_RETRY_DELAY_MINUTES * 60 * 1000);

    try {
        await db.insert(voiceRetryQueue).values({
            campaignId,
            contactId,
            voiceAgentId,
            companyId,
            attemptNumber: nextAttempt,
            scheduledAt,
            status: 'pending',
            lastAttemptReason,
        }).onConflictDoNothing();

        logger.debug(`[Voice Retry] ✅ Agendada tentativa ${nextAttempt} para contato ${contactId} em ${scheduledAt.toISOString()}`);
        return true;
    } catch (error) {
        console.error(`[Voice Retry] ❌ Erro ao agendar retry para contato ${contactId}:`, error);
        return false;
    }
}

export async function updateVoiceDeliveryWithOutcome(
    providerCallId: string,
    callOutcome: VoiceCallOutcome,
    disconnectionReason: string | null,
    duration: number | null
): Promise<void> {
    try {
        const [report] = await db
            .select()
            .from(voiceDeliveryReports)
            .where(eq(voiceDeliveryReports.providerCallId, providerCallId))
            .limit(1);

        if (!report) {
            console.warn(`[Voice Delivery] Report não encontrado para callId ${providerCallId}`);
            return;
        }

        const [campaign] = report.campaignId ? await db
            .select({ enableRetry: campaigns.enableRetry, maxRetryAttempts: campaigns.maxRetryAttempts, retryDelayMinutes: campaigns.retryDelayMinutes })
            .from(campaigns)
            .where(eq(campaigns.id, report.campaignId))
            .limit(1) : [];

        const maxAttempts = campaign?.maxRetryAttempts || VOICE_MAX_RETRY_ATTEMPTS;
        const retryDelayMins = campaign?.retryDelayMinutes || VOICE_RETRY_DELAY_MINUTES;

        const shouldRetry = campaign?.enableRetry &&
            ['voicemail', 'no_answer', 'busy'].includes(callOutcome) &&
            report.attemptNumber < maxAttempts;

        let nextRetryAt: Date | null = null;
        if (shouldRetry && report.campaignId) {
            nextRetryAt = new Date(Date.now() + retryDelayMins * 60 * 1000);

            await scheduleVoiceRetry(
                report.campaignId,
                report.contactId,
                report.voiceAgentId || '',
                '',
                report.attemptNumber,
                disconnectionReason || callOutcome
            );
        }

        await db
            .update(voiceDeliveryReports)
            .set({
                callOutcome,
                disconnectionReason,
                duration,
                nextRetryAt,
                status: callOutcome === 'human' ? 'COMPLETED' :
                    shouldRetry ? 'RETRY_SCHEDULED' : 'FAILED',
            })
            .where(eq(voiceDeliveryReports.providerCallId, providerCallId));

        logger.debug(`[Voice Delivery] ✅ Atualizado report ${providerCallId}: outcome=${callOutcome}, retry=${shouldRetry}`);
    } catch (error) {
        console.error(`[Voice Delivery] ❌ Erro ao atualizar report ${providerCallId}:`, error);
    }
}

export async function sendVoiceCampaign(campaign: typeof campaigns.$inferSelect): Promise<void> {
    logger.debug(`[Campanha Voice ${campaign.id}] ▶️ Iniciando sendVoiceCampaign - status=${campaign.status}, name=${campaign.name}`);

    if (campaign.sentAt || campaign.completedAt) {
        logger.debug(`[Campanha Voice ${campaign.id}] Já foi completada. Ignorando re-trigger.`);
        return;
    }

    logger.debug(`[Campanha Voice ${campaign.id}] 📋 Verificações: companyId=${campaign.companyId}, voiceAgentId=${campaign.voiceAgentId}, contactListIds=${JSON.stringify(campaign.contactListIds)}`);

    // SECURITY: Validar tenant ao atualizar status
    await db.update(campaigns).set({ status: 'SENDING' }).where(and(
        eq(campaigns.id, campaign.id),
        eq(campaigns.companyId, campaign.companyId)
    ));

    try {
        if (!campaign.companyId) throw new Error(`Campaign ${campaign.id} is missing companyId.`);
        if (!campaign.voiceAgentId) throw new Error(`Campaign ${campaign.id} is missing voiceAgentId.`);

        // First try to get agent from local database
        // SECURITY: Validar tenant ao buscar agente de voz
        const [localAgent] = await db
            .select()
            .from(voiceAgents)
            .where(and(
                eq(voiceAgents.id, campaign.voiceAgentId),
                eq(voiceAgents.companyId, campaign.companyId)
            ));

        let agent: { id: string; name: string; retellAgentId: string | null } | null = null;

        if (localAgent) {
            logger.debug(`[Campanha Voice ${campaign.id}] Agente encontrado no banco local: ${localAgent.name}`);
            agent = {
                id: localAgent.id,
                name: localAgent.name,
                retellAgentId: localAgent.retellAgentId ?? null
            };
        } else {
            // Fallback to Voice AI Platform
            try {
                const platformAgent = await voiceAIPlatform.getAgent(campaign.voiceAgentId);
                if (platformAgent) {
                    agent = {
                        id: platformAgent.id,
                        name: platformAgent.name,
                        retellAgentId: platformAgent.retellAgentId ?? null
                    };
                }
            } catch (err) {
                console.error(`[Campanha Voice ${campaign.id}] Erro ao buscar agente da plataforma:`, err);
            }
        }

        if (!agent) throw new Error(`Voice Agent ${campaign.voiceAgentId} not found.`);

        let retellAgentId = agent.retellAgentId;
        if (!retellAgentId) {
            logger.debug(`[Campanha Voice ${campaign.id}] retellAgentId não configurado no agente. Buscando do Retell...`);
            try {
                const retellAgents = await retellService.listAgents();
                if (retellAgents && retellAgents.length > 0) {
                    const matchingAgent = retellAgents.find(ra =>
                        ra.agent_name.toLowerCase() === agent!.name.toLowerCase()
                    );
                    const selectedAgent = matchingAgent ?? retellAgents[0]!;
                    retellAgentId = selectedAgent.agent_id;
                    logger.debug(`[Campanha Voice ${campaign.id}] Usando agente Retell: ${selectedAgent.agent_name} (${retellAgentId})`);
                }
            } catch (err) {
                console.error(`[Campanha Voice ${campaign.id}] Erro ao buscar agentes Retell:`, err);
            }
        }
        if (!retellAgentId) throw new Error(`Retell Agent ID not found for Voice Agent ${campaign.voiceAgentId}`);

        const campaignFromNumber = (campaign.variableMappings as { fromNumber?: string })?.fromNumber;
        const twilioFromNumber = campaignFromNumber || process.env.TWILIO_PHONE_NUMBER;
        if (!twilioFromNumber) throw new Error('TWILIO_PHONE_NUMBER environment variable is not configured.');

        const isRetryMode = campaign.retryContactIds && campaign.retryContactIds.length > 0;

        if (!isRetryMode && (!campaign.contactListIds || campaign.contactListIds.length === 0)) {
            await db.update(campaigns).set({ status: 'COMPLETED', completedAt: new Date() }).where(eq(campaigns.id, campaign.id));
            logger.debug(`[Campanha Voice ${campaign.id}] Concluída: sem listas de contatos.`);
            return;
        }

        let campaignContacts;

        if (isRetryMode) {
            logger.debug(`[Campanha Voice ${campaign.id}] Modo retry: ${campaign.retryContactIds!.length} contatos`);
            campaignContacts = await db
                .selectDistinct({ phone: contacts.phone, id: contacts.id, name: contacts.name })
                .from(contacts)
                .where(inArray(contacts.id, campaign.retryContactIds!));
        } else {
            const contactIdsSubquery = db
                .select({ contactId: contactsToContactLists.contactId })
                .from(contactsToContactLists)
                .where(inArray(contactsToContactLists.listId, campaign.contactListIds!));
            campaignContacts = await db
                .selectDistinct({ phone: contacts.phone, id: contacts.id, name: contacts.name })
                .from(contacts)
                .where(inArray(contacts.id, contactIdsSubquery));
        }

        if (campaignContacts.length === 0) {
            await db.update(campaigns).set({ status: 'COMPLETED', completedAt: new Date() }).where(eq(campaigns.id, campaign.id));
            logger.debug(`[Campanha Voice ${campaign.id}] Concluída: sem contatos nas listas.`);
            return;
        }

        logger.debug(`[Campanha Voice ${campaign.id}] Iniciando campanha com ${campaignContacts.length} contatos`);

        const batchDelaySeconds = campaign.batchDelaySeconds || VOICE_BATCH_DELAY_SECONDS;
        const maxConcurrent = VOICE_MAX_CONCURRENT;

        let totalSuccess = 0;
        let totalFailed = 0;
        let processedIndex = 0;
        let batchNumber = 0;

        while (processedIndex < campaignContacts.length) {
            const [currentCampaign] = await db
                .select({ status: campaigns.status })
                .from(campaigns)
                .where(eq(campaigns.id, campaign.id));

            if (currentCampaign?.status === 'PAUSED') {
                logger.debug(`[Campanha Voice ${campaign.id}] Campanha pausada. Parando no contato ${processedIndex + 1}.`);
                return;
            }

            const availableSlots = await retellService.getAvailableSlots(maxConcurrent);

            if (availableSlots === 0) {
                logger.debug(`[Campanha Voice ${campaign.id}] Nenhum slot disponível. Aguardando ${batchDelaySeconds}s...`);
                await sleep(batchDelaySeconds * 1000);
                continue;
            }

            const batch = campaignContacts.slice(processedIndex, processedIndex + availableSlots);
            batchNumber++;

            logger.debug(`[Campanha Voice ${campaign.id}] Lote ${batchNumber}: ${batch.length} chamadas (slots disponíveis: ${availableSlots})`);

            const callPromises = batch.map(contact =>
                initiateVoiceCall(
                    { retellAgentId: retellAgentId, id: agent.id },
                    contact,
                    campaign.companyId!,
                    twilioFromNumber,
                    1
                )
            );

            const results = await Promise.all(callPromises);

            await logVoiceDelivery(campaign.id, campaign.voiceAgentId!, results);

            const batchSuccess = results.filter(r => r.success).length;
            const batchFailed = results.filter(r => !r.success).length;
            totalSuccess += batchSuccess;
            totalFailed += batchFailed;
            processedIndex += batch.length;

            logger.debug(`[Campanha Voice ${campaign.id}] Lote ${batchNumber}: ${batchSuccess} sucesso, ${batchFailed} falhas. Progresso: ${processedIndex}/${campaignContacts.length}`);

            if (processedIndex < campaignContacts.length) {
                logger.debug(`[Campanha Voice ${campaign.id}] Aguardando ${batchDelaySeconds}s antes do próximo lote...`);
                await sleep(batchDelaySeconds * 1000);
            }
        }

        // SECURITY: Validar tenant ao atualizar status final
        const finalStatus = totalFailed === 0 ? 'COMPLETED' :
            totalSuccess === 0 ? 'FAILED' : 'PARTIAL_FAILURE';

        // SECURITY: Validar tenant ao atualizar status final
        await db.update(campaigns).set({
            status: finalStatus,
            sentAt: new Date(),
            completedAt: new Date()
        }).where(and(
            eq(campaigns.id, campaign.id),
            eq(campaigns.companyId, campaign.companyId)
        ));

        logger.debug(`[Campanha Voice ${campaign.id}] ✅ Campanha ${finalStatus}. Total: ${campaignContacts.length}, Sucesso: ${totalSuccess}, Falhas: ${totalFailed}`);

    } catch (error) {
        console.error(`Falha crítica na campanha de voz ${campaign.id}:`, error);
        // SECURITY: Validar tenant ao atualizar status de falha
        await db.update(campaigns).set({ status: 'FAILED' }).where(and(
            eq(campaigns.id, campaign.id),
            eq(campaigns.companyId, campaign.companyId)
        ));
        throw error;
    }
}
