'use server';

import { db } from '@/lib/db';
import { conversations, messages, messageTemplates, connections, contacts, users } from '@/lib/db/schema';
import { eq, and, desc, not, sql, inArray } from 'drizzle-orm';
import { getUserIdFromSession, getCompanyIdFromSession } from '@/app/actions';
import { revalidatePath } from 'next/cache';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';
import { z } from 'zod';
import { emitInboxUpdate } from '@/lib/socket';

const SendMessageSchema = z.object({
    conversationId: z.string().min(1),
    content: z.string().min(1, "Não é possível enviar mensagens vazias").max(5000, "Mensagem longa demais"),
    isInternalNote: z.boolean().optional()
});

const ToggleAiSchema = z.object({
    conversationId: z.string().min(1),
    aiActive: z.boolean()
});

const SwitchConnectionSchema = z.object({
    conversationId: z.string().min(1),
    newConnectionId: z.string().min(1)
});

const SyncHistorySchema = z.object({
    conversationId: z.string().min(1)
});

export async function sendMessageAction(conversationIdRaw: string, contentRaw: string, isInternalNoteRaw?: boolean) {
    try {
        const { conversationId, content, isInternalNote } = SendMessageSchema.parse({ conversationId: conversationIdRaw, content: contentRaw, isInternalNote: isInternalNoteRaw });

        const userId = await getUserIdFromSession();
        const companyId = await getCompanyIdFromSession();

        // 1. Validate Conversation & Ownership + Get Connection/Contact Info
        const [conversationResult] = await db.select({
            id: conversations.id,
            companyId: conversations.companyId,
            connectionId: conversations.connectionId,
            contactPhone: contacts.phone,
            connectionType: connections.connectionType
        })
            .from(conversations)
            .leftJoin(contacts, eq(conversations.contactId, contacts.id))
            .leftJoin(connections, eq(conversations.connectionId, connections.id))
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ))
            .limit(1);

        if (!conversationResult || !conversationResult.contactPhone) {
            throw new Error("Conversa ou contato não encontrado.");
        }

        // Reconstruct expected object format
        const conversation = {
            id: conversationResult.id,
            connectionId: conversationResult.connectionId,
            contact: { phone: conversationResult.contactPhone },
            connection: { connectionType: conversationResult.connectionType }
        };

        // 2. Prepare Payload
        // We need the connectionId associated with this conversation. 
        // Assuming conversation.connectionId exists (it should).
        if (!conversation.connectionId) {
            throw new Error("Conversa sem conexão associada.");
        }

        // 3. Send
        let providerMessageId = null;
        let finalContent = content;

        if (isInternalNote) {
            // Empacota a nota interna com o nome do agente
            const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
            finalContent = JSON.stringify({
                text: content,
                authorName: user?.name || 'Agente'
            });
        } else {
            // Determinar provedor com base no tipo de conexão
            const provider = ['baileys', 'evolution'].includes(conversation.connection?.connectionType || '') ? 'baileys' : 'apicloud';

            const result = await sendUnifiedMessage({
                provider: provider,
                connectionId: conversation.connectionId,
                to: conversation.contact.phone, // Assuming phone acts as UID
                message: content,
            });

            if (!result.success) {
                throw new Error(result.error || "Erro ao enviar mensagem.");
            }
            providerMessageId = result.messageId;
        }

        // 4. Persist to DB immediately
        const savedMsg = await db.transaction(async (tx) => {
            const [inserted] = await tx.insert(messages).values({
                companyId: companyId,
                conversationId: conversation.id,
                connectionId: conversation.connectionId,
                providerMessageId: providerMessageId,
                senderType: 'AGENT',
                senderId: userId,
                content: finalContent,
                contentType: isInternalNote ? 'INTERNAL_NOTE' : 'TEXT',
                status: 'SENT',
                sentAt: new Date(),
            }).onConflictDoUpdate({
                target: messages.providerMessageId,
                set: {
                    senderType: 'AGENT',
                    senderId: userId,
                    status: 'SENT'
                }
            }).returning({ id: messages.id });

            await tx.update(conversations)
                .set({ lastMessageAt: new Date() })
                .where(eq(conversations.id, conversation.id));

            return inserted;
        });

        revalidatePath('/atendimentos');
        emitInboxUpdate(companyId);
        return { success: true, messageId: providerMessageId, dbId: savedMsg?.id };
    } catch (error: unknown) {
        console.error("SendMessageAction Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Erro interno ao enviar mensagem." };
    }
}

export async function fetchInitialConversations() {
    try {
        const companyId = await getCompanyIdFromSession();
        const userId = await getUserIdFromSession();

        const [user] = await db.select({ role: users.role, permissions: users.permissions }).from(users).where(eq(users.id, userId));
        const isLimited = user?.role === 'atendente' && (user.permissions as any)?.viewMode === 'assigned_only';

        const conditions = [
            eq(conversations.companyId, companyId),
            not(eq(conversations.status, 'archived'))
        ];

        if (isLimited) {
            conditions.push(eq(conversations.assignedTo, userId));
        }

        const baseConvos = await db.select({ id: conversations.id })
            .from(conversations)
            .innerJoin(contacts, eq(conversations.contactId, contacts.id))
            .where(and(...conditions))
            .orderBy(desc(conversations.lastMessageAt))
            .limit(50);

        if (baseConvos.length === 0) return [];
        const convoIds = baseConvos.map(c => c.id);

        const companyConversations = await db.select({
            id: conversations.id,
            status: conversations.status,
            aiActive: conversations.aiActive,
            lastMessageAt: conversations.lastMessageAt,
            contactId: contacts.id,
            contactName: contacts.name,
            contactAvatar: contacts.avatarUrl,
            phone: contacts.phone,
            isGroup: contacts.isGroup,
            connectionName: connections.config_name,
            connectionType: connections.connectionType,
            source: conversations.source,
            assignedTo: conversations.assignedTo,
            teamId: conversations.teamId,
            assignedUserName: sql<string | null>`(
                SELECT users.name 
                FROM users 
                WHERE users.id = ${conversations.assignedTo}
            )`.as('assigned_user_name'),
            tags: sql<any>`(
                SELECT json_agg(json_build_object('id', tags.id, 'name', tags.name, 'color', tags.color))
                FROM contacts_to_tags 
                INNER JOIN tags ON contacts_to_tags.tag_id = tags.id 
                WHERE contacts_to_tags.contact_id = ${conversations.contactId}
            )`.as('tags'),
            lastMessage: sql<string | null>`(
                    SELECT content 
                    FROM ${messages} 
                    WHERE ${messages.conversationId} = ${conversations.id} 
                    AND ${messages.companyId} = ${conversations.companyId}
                    ORDER BY ${messages.sentAt} DESC 
                    LIMIT 1
                )`.as('last_message'),
            lastMessageStatus: sql<string | null>`(
                    SELECT status 
                    FROM ${messages} 
                    WHERE ${messages.conversationId} = ${conversations.id} 
                    AND ${messages.companyId} = ${conversations.companyId}
                    ORDER BY ${messages.sentAt} DESC 
                    LIMIT 1
                )`.as('last_message_status'),
            lastMessageSenderType: sql<string | null>`(
                    SELECT sender_type 
                    FROM ${messages} 
                    WHERE ${messages.conversationId} = ${conversations.id} 
                    AND ${messages.companyId} = ${conversations.companyId}
                    ORDER BY ${messages.sentAt} DESC 
                    LIMIT 1
                )`.as('last_message_sender_type'),
            contactActiveConversationsCount: sql<number>`1`.as('active_count'),
            kanbanBoardName: sql<string | null>`(
                SELECT kb.name FROM kanban_leads kl
                INNER JOIN kanban_boards kb ON kl.board_id = kb.id
                WHERE kl.contact_id = ${conversations.contactId}
                ORDER BY kl.updated_at DESC LIMIT 1
            )`.as('kanban_board_name'),
            kanbanStageName: sql<string | null>`(
                SELECT kl.current_stage->>'title' FROM kanban_leads kl
                WHERE kl.contact_id = ${conversations.contactId}
                ORDER BY kl.updated_at DESC LIMIT 1
            )`.as('kanban_stage_name'),
            kanbanStageType: sql<string | null>`(
                SELECT kl.current_stage->>'type' FROM kanban_leads kl
                WHERE kl.contact_id = ${conversations.contactId}
                ORDER BY kl.updated_at DESC LIMIT 1
            )`.as('kanban_stage_type'),
        })
            .from(conversations)
            .innerJoin(contacts, eq(conversations.contactId, contacts.id))
            .leftJoin(connections, eq(conversations.connectionId, connections.id))
            .where(inArray(conversations.id, convoIds))
            .orderBy(desc(conversations.lastMessageAt));

        return JSON.parse(JSON.stringify(companyConversations));
    } catch (error) {
        console.error("FetchInitialConversations Error:", error);
        return [];
    }
}

export async function fetchConversationMessages(conversationId: string) {
    try {
        const companyId = await getCompanyIdFromSession();

        // Security Check
        const [exists] = await db.select({ id: conversations.id }).from(conversations)
            .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

        if (!exists) return [];

        const msgs = await db.query.messages.findMany({
            where: and(
                eq(messages.conversationId, conversationId),
                eq(messages.companyId, companyId)
            ),
            orderBy: [desc(messages.sentAt)],
            limit: 50
        });

        return JSON.parse(JSON.stringify(msgs.reverse())); // Return chronological
    } catch (error) {
        console.error("FetchMessages Error:", error);
        return [];
    }
}

export async function fetchTemplates() {
    try {
        const companyId = await getCompanyIdFromSession();

        const templates = await db.select().from(messageTemplates)
            .where(eq(messageTemplates.companyId, companyId));

        return JSON.parse(JSON.stringify(templates));
    } catch (error) {
        console.error("FetchTemplates Error:", error);
        return [];
    }
}

export async function toggleAiAction(conversationIdRaw: string, aiActiveRaw: boolean) {
    try {
        const { conversationId, aiActive } = ToggleAiSchema.parse({ conversationId: conversationIdRaw, aiActive: aiActiveRaw });
        const companyId = await getCompanyIdFromSession();

        const [updated] = await db.update(conversations)
            .set({ aiActive })
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ))
            .returning();

        revalidatePath('/atendimentos');
        emitInboxUpdate(companyId);
        return { success: true, conversation: JSON.parse(JSON.stringify(updated)) };
    } catch (error: unknown) {
        console.error("ToggleAI Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido." };
    }
}

export async function archiveConversationAction(conversationId: string) {
    try {
        const companyId = await getCompanyIdFromSession();

        await db.update(conversations)
            .set({
                status: 'archived',
                archivedAt: new Date()
            })
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ));

        revalidatePath('/atendimentos');
        emitInboxUpdate(companyId);
        return { success: true };
    } catch (error: unknown) {
        console.error("Archive Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Erro." };
    }
}

export async function unarchiveConversationAction(conversationId: string) {
    try {
        const companyId = await getCompanyIdFromSession();

        await db.update(conversations)
            .set({
                status: 'IN_PROGRESS',
                archivedAt: null
            })
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ));

        revalidatePath('/atendimentos');
        emitInboxUpdate(companyId);
        return { success: true };
    } catch (error: unknown) {
        console.error("Unarchive Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Erro." };
    }
}

// ==============================
// Connection Toggle (API vs Baileys)
// ==============================

export async function fetchAvailableConnections() {
    try {
        const companyId = await getCompanyIdFromSession();
        // Dynamic import to avoid circular dependencies if any
        const { evolutionApiService } = await import('@/services/evolution-api.service');

        const activeConnections = await db.query.connections.findMany({
            where: and(
                eq(connections.companyId, companyId),
                eq(connections.isActive, true)
            ),
            columns: {
                id: true,
                config_name: true,
                connectionType: true,
                phoneNumber: true,
                phone: true,
                status: true,
            }
        });

        // Enriquecer com status real e número para Baileys/Evolution
        try {
            const hasBaileys = activeConnections.some(c => ['baileys', 'evolution'].includes(c.connectionType || ''));
            if (hasBaileys) {
                const allInstances = await evolutionApiService.fetchAllInstances();
                
                for (const conn of activeConnections) {
                    if (['baileys', 'evolution'].includes(conn.connectionType || '')) {
                        const instanceData = allInstances.find((i: any) => i.name === conn.id || i.instance?.instanceName === conn.id);
                        if (instanceData) {
                            // Update status
                            if (instanceData.connectionStatus) {
                                conn.status = instanceData.connectionStatus;
                            } else if (instanceData.instance?.state) {
                                conn.status = instanceData.instance.state;
                            }
                            
                            // Extrair número do ownerJid (ex: 551199999999@s.whatsapp.net)
                            if (instanceData.ownerJid) {
                                conn.phoneNumber = instanceData.ownerJid.split('@')[0];
                            } else if (instanceData.owner) {
                                conn.phoneNumber = instanceData.owner.split('@')[0];
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[fetchAvailableConnections] Erro ao enriquecer dados Baileys:", e);
        }

        return JSON.parse(JSON.stringify(activeConnections));
    } catch (error) {
        console.error("FetchAvailableConnections Error:", error);
        return [];
    }
}

export async function switchConnectionAction(conversationIdRaw: string, newConnectionIdRaw: string) {
    try {
        const { conversationId, newConnectionId } = SwitchConnectionSchema.parse({
            conversationId: conversationIdRaw,
            newConnectionId: newConnectionIdRaw
        });
        const companyId = await getCompanyIdFromSession();

        // Validate the new connection belongs to the same company
        const connection = await db.query.connections.findFirst({
            where: and(
                eq(connections.id, newConnectionId),
                eq(connections.companyId, companyId),
                eq(connections.isActive, true)
            )
        });

        if (!connection) {
            throw new Error("Conexão não encontrada ou inativa.");
        }

        // Update the conversation's connectionId
        const [updated] = await db.update(conversations)
            .set({ connectionId: newConnectionId })
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ))
            .returning();

        if (!updated) {
            throw new Error("Conversa não encontrada.");
        }

        revalidatePath('/atendimentos');
        emitInboxUpdate(companyId);
        return {
            success: true,
            connectionType: connection.connectionType,
            connectionName: connection.config_name
        };
    } catch (error: unknown) {
        console.error("SwitchConnection Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Erro." };
    }
}

// ==============================
// Baileys History Sync
// ==============================

export async function syncBaileysHistoryAction(conversationIdRaw: string) {
    return { success: false, error: "A sincronização de histórico foi descontinuada na nova arquitetura (Evolution API)." };
}

// ==============================
// Outbound Conversation (Kanban)
// ==============================

export async function startOutboundConversationAction(contactId: string, kanbanCardId: string, connectionId: string, messageContent: string) {
    try {
        const userId = await getUserIdFromSession();
        const companyId = await getCompanyIdFromSession();

        const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId))).limit(1);
        if (!contact) throw new Error("Contato não encontrado.");

        const [connection] = await db.select().from(connections).where(and(eq(connections.id, connectionId), eq(connections.companyId, companyId))).limit(1);
        if (!connection) throw new Error("Conexão não encontrada.");

        // Dispara mensagem
        const provider = ['baileys', 'evolution'].includes(connection.connectionType || '') ? 'baileys' : 'apicloud';
        
        const result = await sendUnifiedMessage({
            provider: provider,
            connectionId: connection.id,
            to: contact.phone,
            message: messageContent,
        });

        if (!result.success) {
            throw new Error(result.error || "Erro ao enviar mensagem.");
        }

        // DB Transaction
        let savedConvId = '';
        await db.transaction(async (tx) => {
            const [existing] = await tx.select().from(conversations).where(and(eq(conversations.contactId, contact.id), not(eq(conversations.status, 'archived')))).limit(1);
            
            if (existing) {
                savedConvId = existing.id;
                // NÃO sobrescreve connectionId — mantém a conexão original da conversa
                await tx.update(conversations).set({ assignedTo: userId, lastMessageAt: new Date() }).where(eq(conversations.id, savedConvId));
            } else {
                const [newConv] = await tx.insert(conversations).values({
                    companyId,
                    contactId: contact.id,
                    connectionId,
                    assignedTo: userId,
                    status: 'IN_PROGRESS',
                    aiActive: false, // O humano assumiu
                    lastMessageAt: new Date(),
                }).returning({ id: conversations.id });
                savedConvId = newConv.id;
            }

            await tx.insert(messages).values({
                companyId,
                conversationId: savedConvId,
                connectionId,
                providerMessageId: result.messageId,
                senderType: 'AGENT',
                senderId: userId,
                content: messageContent,
                status: 'SENT',
                sentAt: new Date(),
            });
        });

        revalidatePath('/kanban');
        revalidatePath('/atendimentos');
        emitInboxUpdate(companyId);
        return { success: true, conversationId: savedConvId };
    } catch (error: unknown) {
        console.error("StartOutbound Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Erro interno ao iniciar conversa." };
    }
}
