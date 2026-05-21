// src/app/api/v1/conversations/[conversationId]/messages/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { conversations, messages, contacts, templates, connections, messageReactions } from '@/lib/db/schema';
import { eq, and, desc, inArray, lt, or } from 'drizzle-orm';
import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';
import { sendWhatsappTemplateMessage, sendWhatsappTextMessage } from '@/lib/facebookApiService';
import { evolutionApiService } from '@/services/evolution-api.service';
import { z } from 'zod';
import { subHours } from 'date-fns';
import type { MetaApiMessageResponse } from '@/lib/types';

const textMessageSchema = z.object({
    type: z.literal('text'),
    text: z.string().min(1, 'A mensagem não pode estar em branco.'),
});

const templateMessageSchema = z.object({
    type: z.literal('template'),
    templateId: z.string().uuid('ID do modelo inválido.'),
    variableMappings: z.record(z.any()).optional(),
});

const messageSchema = z.union([textMessageSchema, templateMessageSchema]);

async function canSendFreeFormMessage(conversationId: string, companyId: string): Promise<boolean> {
    // SECURITY: Validar tenant ao buscar última mensagem do contato
    // ✅ FIX: Meta API webhook salva mensagens do contato como 'CONTACT',
    //    enquanto Baileys antigo usava 'USER'. Aceitar ambos para compatibilidade.
    const [lastUserMessage] = await db.select()
        .from(messages)
        .where(and(
            eq(messages.conversationId, conversationId),
            eq(messages.companyId, companyId),
            inArray(messages.senderType, ['USER', 'CONTACT'])
        ))
        .orderBy(desc(messages.sentAt))
        .limit(1);

    if (!lastUserMessage) {
        return false;
    }

    const twentyFourHoursAgo = subHours(new Date(), 24);
    return new Date(lastUserMessage.sentAt) > twentyFourHoursAgo;
}


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }): Promise<NextResponse> {
    try {
        const companyId = await getCompanyIdFromSession();
        const { conversationId } = await params;

        // [SECURITY] Validate Multi-Tenant Ownership
        // Prevents IDOR: Users can only see messages from their own company's conversations
        const [isValidConversation] = await db.select({ id: conversations.id })
            .from(conversations)
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ))
            .limit(1);

        if (!isValidConversation) {
            return NextResponse.json({ error: 'Conversa não encontrada ou sem permissão.' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);

        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
        const before = searchParams.get('before');

        // SECURITY: Validar tenant ao buscar mensagens
        const conditions = [
            eq(messages.conversationId, conversationId),
            eq(messages.companyId, companyId)
        ];

        if (before) {
            const beforeDate = new Date(before);
            if (isNaN(beforeDate.getTime())) {
                return NextResponse.json({
                    error: 'Parâmetro "before" inválido. Deve ser um timestamp ISO válido.'
                }, { status: 400 });
            }
            conditions.push(lt(messages.sentAt, beforeDate));
        }

        const conversationMessages = await db.select()
            .from(messages)
            .where(and(...conditions))
            .orderBy(desc(messages.sentAt))
            .limit(limit + 1);

        const hasMore = conversationMessages.length > limit;
        const messagesToReturn = hasMore ? conversationMessages.slice(0, limit) : conversationMessages;

        const sortedMessages = [...messagesToReturn].reverse();

        const messageIds = sortedMessages.map(m => m.id);
        // SECURITY: Validar tenant ao buscar reações (via messages que já estão filtrados por companyId)
        // Note: messageReactions não tem companyId direto, mas está implicitamente protegido via messageIds
        // que já foram filtrados por companyId acima
        const reactions = messageIds.length > 0
            ? await db.select().from(messageReactions).where(inArray(messageReactions.messageId, messageIds))
            : [];

        const messagesWithReactions = sortedMessages.map(msg => ({
            ...msg,
            reactions: reactions.filter(r => r.messageId === msg.id).map(r => ({
                emoji: r.emoji,
                reactorPhone: r.reactorPhone,
                reactorName: r.reactorName,
            })),
        }));

        const lastMessage = messagesToReturn[messagesToReturn.length - 1];
        const nextBefore = hasMore && lastMessage
            ? lastMessage.sentAt.toISOString()
            : null;

        return NextResponse.json({
            messages: messagesWithReactions,
            hasMore,
            nextBefore
        });
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        return NextResponse.json({ error: 'Erro interno ao buscar mensagens.' }, { status: 500 });
    }
}


export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }): Promise<NextResponse> {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) {
            return NextResponse.json({ error: 'Empresa não autenticada.' }, { status: 401 });
        }
        const agentId = await getUserIdFromSession();
        if (!agentId) {
            return NextResponse.json({ error: 'Agente não autenticado.' }, { status: 401 });
        }

        const { conversationId } = await params;
        const body = await request.json();
        const parsedBody = messageSchema.safeParse(body);

        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Dados da mensagem inválidos.', details: parsedBody.error.flatten() }, { status: 400 });
        }

        // [QUOTA CHECK] Verify message allowance
        const { QuotaService } = await import('@/lib/quotas');
        const quotaCheck = await QuotaService.checkQuota(companyId, 'messages');
        if (!quotaCheck.success) {
            return NextResponse.json({ error: quotaCheck.message }, { status: 403 });
        }

        const [conversation] = await db.select({
            id: conversations.id,
            companyId: conversations.companyId,
            contactId: conversations.contactId,
            connectionId: conversations.connectionId,
            status: conversations.status,
            createdAt: conversations.createdAt,
            updatedAt: conversations.updatedAt,
            lastMessageAt: conversations.lastMessageAt,
            assignedTo: conversations.assignedTo,
            archivedAt: conversations.archivedAt,
            archivedBy: conversations.archivedBy,
        }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

        if (!conversation) {
            return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 });
        }

        // SECURITY: Validar tenant ao buscar contato
        const [contact] = await db.select().from(contacts).where(and(
            eq(contacts.id, conversation.contactId),
            eq(contacts.companyId, companyId)
        ));
        if (!contact) {
            return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
        }

        if (!conversation.connectionId) {
            return NextResponse.json({ error: 'A conversa não está associada a nenhuma conexão.' }, { status: 400 });
        }

        // SECURITY: Validar tenant ao buscar conexão
        const [connection] = await db.select().from(connections).where(and(
            eq(connections.id, conversation.connectionId),
            eq(connections.companyId, companyId)
        ));
        if (!connection) {
            return NextResponse.json({ error: 'Conexão não encontrada.' }, { status: 404 });
        }

        let sentMessageResponse: any;
        let providerMessageId: string | null | undefined;
        let templateName = 'Mensagem de Texto';

        if (parsedBody.data.type === 'text') {
            // SECURITY: Passar companyId para validação de tenant
            const canSend = await canSendFreeFormMessage(conversation.id, companyId);
            if (!canSend) {
                return NextResponse.json({ error: 'A janela de 24 horas para resposta livre expirou. Use um modelo.' }, { status: 403 });
            }

            if (['baileys', 'evolution'].includes(connection.connectionType)) {
                const result = await evolutionApiService.sendMessage(
                    conversation.connectionId, 
                    contact.phone, 
                    parsedBody.data.text
                );
                providerMessageId = result?.key?.id;
                if (!providerMessageId) {
                    return NextResponse.json({ error: 'Falha ao enviar mensagem - instância não conectada ou erro na Evolution API.' }, { status: 500 });
                }
            } else if (connection.connectionType === 'meta_api') {
                sentMessageResponse = await sendWhatsappTextMessage({
                    connectionId: conversation.connectionId,
                    to: contact.phone,
                    text: parsedBody.data.text
                });
                providerMessageId = (sentMessageResponse as unknown as MetaApiMessageResponse).messages?.[0]?.id;
            } else if (connection.connectionType === 'instagram') {
                // Import dynamically to avoid circular deps if any (though strict deps shouldn't be an issue here)
                const { sendInstagramMessage } = await import('@/lib/instagram-sender');
                // Use 'externalId' as the IGSID. If not present, fallback to phone (if we used phone column for igsid)
                // In our plan we said "phone" might have "ig:" prefix or we use externalId.
                // Let's assume for now the proper IGSID is in externalId OR we strip "ig:" from phone.
                let recipientId = contact.externalId || contact.phone.replace('ig:', '');

                // Safety check: remove non-numeric chars if it looks like a phone number but SHOULD be an ID? 
                // Creating a robust check: if contact.externalProvider === 'instagram', use externalId.
                if (contact.externalProvider === 'instagram' && contact.externalId) {
                    recipientId = contact.externalId;
                }

                const result = await sendInstagramMessage(
                    conversation.connectionId,
                    recipientId,
                    { text: parsedBody.data.text }
                );

                if (result.error) {
                    return NextResponse.json({ error: `Falha no envio Instagram: ${result.error}` }, { status: 500 });
                }
                providerMessageId = result.messageId;
            } else {
                return NextResponse.json({ error: 'Tipo de conexão não suportado.' }, { status: 400 });
            }
        } else {
            if (['baileys', 'evolution'].includes(connection.connectionType) || connection.connectionType === 'instagram') {
                return NextResponse.json({ error: 'Envio de templates não suportado para esta conexão. Use mensagens de texto.' }, { status: 400 });
            }

            // SECURITY: Validar tenant ao buscar template
            const [template] = await db.select().from(templates).where(and(
                eq(templates.id, parsedBody.data.templateId),
                eq(templates.companyId, companyId)
            ));
            if (!template) {
                return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 });
            }
            templateName = template.name;
            const components: any[] = [];
            sentMessageResponse = await sendWhatsappTemplateMessage({
                connectionId: conversation.connectionId,
                to: contact.phone,
                templateName: template.name,
                languageCode: template.language,
                components,
            });
            providerMessageId = (sentMessageResponse as unknown as MetaApiMessageResponse).messages?.[0]?.id;
        }

        const [savedMessage] = await db.insert(messages).values({
            companyId,
            conversationId: conversation.id,
            connectionId: conversation.connectionId,
            providerMessageId,
            senderType: 'AGENT',
            senderId: agentId,
            content: parsedBody.data.type === 'text' ? parsedBody.data.text : `Template: ${templateName}`,
            contentType: parsedBody.data.type.toUpperCase(),
            status: 'SENT',
        }).onConflictDoUpdate({
            target: messages.providerMessageId,
            set: {
                status: 'SENT',
                senderId: agentId,
                connectionId: conversation.connectionId,
            }
        }).returning();

        if (!savedMessage) {
            return NextResponse.json({ error: 'Falha ao salvar a mensagem no banco de dados.' }, { status: 500 });
        }

        // [QUOTA INCREMENT]
        await QuotaService.incrementUsage(companyId, 'messages');

        // SECURITY: Validar tenant ao atualizar conversa (já validado acima, mas garantindo segurança)
        await db.update(conversations).set({ lastMessageAt: new Date(), updatedAt: new Date() }).where(and(
            eq(conversations.id, conversation.id),
            eq(conversations.companyId, companyId)
        ));

        return NextResponse.json(savedMessage, { status: 201 });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return NextResponse.json({ error: 'Erro interno ao enviar mensagem.' }, { status: 500 });
    }
}
