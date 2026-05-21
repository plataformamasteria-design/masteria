import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connections, conversations, messages, contacts } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';
import { resumeFlowForContact } from '@/lib/flow-engine';
import { canonicalizeBrazilPhone, getPhoneVariations } from '@/lib/utils';
import { emitToCompany } from '@/lib/socket';
import { uploadFileToS3 } from '@/lib/s3';
import { evolutionApiService } from '@/services/evolution-api.service';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Evolution API Payload
        const eventType = body.event;
        const instanceName = body.instance;
        const rawData = body.data;

        if (!instanceName || !rawData) {
            return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
        }

        if (eventType !== 'messages.upsert') {
            return NextResponse.json({ success: true, ignored: true, reason: 'Event not supported' });
        }

        // ⚠️ Evolution API can send `data` as an array or as an object containing `messages` or as the message itself.
        const rawMessages = Array.isArray(rawData) 
            ? rawData 
            : rawData.messages 
                ? rawData.messages 
                : [rawData];

        const data = rawMessages[0]; // Take the first message to process

        const key = data?.key;
        if (!key || !key.remoteJid) {
             console.error('[EVOLUTION-WEBHOOK] Missing key in message. Payload:', JSON.stringify(body).substring(0, 500));
             return NextResponse.json({ error: 'Missing key in message' }, { status: 400 });
        }

        const remoteJid = key.remoteJid;
        const fromMe = key.fromMe || false;
        const messageId = key.id;
        const pushName = data.pushName || 'Contato';
        
        const isGroup = remoteJid.endsWith('@g.us');
        if (isGroup) {
            // Ignorando grupos temporariamente conforme regras do projeto (se aplicável)
            return NextResponse.json({ success: true, ignored: true, reason: 'Groups not supported yet' });
        }

        const phone = remoteJid.split('@')[0];

        // Obter conteúdo da mensagem
        const messageObj = data.message || {};
        let content = '';
        let messageType = 'TEXT';

        let mediaUrl: string | null = null;
        let mimeType = 'application/octet-stream';
        let fileName = 'media.bin';

        if (messageObj.conversation) {
            content = messageObj.conversation;
        } else if (messageObj.extendedTextMessage?.text) {
            content = messageObj.extendedTextMessage.text;
        } else if (messageObj.imageMessage) {
            content = messageObj.imageMessage.caption || '📷 Imagem';
            messageType = 'IMAGE';
            mimeType = messageObj.imageMessage.mimetype || 'image/jpeg';
            fileName = 'image.jpg';
        } else if (messageObj.videoMessage) {
            content = messageObj.videoMessage.caption || '🎥 Vídeo';
            messageType = 'VIDEO';
            mimeType = messageObj.videoMessage.mimetype || 'video/mp4';
            fileName = 'video.mp4';
        } else if (messageObj.audioMessage) {
            content = '🎵 Áudio';
            messageType = 'AUDIO';
            mimeType = messageObj.audioMessage.mimetype || 'audio/ogg';
            fileName = 'audio.ogg';
            if (fileName.match(/\.(oga|ogg)$/i)) {
                fileName = fileName.replace(/\.(oga|ogg)$/i, '.mp3');
            }
        } else if (messageObj.documentMessage) {
            content = messageObj.documentMessage.fileName || '📄 Documento';
            messageType = 'DOCUMENT';
            mimeType = messageObj.documentMessage.mimetype || 'application/pdf';
            fileName = messageObj.documentMessage.fileName || 'document.pdf';
        } else if (messageObj.stickerMessage) {
            content = 'Sticker';
            messageType = 'STICKER';
            mimeType = messageObj.stickerMessage.mimetype || 'image/webp';
            fileName = 'sticker.webp';
        } else if (messageObj.contactMessage) {
            const vcard = messageObj.contactMessage.vcard || '';
            const nameMatch = vcard.match(/FN:(.+)/);
            const phoneMatch = vcard.match(/waid=([^:]+):/i) || vcard.match(/TEL.*:(.+)/);
            const contactName = nameMatch ? nameMatch[1] : 'Contato';
            const contactPhone = phoneMatch ? phoneMatch[1].replace(/[\r\n]/g, '') : '';
            content = `👤 Contato compartilhado\nNome: ${contactName}${contactPhone ? `\nTelefone: ${contactPhone}` : ''}`;
            messageType = 'TEXT';
        } else if (messageObj.contactsArrayMessage) {
            const count = messageObj.contactsArrayMessage.contacts?.length || 0;
            content = `👤 ${count} Contato(s) compartilhado(s)`;
            messageType = 'TEXT';
        } else {
            content = 'Mensagem não suportada';
        }

        // 1. Descobrir o Company ID e Connection a partir do instanceName
        const connection = await db.query.connections.findFirst({
            where: eq(connections.id, instanceName)
        });

        if (!connection) {
            console.error(`[EVOLUTION-WEBHOOK] Connection not found for instance: ${instanceName}`);
            return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        const companyId = connection.companyId;

        let mediaUploadInfo: {
            messageId: string;
            messageType: string;
            fileName: string;
            mimeType: string;
            base64String: string | null;
            instanceName: string;
            messageData: any;
            conversationId: string;
        } | null = null;

        // 2. Transação: Criar Contato, Conversa e Mensagem atomicamente
        const txResult = await db.transaction(async (tx) => {
            const phoneVariations = getPhoneVariations(phone);
            
            let [contact] = await tx.select().from(contacts).where(and(eq(contacts.companyId, companyId), inArray(contacts.phone, phoneVariations)));
            
            if (!contact) {
                let avatarUrl: string | null = null;
                try {
                    avatarUrl = await evolutionApiService.fetchProfilePictureUrl(instanceName, remoteJid);
                } catch (e) {
                    console.log(`[EVOLUTION-WEBHOOK] Erro ao buscar avatar para ${phone}`);
                }

                const canonicalPhone = canonicalizeBrazilPhone(phone);
                [contact] = await tx.insert(contacts).values({
                    companyId,
                    name: pushName,
                    whatsappName: pushName,
                    phone: canonicalPhone,
                    avatarUrl,
                    status: 'ACTIVE'
                }).returning();
            } else if (!contact.avatarUrl && !contact.profileLastSyncedAt) {
                 // Sincronização preguiçosa de avatar se estiver nulo e nunca foi sincronizado
                 try {
                     const avatarUrl = await evolutionApiService.fetchProfilePictureUrl(instanceName, remoteJid);
                     if (avatarUrl) {
                         [contact] = await tx.update(contacts)
                            .set({ avatarUrl, profileLastSyncedAt: new Date() })
                            .where(eq(contacts.id, contact.id))
                            .returning();
                     } else {
                         // Marcar que tentou sincronizar para não ficar tentando em toda msg
                         await tx.update(contacts).set({ profileLastSyncedAt: new Date() }).where(eq(contacts.id, contact.id));
                     }
                 } catch (e) {
                     console.log(`[EVOLUTION-WEBHOOK] Erro ao buscar avatar pendente para ${phone}`);
                 }
            }

            let [conversation] = await tx.select().from(conversations).where(and(
                eq(conversations.companyId, companyId),
                eq(conversations.contactId, contact.id)
            ));

            if (!conversation) {
                [conversation] = await tx.insert(conversations).values({
                    companyId,
                    contactId: contact.id,
                    connectionId: connection.id,
                    status: 'NEW',
                }).returning();
            } else {
                const updatePayload: any = { lastMessageAt: new Date(), connectionId: connection.id };
                [conversation] = await tx.update(conversations).set(updatePayload).where(eq(conversations.id, conversation.id)).returning();
            }

            const conversationId = conversation.id;

            const [existingMessage] = await tx.select({ id: messages.id }).from(messages).where(eq(messages.providerMessageId, messageId)).limit(1);

            if (existingMessage) {
                return { ignored: true, messageId: existingMessage.id, conversationId, contactId: contact.id, aiActive: conversation.aiActive };
            }

            if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'].includes(messageType)) {
                let base64String = data.base64 || messageObj.base64 || messageObj.imageMessage?.base64 || messageObj.videoMessage?.base64 || messageObj.audioMessage?.base64 || messageObj.documentMessage?.base64 || messageObj.stickerMessage?.base64 || null;
                
                mediaUploadInfo = {
                    messageId: '', // set below
                    messageType,
                    fileName,
                    mimeType,
                    base64String,
                    instanceName,
                    messageData: data,
                    conversationId
                };
            }

            const [newMsg] = await tx.insert(messages).values({
                companyId,
                conversationId,
                connectionId: connection.id,
                providerMessageId: messageId,
                senderType: fromMe ? 'AGENT' : 'CONTACT',
                content: content,
                contentType: messageType,
                mediaUrl: null, // Set by background job
                status: fromMe ? 'SENT' : 'RECEIVED'
            }).returning();

            if (mediaUploadInfo) mediaUploadInfo.messageId = newMsg.id;

            return {
                ignored: false,
                messageId: newMsg.id,
                conversationId: conversation.id,
                contactId: contact.id,
                aiActive: conversation.aiActive
            };
        });

        if (txResult.ignored) {
            console.log(`[EVOLUTION-WEBHOOK] 🛑 Mensagem duplicada ignorada (ID: ${messageId})`);
            return NextResponse.json({ success: true, message: 'Processado com sucesso (Duplicada ignorada)' }, { status: 200 });
        }

        const savedMessageId = txResult.messageId;
        const conversationId = txResult.conversationId;
        const contactId = txResult.contactId;

        // Background Media Upload
        if (mediaUploadInfo) {
            uploadMediaToS3Evo(mediaUploadInfo, companyId)
                .catch(err => console.error(`[EVOLUTION-WEBHOOK] ❌ S3 media upload failed for msg ${mediaUploadInfo!.messageId}:`, err));
        }

        // 5. Emitir eventos Realtime
        try {
            emitToCompany(companyId, 'chat:new-message', {
                conversationId,
                messageId: savedMessageId,
                connectionId: connection.id,
                contactPhone: phone,
                contactName: pushName,
                content: content,
                contentType: messageType,
                mediaUrl: null, // Will be updated by chat:message-updated if it has media
                isFromMe: fromMe,
                senderType: fromMe ? 'AGENT' : 'CONTACT',
                timestamp: new Date().toISOString(),
            });
            emitToCompany(companyId, 'inbox:update', { timestamp: Date.now() });
        } catch (err) {
            console.error('[EVOLUTION-WEBHOOK] Erro ao emitir eventos realtime:', err);
        }

        // 6. Trigger da Automação de IA
        if (!fromMe) {
            console.log(`[EVOLUTION-WEBHOOK] 🤖 Triggering automation for message ${savedMessageId}`);

            setTimeout(async () => {
                try {
                    if (txResult.aiActive === false) {
                        console.log(`[EVOLUTION-WEBHOOK] 🛑 AI disabled for conversation ${conversationId}, skipping automation.`);
                    } else {
                        const resumed = await resumeFlowForContact(contactId, content, companyId);
                        if (resumed) {
                            console.log(`[EVOLUTION-WEBHOOK] 🔄 Resumed paused flow for contact ${contactId}`);
                        } else {
                            console.log(`[EVOLUTION-WEBHOOK] ⏳ Executing processIncomingMessageTrigger for ${savedMessageId}...`);
                            await processIncomingMessageTrigger(conversationId, savedMessageId);
                            console.log(`[EVOLUTION-WEBHOOK] ✅ processIncomingMessageTrigger finished.`);
                        }
                    }
                } catch (err) {
                    console.error('[EVOLUTION-WEBHOOK] Erro na execução da automação:', err);
                }
            }, 500);
        }

        return NextResponse.json({ success: true, message: 'Processado com sucesso' }, { status: 200 });

    } catch (error) {
        console.error('[EVOLUTION-WEBHOOK] Fatal error:', error);
        return NextResponse.json({ error: 'Erro interno no webhook' }, { status: 500 });
    }
}

async function uploadMediaToS3Evo(info: any, companyId: string) {
    try {
        let base64String = info.base64String;
        
        if (!base64String) {
            const evoUrl = process.env.EVOLUTION_API_URL || '';
            const evoKey = process.env.EVOLUTION_API_KEY || '';
            
            if (evoUrl && evoKey) {
                const apiUrl = `${evoUrl}/chat/getBase64FromMediaMessage/${info.instanceName}`;
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': evoKey,
                    },
                    body: JSON.stringify({
                        message: info.messageData,
                        convertToMp4: false,
                    }),
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result && result.base64) {
                        base64String = result.base64;
                    }
                } else {
                    console.error(`[EVOLUTION-WEBHOOK] Failed to fetch base64: ${response.status} ${await response.text()}`);
                }
            }
        }
        
        if (base64String) {
            const cleanBase64 = base64String.replace(/^data:.*?;base64,/, '').replace(/\s+/g, '');
            const buffer = Buffer.from(cleanBase64, 'base64');
            const fileKey = `chat-media/${info.conversationId}/${Date.now()}_${info.fileName}`;
            const mediaUrl = await uploadFileToS3(companyId, fileKey, buffer, info.mimeType);
            
            if (mediaUrl) {
                console.log(`[EVOLUTION-WEBHOOK] Media uploaded to S3: ${mediaUrl}`);
                await db.update(messages).set({ mediaUrl }).where(eq(messages.id, info.messageId));
                emitToCompany(companyId, 'chat:message-updated', { messageId: info.messageId, mediaUrl });
            }
        }
    } catch (err) {
        console.error(`[EVOLUTION-WEBHOOK] Error in async media upload:`, err);
    }
}
