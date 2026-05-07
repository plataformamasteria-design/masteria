import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connections, conversations, messages, contacts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';
import { resumeFlowForContact } from '@/lib/flow-engine';
import { emitToCompany } from '@/lib/socket';
import { uploadFileToS3 } from '@/lib/s3';


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
            content = '🖼️ Sticker';
            messageType = 'IMAGE';
            mimeType = messageObj.stickerMessage.mimetype || 'image/webp';
            fileName = 'sticker.webp';
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

        // 2. Garantir que o Contato existe
        let contact = await db.query.contacts.findFirst({
            where: and(eq(contacts.companyId, companyId), eq(contacts.phone, phone))
        });

        if (!contact) {
            const [newContact] = await db.insert(contacts).values({
                companyId,
                name: pushName,
                whatsappName: pushName,
                phone: phone,
                status: 'ACTIVE'
            }).returning();
            contact = newContact;
        }

        // 3. Garantir que a Conversa existe
        let conversation = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.companyId, companyId),
                eq(conversations.contactId, contact.id)
            )
        });

        if (!conversation) {
            const [newConv] = await db.insert(conversations).values({
                companyId,
                contactId: contact.id,
                connectionId: connection.id,
                status: 'NEW',
            }).returning();
            conversation = newConv;
        } else {
            // Atualizar lastMessageAt da conversa
            await db.update(conversations)
                .set({ lastMessageAt: new Date() })
                .where(eq(conversations.id, conversation.id));
        }

        const conversationId = conversation.id;

        // 3.5 Processar mídia se necessário
        if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(messageType)) {
            try {
                let base64String = data.base64 || messageObj.base64 || messageObj.imageMessage?.base64 || messageObj.videoMessage?.base64 || messageObj.audioMessage?.base64 || messageObj.documentMessage?.base64 || messageObj.stickerMessage?.base64;
                
                if (!base64String) {
                    const evoUrl = process.env.EVOLUTION_API_URL || '';
                    const evoKey = process.env.EVOLUTION_API_KEY || '';
                    
                    if (evoUrl && evoKey) {
                        const apiUrl = `${evoUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': evoKey,
                            },
                            body: JSON.stringify({
                                message: data,
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
                    const fileKey = `chat-media/${conversationId}/${Date.now()}_${fileName}`;
                    mediaUrl = await uploadFileToS3(companyId, fileKey, buffer, mimeType);
                    console.log(`[EVOLUTION-WEBHOOK] Media uploaded to S3: ${mediaUrl}`);
                }
            } catch (mediaErr) {
                console.error(`[EVOLUTION-WEBHOOK] Error processing media:`, mediaErr);
            }
        }

        // 4. Inserir a Mensagem no DB
        // Verificar se a mensagem já existe para evitar duplicatas
        const existingMessage = await db.query.messages.findFirst({
            where: eq(messages.providerMessageId, messageId)
        });

        let savedMessageId = existingMessage?.id;

        if (!existingMessage) {
            const [newMsg] = await db.insert(messages).values({
                companyId,
                conversationId,
                providerMessageId: messageId,
                senderType: fromMe ? 'AGENT' : 'CONTACT',
                content: content,
                contentType: messageType,
                mediaUrl: mediaUrl,
                status: fromMe ? 'SENT' : 'RECEIVED'
            }).returning();
            
            savedMessageId = newMsg.id;
        }

        if (!savedMessageId) {
             return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
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
                mediaUrl: mediaUrl,
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

            try {
                if (conversation.aiActive === false) {
                    console.log(`[EVOLUTION-WEBHOOK] 🛑 AI disabled for conversation ${conversationId}, skipping automation.`);
                } else {
                    const resumed = await resumeFlowForContact(contact.id, content, companyId);
                    if (resumed) {
                        console.log(`[EVOLUTION-WEBHOOK] 🔄 Resumed paused flow for contact ${contact.id}`);
                    } else {
                        console.log(`[EVOLUTION-WEBHOOK] ⏳ Executing processIncomingMessageTrigger for ${savedMessageId}...`);
                        await processIncomingMessageTrigger(conversationId, savedMessageId);
                        console.log(`[EVOLUTION-WEBHOOK] ✅ processIncomingMessageTrigger finished.`);
                    }
                }
            } catch (err) {
                console.error('[EVOLUTION-WEBHOOK] Erro na execução da automação:', err);
            }
        }



        return NextResponse.json({ success: true, message: 'Processado com sucesso' }, { status: 200 });

    } catch (error) {
        console.error('[EVOLUTION-WEBHOOK] Fatal error:', error);
        return NextResponse.json({ error: 'Erro interno no webhook' }, { status: 500 });
    }
}
