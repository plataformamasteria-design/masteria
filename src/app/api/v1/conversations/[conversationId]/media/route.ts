import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { conversations, messages, contacts, connections } from '@/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';
import { uploadFileToS3 } from '@/lib/s3';
import { evolutionApiService } from '@/services/evolution-api.service';
import { sendWhatsappMediaMessage } from '@/lib/facebookApiService';
import { v4 as uuidv4 } from 'uuid';
import { subHours } from 'date-fns';

export const dynamic = 'force-dynamic';

async function canSendFreeFormMessage(conversationId: string, companyId: string): Promise<boolean> {
    const [lastUserMessage] = await db.select()
        .from(messages)
        .where(and(
            eq(messages.conversationId, conversationId),
            eq(messages.companyId, companyId),
            inArray(messages.senderType, ['USER', 'CONTACT'])
        ))
        .orderBy(desc(messages.sentAt))
        .limit(1);

    if (!lastUserMessage) return false;
    return new Date(lastUserMessage.sentAt) > subHours(new Date(), 24);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const agentId = await getUserIdFromSession();
        if (!companyId || !agentId) {
            return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
        }

        const { conversationId } = await params;
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        
        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
        }

        const [conversation] = await db.select().from(conversations).where(and(
            eq(conversations.id, conversationId), eq(conversations.companyId, companyId)
        ));
        
        if (!conversation || !conversation.connectionId) {
            return NextResponse.json({ error: 'Conversa ou conexão não encontrada.' }, { status: 404 });
        }

        const [connection] = await db.select().from(connections).where(and(
            eq(connections.id, conversation.connectionId), eq(connections.companyId, companyId)
        ));
        
        const [contact] = await db.select().from(contacts).where(and(
            eq(contacts.id, conversation.contactId), eq(contacts.companyId, companyId)
        ));

        if (!connection || !contact) {
            return NextResponse.json({ error: 'Dados da conexão ou contato ausentes.' }, { status: 404 });
        }

        const isMeta = connection.connectionType === 'meta_api';
        if (isMeta && !(await canSendFreeFormMessage(conversation.id, companyId))) {
            return NextResponse.json({ error: 'A janela de 24 horas para resposta livre expirou. Use um modelo.' }, { status: 403 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const mimeType = file.type;
        const fileName = file.name;
        
        let type: 'image' | 'video' | 'document' | 'audio' = 'document';
        let contentType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' = 'DOCUMENT';
        
        if (mimeType.startsWith('image/')) { type = 'image'; contentType = 'IMAGE'; }
        else if (mimeType.startsWith('video/')) { type = 'video'; contentType = 'VIDEO'; }
        else if (mimeType.startsWith('audio/')) { type = 'audio'; contentType = 'AUDIO'; }

        // Sobe para o S3
        const fileExt = fileName.split('.').pop();
        const fileKey = `attachments/${companyId}/${conversationId}/${uuidv4()}.${fileExt}`;
        const mediaUrl = await uploadFileToS3(companyId, fileKey, buffer, mimeType);

        let providerMessageId: string | undefined;

        let finalBuffer = buffer;
        let metaMimeType = mimeType;
        let finalFileName = fileName;

        // Se for áudio e estiver em WebM (gravado pelo Chrome/Edge) ou MP4, transcodifica obrigatoriamente para OGG/Opus
        if (type === 'audio' && (mimeType.includes('webm') || mimeType.includes('mp4'))) {
            try {
                const { convertToOgg } = await import('@/lib/ffmpeg');
                finalBuffer = await convertToOgg(buffer);
                metaMimeType = 'audio/ogg'; // O arquivo gerado já tem Opus internamente. Não use "; codecs=opus" aqui.
                finalFileName = fileName.replace(/\.(webm|mp4)$/, '.ogg');
            } catch (err) {
                console.error('Falha ao transcodificar áudio:', err);
                // Fallback para o buffer original em caso de erro no FFmpeg
            }
        } else if (type === 'audio' && mimeType.includes('ogg')) {
            metaMimeType = 'audio/ogg'; // Mesma regra.
        }

        if (['baileys', 'evolution'].includes(connection.connectionType)) {
            const base64Media = finalBuffer.toString('base64');
            const result = await evolutionApiService.sendMedia(
                connection.sessionName || connection.id,
                contact.phone,
                type,
                base64Media,
                undefined, // caption
                finalFileName,  // fileName
                metaMimeType    // mimetype
            );
            providerMessageId = result?.key?.id;
        } else if (connection.connectionType === 'meta_api') {
            const result = await sendWhatsappMediaMessage({
                connectionId: connection.id,
                to: contact.phone,
                type,
                mediaBuffer: finalBuffer,
                mimeType: metaMimeType,
                filename: finalFileName,
                caption: undefined, // Remove a legenda
                isVoice: type === 'audio' // Força o envio como gravação de voz PTT na Meta API
            });
            providerMessageId = (result as any).messages?.[0]?.id;
        } else {
            return NextResponse.json({ error: 'Tipo de conexão não suportado.' }, { status: 400 });
        }

        const [savedMessage] = await db.insert(messages).values({
            companyId,
            conversationId: conversation.id,
            providerMessageId,
            senderType: 'AGENT',
            senderId: agentId,
            content: fileName,
            contentType,
            mediaUrl,
            status: 'SENT',
        }).returning();

        await db.update(conversations)
            .set({ lastMessageAt: new Date(), updatedAt: new Date() })
            .where(eq(conversations.id, conversation.id));

        return NextResponse.json(savedMessage, { status: 201 });
    } catch (error) {
        console.error('Erro ao enviar mídia:', error);
        return NextResponse.json({ error: 'Erro interno ao enviar mídia.' }, { status: 500 });
    }
}
