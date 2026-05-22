
// src/app/api/webhooks/meta/[slug]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { companies, webhookLogs, connections, whatsappDeliveryReports, contacts, conversations, messages, campaigns, messageReactions } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getPhoneVariations, canonicalizeBrazilPhone, sanitizePhone } from '@/lib/utils';
import crypto from 'crypto';
import { decrypt } from '@/lib/crypto';
import { getMediaUrl } from '@/lib/facebookApiService';
import { uploadFileToS3 } from '@/lib/s3';
import { v4 as uuidv4 } from 'uuid';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';
import { resumeFlowForContact } from '@/lib/flow-engine';
import { emitToCompany } from '@/lib/socket';

// GET /api/webhooks/meta/[slug] - Used for Facebook Webhook Verification

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const challenge = searchParams.get('hub.challenge');
    const verifyToken = searchParams.get('hub.verify_token');

    if (mode === 'subscribe' && verifyToken === process.env.META_VERIFY_TOKEN) {
        console.log(`✅ Webhook verificado com sucesso para o slug: ${slug}`);
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error('Falha na verificação do Webhook. Tokens não correspondem ou modo inválido.');
        return new NextResponse('Forbidden', { status: 403 });
    }
}


// POST /api/webhooks/meta/[slug] - Receives events from Meta
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    try {
        const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.webhookSlug, slug)).limit(1);
        if (!company) {
            console.warn(`Webhook recebido para slug não encontrado: ${slug}`);
            return new NextResponse('Company slug not found', { status: 404 });
        }

        const [connection] = await db.select({ appSecret: connections.appSecret })
            .from(connections)
            .where(and(
                eq(connections.companyId, company.id),
                eq(connections.connectionType, 'meta_api'),
                eq(connections.isActive, true)
            ))
            .limit(1);

        if (!connection || !connection.appSecret) {
            console.error(`App Secret não encontrado para a empresa com slug: ${slug}`);
            return new NextResponse('App Secret for active Meta connection not configured', { status: 400 });
        }
        const decryptedAppSecret = decrypt(connection.appSecret);

        if (!decryptedAppSecret) {
            console.error(`Falha ao descriptografar App Secret para a empresa com slug: ${slug}`);
            return new NextResponse('App Secret decryption failed', { status: 400 });
        }

        const signature = request.headers.get('x-hub-signature-256');
        if (!signature) {
            console.warn(`[META-WEBHOOK:${slug}] Webhook recebido sem assinatura.`);
            return new NextResponse('Signature missing', { status: 400 });
        }

        const rawBody = await request.text();
        console.log(`[META-WEBHOOK:${slug}] Payload recebido: ${rawBody.length} bytes`);

        const hmac = crypto.createHmac('sha256', decryptedAppSecret);
        hmac.update(rawBody);
        const expectedSignature = `sha256=${hmac.digest('hex')}`;

        // Protect against Buffer length mismatch crash in timingSafeEqual
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);
        if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
            console.warn(`[META-WEBHOOK:${slug}] Assinatura inválida. Received length: ${sigBuffer.length}, Expected length: ${expectedBuffer.length}`);
            return new NextResponse('Invalid signature', { status: 403 });
        }

        const payload = JSON.parse(rawBody);

        await db.insert(webhookLogs).values({
            companyId: company.id,
            payload: payload,
        });

        console.log(`[META-WEBHOOK:${slug}] Payload logged. Processing events...`);

        // CRITICAL: Must await — serverless runtime kills the function after return
        await processWebhookEvents(payload, company.id);

        console.log(`[META-WEBHOOK:${slug}] Events processed successfully.`);
        return new NextResponse('OK', { status: 200 });

    } catch (error) {
        console.error('Erro ao processar o webhook:', error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return NextResponse.json({ error: 'Erro interno do servidor.', details: errorMessage }, { status: 500 });
    }
}


async function processWebhookEvents(payload: any, companyId: string) {
    if (payload.object !== 'whatsapp_business_account') {
        console.log(`[META-WEBHOOK] Ignoring non-whatsapp payload: ${payload.object}`);
        return;
    }

    for (const entry of payload.entry) {
        for (const change of entry.changes) {

            if (change.field === 'messages' && change.value.messages) {
                const messageData = change.value.messages?.[0];
                const contactData = change.value.contacts?.[0];
                const metadata = change.value.metadata;

                console.log(`[META-WEBHOOK] Message received: type=${messageData?.type}, from=${contactData?.wa_id}, phone_number_id=${metadata?.phone_number_id}`);

                if (messageData && contactData && metadata) {
                    try {
                        await processIncomingMessage({
                            messageData,
                            contactData,
                            metadata,
                            companyId
                        });
                        console.log(`[META-WEBHOOK] ✅ Message processed successfully for ${contactData.wa_id}`);
                    } catch (msgError) {
                        console.error(`[META-WEBHOOK] ❌ Error processing message from ${contactData.wa_id}:`, msgError);
                    }
                } else {
                    console.warn(`[META-WEBHOOK] Incomplete message data: messageData=${!!messageData}, contactData=${!!contactData}, metadata=${!!metadata}`);
                }
            }

            if (change.field === 'messages' && change.value.statuses) {
                for (const status of change.value.statuses) {
                    await updateMessageStatus(status, companyId);
                }
            }
        }
    }
}

async function updateMessageStatus(statusObject: any, companyId: string) {
    const { id: wamid, status, errors, timestamp } = statusObject;
    if (!wamid) return;

    try {
        const dataToUpdate: any = { status: status.toLowerCase() };
        const eventDate = new Date(parseInt(timestamp) * 1000);

        if (errors) dataToUpdate.failureReason = JSON.stringify(errors);

        if (status === 'read') {
            dataToUpdate.readAt = eventDate;
        }

        const subquery = db
            .select({ id: conversations.id })
            .from(conversations)
            .where(eq(conversations.companyId, companyId))
            .as('company_convos');

        const updatedMessages = await db.update(messages)
            .set(dataToUpdate)
            .where(
                and(
                    eq(messages.providerMessageId, wamid),
                    inArray(messages.conversationId, db.select({ id: subquery.id }).from(subquery))
                )
            )
            .returning({ id: messages.id });

        if (updatedMessages.length > 0) {
            console.log(`[Webhook] Status da mensagem de chat ${wamid} atualizado para ${status} para a empresa ${companyId}`);
            return;
        }

        const updatedReports = await db.update(whatsappDeliveryReports)
            .set({ ...dataToUpdate, updatedAt: eventDate })
            .where(
                and(
                    eq(whatsappDeliveryReports.providerMessageId, wamid),
                    inArray(whatsappDeliveryReports.campaignId, db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.companyId, companyId)))
                )
            )
            .returning({ id: whatsappDeliveryReports.id });

        if (updatedReports.length > 0) {
            console.log(`[Webhook] Status da mensagem de campanha ${wamid} atualizado para ${status} para a empresa ${companyId}`);
            return;
        }

    } catch (error) {
        console.error(`Erro ao atualizar status para a mensagem ${wamid} da empresa ${companyId}:`, error);
    }
}

function getMessageContent(messageData: any): string {
    // Tipos de texto e respostas
    if (messageData.type === 'text') return messageData.text?.body;
    if (messageData.type === 'button') return messageData.button?.text;
    if (messageData.type === 'interactive' && messageData.interactive?.button_reply) return messageData.interactive.button_reply.title;
    if (messageData.type === 'interactive' && messageData.interactive?.list_reply) return messageData.interactive.list_reply.title;

    // Mídia com legendas
    if (messageData.image?.caption) return messageData.image.caption;
    if (messageData.video?.caption) return messageData.video.caption;
    if (messageData.document?.caption) return messageData.document.caption;
    if (messageData.document?.filename) return `📄 ${messageData.document.filename}`;

    // Mídia sem legendas
    if (messageData.type === 'image') return '📷 Imagem';
    if (messageData.type === 'video') return '📹 Vídeo';
    if (messageData.type === 'audio') return '🎵 Áudio';
    if (messageData.type === 'sticker') return 'Sticker';

    // Tipos especiais
    if (messageData.type === 'location') {
        const { latitude, longitude, name, address } = messageData.location;
        const link = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        let locationDetails = `📍 Localização partilhada: ${link}`;
        if (name) locationDetails += `
Nome: ${name}`;
        if (address) locationDetails += `
Endereço: ${address}`;
        return locationDetails;
    }
    if (messageData.type === 'contacts' && messageData.contacts.length > 0) {
        const contactInfo = messageData.contacts[0];
        const name = contactInfo.name.formatted_name;
        const phone = contactInfo.phones[0]?.phone;
        return `👤 Contacto partilhado: ${name} (${phone})`;
    }

    return messageData.type.toUpperCase() || 'MENSAGEM NÃO TEXTUAL';
}


async function processIncomingMessage(
    { messageData, contactData, metadata, companyId }:
        { messageData: any, contactData: any, metadata: any, companyId: string }
) {
    // Store IDs from transaction for AI trigger AFTER commit
    let triggerConversationId: string | null = null;
    let triggerMessageId: string | null = null;
    // Store contact info for resume check
    let triggerContactId: string | null = null;
    let triggerMessageText: string | null = null;
    let triggerCompanyId: string = companyId;
    let triggerAiActive: boolean | null = null;
    // Store extra fields for chat:new-message realtime event
    let triggerContentType: string | null = null;
    let triggerContactName: string | null = null;
    let triggerContactPhone: string | null = null;
    // Store media info for S3 upload AFTER transaction
    let mediaUploadInfo: {
        messageId: string;
        messageType: string;
        mediaId: string;
        accessToken: string;
        companyId: string;
    } | null = null;

    await db.transaction(async (tx) => {
        try {
            const [connection] = await tx.select()
                .from(connections)
                .where(and(
                    eq(connections.phoneNumberId, metadata.phone_number_id),
                    eq(connections.companyId, companyId)
                ));

            if (!connection) {
                console.error(`[META-WEBHOOK] Conexão não encontrada para a empresa ${companyId} (PhoneNumberID: ${metadata.phone_number_id})`);
                return;
            }

            const initialPhone = sanitizePhone(contactData.wa_id);
            if (!initialPhone) {
                console.error(`[META-WEBHOOK] Número de telefone inválido: ${contactData.wa_id}`);
                return;
            }

            if (messageData.type === 'reaction') {
                const targetMessageId = messageData.reaction.message_id;
                const emoji = messageData.reaction.emoji;

                const [targetMessage] = await tx.select({ id: messages.id })
                    .from(messages)
                    .where(eq(messages.providerMessageId, targetMessageId))
                    .limit(1);

                if (targetMessage) {
                    if (emoji === '') {
                        await tx.delete(messageReactions)
                            .where(and(
                                eq(messageReactions.messageId, targetMessage.id),
                                eq(messageReactions.reactorPhone, initialPhone)
                            ));
                        console.log(`[META-WEBHOOK] Reação removida para mensagem ${targetMessage.id} por ${initialPhone}`);
                    } else {
                        await tx.insert(messageReactions)
                            .values({
                                messageId: targetMessage.id,
                                reactorPhone: initialPhone,
                                reactorName: contactData.profile.name,
                                emoji,
                            })
                            .onConflictDoUpdate({
                                target: [messageReactions.messageId, messageReactions.reactorPhone],
                                set: { emoji, reactorName: contactData.profile.name },
                            });
                        console.log(`[META-WEBHOOK] Reação ${emoji} salva para mensagem ${targetMessage.id} por ${initialPhone}`);
                    }
                }
                return;
            }

            const phoneVariations = getPhoneVariations(initialPhone);

            let [contact] = await tx.select()
                .from(contacts)
                .where(and(
                    eq(contacts.companyId, companyId),
                    inArray(contacts.phone, phoneVariations)
                ))
                .limit(1);

            if (contact) {
                const updates: Partial<typeof contacts.$inferInsert> = {
                    whatsappName: contactData.profile.name,
                    profileLastSyncedAt: new Date(),
                };

                const [updatedContact] = await tx.update(contacts)
                    .set(updates)
                    .where(eq(contacts.id, contact.id))
                    .returning();
                if (updatedContact) contact = updatedContact;

            } else {
                const canonicalPhoneForNewContact = canonicalizeBrazilPhone(initialPhone);

                const [newContact] = await tx.insert(contacts).values({
                    companyId: companyId,
                    name: contactData.profile.name || canonicalPhoneForNewContact,
                    phone: canonicalPhoneForNewContact,
                    whatsappName: contactData.profile.name,
                    profileLastSyncedAt: new Date(),
                }).returning();
                if (newContact) contact = newContact;
            }

            if (!contact) {
                throw new Error("Falha ao criar ou encontrar o contato.");
            }

            let [conversation] = await tx.select().from(conversations).where(
                and(
                    eq(conversations.contactId, contact.id),
                    eq(conversations.companyId, companyId)
                )
            );

            if (!conversation) {
                const [newConversation] = await tx.insert(conversations).values({
                    companyId: companyId,
                    contactId: contact.id,
                    connectionId: connection.id,
                }).returning();
                if (newConversation) conversation = newConversation;
            } else {
                // MULTI-CONEXÃO: atualiza apenas lastMessageAt e status.
                // NÃO sobrescreve connectionId para preservar a conexão original da conversa.
                // Mensagens de qualquer conexão (Meta ou não) são salvas na mesma thread do lead.
                const [updatedConversation] = await tx.update(conversations)
                    .set({ lastMessageAt: new Date(), status: 'IN_PROGRESS' })
                    .where(eq(conversations.id, conversation.id))
                    .returning();
                if (updatedConversation) conversation = updatedConversation;
            }

            if (!conversation) {
                throw new Error("Falha ao criar ou encontrar a conversa.");
            }

            // Check if message has media — prepare for upload AFTER transaction
            const mediaTypes = ['image', 'video', 'document', 'audio'];
            const messageType = messageData.type;
            let shouldUploadMedia = false;

            if (mediaTypes.includes(messageType)) {
                const mediaObject = messageData[messageType];
                if (mediaObject?.id) {
                    const accessToken = connection.accessToken ? decrypt(connection.accessToken) : null;
                    if (accessToken) {
                        shouldUploadMedia = true;
                        // Will be populated after message insert
                        mediaUploadInfo = {
                            messageId: '', // set after insert
                            messageType,
                            mediaId: mediaObject.id,
                            accessToken,
                            companyId,
                        };
                    }
                } else {
                    console.error(`[META-WEBHOOK] Objeto de mídia ${messageType} incompleto:`, JSON.stringify(messageData));
                }
            }

            let repliedToInternalId: string | null = null;
            if (messageData.context?.id) {
                const [originalMessage] = await tx.select({ id: messages.id })
                    .from(messages)
                    .where(eq(messages.providerMessageId, messageData.context.id));
                if (originalMessage) {
                    repliedToInternalId = originalMessage.id;
                }
            }

            // Save message IMMEDIATELY (no media URL yet — will be updated after S3 upload)
            const [insertedMessage] = await tx.insert(messages).values({
                conversationId: conversation.id,
                connectionId: connection.id,
                providerMessageId: messageData.id,
                repliedToMessageId: repliedToInternalId,
                senderType: 'CONTACT',
                senderId: contact.id,
                content: getMessageContent(messageData),
                contentType: messageData.type.toUpperCase(),
                mediaUrl: null, // Updated after S3 upload completes
            }).returning({ id: messages.id });

            console.log(`[META-WEBHOOK] ✅ Mensagem salva: ${insertedMessage?.id} (conversation: ${conversation.id})`);

            // Set the message ID for media upload
            if (mediaUploadInfo && insertedMessage) {
                mediaUploadInfo.messageId = insertedMessage.id;
            }

            // Cancelar cadências ativas para este contato (resposta do lead)
            try {
                const { CadenceService } = await import('@/lib/cadence-service');
                const cancelledCount = await CadenceService.cancelEnrollmentsByContact(
                    contact.id,
                    companyId,
                    'Contact replied'
                );
                if (cancelledCount > 0) {
                    console.log(`[META-WEBHOOK] ${cancelledCount} cadência(s) cancelada(s) para contato ${contact.id}`);
                }
            } catch (cadenceError) {
                console.error('[META-WEBHOOK] Erro ao cancelar cadências:', cadenceError);
            }

            // Store IDs for AI trigger AFTER transaction commits
            if (insertedMessage && conversation) {
                triggerConversationId = conversation.id;
                triggerMessageId = insertedMessage.id;
                triggerContactId = contact.id;
                triggerMessageText = getMessageContent(messageData);
                triggerAiActive = conversation.aiActive;
                // Extra fields para fast-path realtime
                triggerContentType = messageData.type.toUpperCase();
                triggerContactName = contact.name || contactData.profile?.name || null;
                triggerContactPhone = contact.phone || null;
            }

        } catch (error) {
            console.error(`[META-WEBHOOK] Erro na transação para empresa ${companyId}:`, error);
            throw error;
        }
    });

    // === AFTER TRANSACTION COMMIT ===

    // Upload media to S3 in background (non-blocking for message processing)
    const mediaInfo = mediaUploadInfo as { messageId: string; messageType: string; mediaId: string; accessToken: string; companyId: string } | null;
    if (mediaInfo) {
        uploadMediaToS3(mediaInfo.messageId, mediaInfo.messageType, mediaInfo.mediaId, mediaInfo.accessToken, mediaInfo.companyId)
            .catch(err => console.error(`[META-WEBHOOK] ❌ S3 media upload failed for msg ${mediaInfo.messageId}:`, err));
    }

    if (triggerConversationId && triggerMessageId) {
        const convId = triggerConversationId;
        const msgId = triggerMessageId;
        const cId = triggerContactId;
        const msgText = triggerMessageText || '';
        const coId = triggerCompanyId;
        const aiActive = triggerAiActive;

        // Emitir eventos realtime IMEDIATAMENTE após o commit do DB
        // Fast-path: chat:new-message com payload completo
        // O frontend faz append direto sem precisar refetch
        emitToCompany(coId, 'chat:new-message', {
            conversationId: convId,
            messageId: msgId,
            content: msgText,
            contentType: triggerContentType || 'TEXT',
            isFromMe: false, // Mensagem de contato incoming
            senderType: 'CONTACT',
            mediaUrl: null, // Mídia ainda em upload async — será atualizada via chat:message-updated
            timestamp: new Date().toISOString(),
            contactName: triggerContactName,
            contactPhone: triggerContactPhone,
            connectionId: null, // For simplicity unless we explicitly export it
        });
        // Slow-path backup: força re-render da lista completa
        emitToCompany(coId, 'inbox:update', { timestamp: Date.now() });

        setTimeout(async () => {
            // 1. Primeiro: tentar retomar execução pausada (diálogo IA)
            if (cId && aiActive !== false) {
                try {
                    const resumed = await resumeFlowForContact(cId, msgText, coId);
                    if (resumed) {
                        console.log(`[META-WEBHOOK] 🔄 Resumed paused flow for contact ${cId}`);
                        return; // Não disparar nova automação se retomou uma pausada
                    }
                } catch (err) {
                    console.error(`[META-WEBHOOK] ❌ Error resuming flow for contact ${cId}:`, err);
                }
            } else if (aiActive === false) {
                console.log(`[META-WEBHOOK] 🛑 IA desativada para a conversa ${convId}. Fluxos pausados não serão retomados.`);
            }

            // 2. Segundo: disparar nova automação se não havia execução pausada
            processIncomingMessageTrigger(convId, msgId).catch(err => {
                console.error(`[META-WEBHOOK] Erro ao disparar automação para msg ${msgId}:`, err);
            });
        }, 500);
    }
}

/**
 * Upload media to S3 and update the message with the permanent URL.
 * Runs OUTSIDE the main DB transaction to prevent blocking.
 */
async function uploadMediaToS3(
    messageId: string,
    messageType: string,
    mediaId: string,
    accessToken: string,
    companyId: string
) {
    try {
        const tempMediaUrl = await getMediaUrl(mediaId, accessToken);
        if (!tempMediaUrl) {
            console.warn(`[META-WEBHOOK] Não foi possível obter URL temporária para mediaId ${mediaId}`);
            return;
        }

        console.log(`[META-WEBHOOK] Iniciando download de mídia ${messageType} (ID: ${mediaId})...`);
        const startTime = Date.now();

        const mediaResponse = await fetch(tempMediaUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(30000)
        });

        if (!mediaResponse.ok) {
            throw new Error(`Falha ao descarregar mídia da Meta. Status: ${mediaResponse.status}`);
        }

        const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
        const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';
        const fileSize = mediaBuffer.length;

        console.log(`[META-WEBHOOK] Mídia descarregada: ${contentType} (${(fileSize / 1024 / 1024).toFixed(2)} MB) em ${Date.now() - startTime}ms`);

        const extension = contentType.split('/')[1] || 'bin';
        const s3Key = `media_recebida/${uuidv4()}.${extension}`;

        const permanentMediaUrl = await uploadFileToS3(companyId, s3Key, mediaBuffer, contentType);
        console.log(`[META-WEBHOOK] Mídia salva no S3: ${permanentMediaUrl}`);

        // Update the message with the permanent media URL
        await db.update(messages)
            .set({ mediaUrl: permanentMediaUrl })
            .where(eq(messages.id, messageId));

        console.log(`[META-WEBHOOK] ✅ Mensagem ${messageId} atualizada com media URL`);
        
        // Notify frontend that media is ready
        emitToCompany(companyId, 'chat:message-updated', { messageId, mediaUrl: permanentMediaUrl });

    } catch (error) {
        console.error(`[META-WEBHOOK] ❌ Erro ao processar mídia ${messageType} (${mediaId}):`, error);
    }
}

