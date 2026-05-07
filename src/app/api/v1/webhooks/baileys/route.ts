import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';
import { resumeFlowForContact } from '@/lib/flow-engine';
import { emitToCompany } from '@/lib/socket';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { companyId, data } = body;

        if (!companyId || !data || !data.conversationId) {
            return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
        }

        // 1. IGNORAR TRANSCRIÇÃO ANTECIPADA
        // Se for áudio, limpar a transcrição do microserviço para ativar o player nativo na UI
        if (data.messageType?.toUpperCase() === 'AUDIO') {
            data.messageContent = '🎵 Áudio';
            // Como o whatsmeow-service grava no DB antes de enviar o webhook, precisamos sobrescrever:
            try {
                await db.update(messages)
                    .set({ content: '🎵 Áudio' })
                    .where(eq(messages.id, data.savedMessageId));
            } catch (err) {
                console.error('[BAILEYS-WEBHOOK] Falha ao sanitizar transcrição prévia no DB:', err);
            }
        }

        // 2. EMITIR EVENTOS REALTIME IMEDIATOS
        try {
            emitToCompany(companyId, 'chat:new-message', {
                conversationId: data.conversationId,
                messageId: data.savedMessageId,
                connectionId: data.connectionId,
                contactPhone: data.contactPhone,
                contactName: data.contactName,
                content: data.messageContent,
                contentType: data.messageType?.toUpperCase() || 'TEXT',
                isFromMe: data.isFromMe,
                senderType: data.isFromMe ? 'AGENT' : 'CONTACT',
                mediaUrl: data.mediaUrl,
                timestamp: new Date().toISOString(),
            });
            emitToCompany(companyId, 'inbox:update', { timestamp: Date.now() });
        } catch (err) {
            console.error('[BAILEYS-WEBHOOK] Erro ao emitir eventos realtime:', err);
        }

        // 3. TRIGGER AUTOMATION ENGINE (Apenas se a mensagem não for do agente)
        if (!data.isFromMe) {
            console.log(`[BAILEYS-WEBHOOK] 🤖 Triggering automation for message ${data.savedMessageId}`);

            try {
                // Buscar dados da conversa para obter contactId, companyId e aiActive
                const [conv] = await db.select({
                    contactId: conversations.contactId,
                    companyId: conversations.companyId,
                    aiActive: conversations.aiActive,
                })
                    .from(conversations)
                    .where(eq(conversations.id, data.conversationId))
                    .limit(1);

                if (!conv) {
                    console.warn(`[BAILEYS-WEBHOOK] ⚠️ Conversation not found: ${data.conversationId}`);
                } else if (conv.aiActive === false) {
                    console.log(`[BAILEYS-WEBHOOK] 🛑 AI disabled for conversation ${data.conversationId}, skipping automation.`);
                } else {
                    // Tentar retomar fluxo pausado primeiro
                    const resumed = await resumeFlowForContact(conv.contactId, data.messageContent || '', conv.companyId);
                    if (resumed) {
                        console.log(`[BAILEYS-WEBHOOK] 🔄 Resumed paused flow for contact ${conv.contactId}`);
                    } else {
                        // Se não retomou, dispara trigger de nova mensagem (AWAIT para evitar que Vercel mate o contexto)
                        console.log(`[BAILEYS-WEBHOOK] ⏳ Executing processIncomingMessageTrigger for ${data.savedMessageId}...`);
                        await processIncomingMessageTrigger(data.conversationId, data.savedMessageId);
                        console.log(`[BAILEYS-WEBHOOK] ✅ processIncomingMessageTrigger finished.`);
                    }
                }
            } catch (err) {
                console.error('[BAILEYS-WEBHOOK] Erro na execução da automação:', err);
            }
        }

        // 4. PROCESS MEDIA IN BACKGROUND (Se houver)
        if (data.mediaUrl && data.savedMessageId) {
            try {
                console.log(`[BAILEYS-WEBHOOK] ⏳ Executing processMediaInBackground for ${data.savedMessageId}...`);
                await processMediaInBackground(data.savedMessageId, data.mediaUrl, data.messageType, data.conversationId);
            } catch (err) {
                console.error(`[BAILEYS-WEBHOOK] ❌ Background media processing error:`, err);
            }
        }

        return NextResponse.json({ success: true, message: 'Processado com sucesso' }, { status: 200 });

    } catch (error) {
        console.error('[BAILEYS-WEBHOOK] Fatal error:', error);
        return NextResponse.json({ error: 'Erro interno no webhook' }, { status: 500 });
    }
}

// ✅ Background media processing: download from temporary URL, upload to S3, update DB
async function processMediaInBackground(
    messageId: string,
    mediaUrl: string,
    messageType: string,
    conversationId: string,
): Promise<void> {
    try {
        // Skip if already an S3 URL
        if (mediaUrl.includes('s3.') || mediaUrl.includes('cloudfront.net') || mediaUrl.includes('amazonaws.com')) {
            return;
        }

        console.log(`[BAILEYS-WEBHOOK] 📸 Processing media for message ${messageId}...`);

        let fetchUrl = mediaUrl;
        try {
            const urlObj = new URL(mediaUrl);
            const isLocal = urlObj.hostname === '127.0.0.1' || urlObj.hostname === 'localhost';
            // Rewrite URL if it points to a local address or a generic railway domain that might be inaccessible directly
            if (isLocal || urlObj.hostname.includes('railway.app') || urlObj.hostname.includes('railway.internal')) {
                const BAILEYS_SERVICE_URL = process.env.BAILEYS_SERVICE_URL || 'http://localhost:3001';
                if (BAILEYS_SERVICE_URL) {
                    const serviceUrlObj = new URL(BAILEYS_SERVICE_URL);
                    fetchUrl = `${serviceUrlObj.origin}${urlObj.pathname}${urlObj.search}`;
                    console.log(`[BAILEYS-WEBHOOK] 🔄 Rewrote media URL: ${mediaUrl} -> ${fetchUrl}`);
                }
            }
        } catch (err) {
            console.warn(`[BAILEYS-WEBHOOK] ⚠️ Invalid media URL format: ${mediaUrl}`);
        }

        const mediaResponse = await fetch(fetchUrl, { signal: AbortSignal.timeout(30_000) });
        if (!mediaResponse.ok) {
            console.warn(`[BAILEYS-WEBHOOK] ⚠️ Failed to download media: ${mediaResponse.statusText}`);
            return;
        }

        const arrayBuffer = await mediaResponse.arrayBuffer();
        const mediaBuffer = Buffer.from(arrayBuffer);

        if (mediaBuffer.length === 0) {
            console.warn('[BAILEYS-WEBHOOK] ⚠️ Empty media buffer, skipping');
            return;
        }

        const { uploadFileToS3 } = await import('@/lib/s3');
        const { v4: uuidv4 } = await import('uuid');

        let extension = 'bin';
        if (messageType.toLowerCase().includes('image')) extension = 'jpg';
        else if (messageType.toLowerCase().includes('video')) extension = 'mp4';
        else if (messageType.toLowerCase().includes('audio')) extension = 'ogg';
        else if (messageType.toLowerCase().includes('document')) extension = 'pdf';

        const s3Key = `media_baileys/${uuidv4()}.${extension}`;
        const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';

        // We need companyId for S3 upload — get it from the conversation
        const [conv] = await db.select({ companyId: conversations.companyId })
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);

        if (!conv) return;

        const s3Url = await uploadFileToS3(conv.companyId, s3Key, mediaBuffer, contentType);

        if (s3Url) {
            await db.update(messages)
                .set({ mediaUrl: s3Url })
                .where(eq(messages.id, messageId));

            // Update the conversation's lastMessageAt so the frontend polling detects the change
            await db.update(conversations)
                .set({
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(conversations.id, conversationId));

            console.log(`[BAILEYS-WEBHOOK] ✅ Media uploaded to S3 and DB updated: ${s3Url}`);

            // Notificar frontend via SSE/Socket.IO (scoped por empresa)
            const { emitToCompany } = await import('@/lib/socket');
            // Fast-path: atualizar a URL de mídia na mensagem sem refetch
            emitToCompany(conv.companyId, 'chat:message-updated', {
                messageId,
                conversationId,
                mediaUrl: s3Url,
            });
            // Slow-path: force refresh
            emitToCompany(conv.companyId, 'inbox:update', { timestamp: Date.now() });
        }
    } catch (error) {
        console.error('[BAILEYS-WEBHOOK] ❌ Error processing background media:', error);
    }
}
