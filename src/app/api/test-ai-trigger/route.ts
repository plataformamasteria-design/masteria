import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { messages, conversations, automationLogs, aiPersonas, connections } from '@/lib/db/schema';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';
import { eq, desc, and, gte } from 'drizzle-orm';
import { contacts } from '@/lib/db/schema';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetConversationId = searchParams.get('conversationId');
        const targetMessageId = searchParams.get('messageId');

        if (targetConversationId && targetMessageId) {
            console.log(`[Recovery] Triggering AI for conversation ${targetConversationId} and message ${targetMessageId}`);
            await processIncomingMessageTrigger(targetConversationId, targetMessageId);
            return NextResponse.json({ success: true, conversationId: targetConversationId, messageId: targetMessageId });
        }

        const [anyPersona] = await db.select().from(aiPersonas).limit(1);
        const [anyConnection] = await db.select().from(connections).limit(1);

        const companyId = anyPersona?.companyId || anyConnection?.companyId;
        if (!companyId) {
            return NextResponse.json({ error: 'No company context found (missing personas/connections)' }, { status: 404 });
        }

        const persona =
            anyPersona ||
            (await db
                .insert(aiPersonas)
                .values({
                    companyId,
                    name: 'Persona Teste (E2E)',
                    systemPrompt: 'Você é um assistente de atendimento. Responda em pt-BR de forma objetiva.',
                    provider: 'GEMINI',
                    model: 'gemini-2.0-flash-exp',
                    temperature: '0.7',
                    topP: '0.9',
                    maxOutputTokens: 512,
                    useRag: false,
                })
                .returning())[0];

        if (!persona) {
            return NextResponse.json({ error: 'Falha ao criar/encontrar persona de teste' }, { status: 500 });
        }

        const connection =
            anyConnection ||
            (await db
                .insert(connections)
                .values({
                    companyId,
                    config_name: 'Conexão Teste (E2E)',
                    connectionType: 'baileys',
                    isActive: false,
                    assignedPersonaId: persona.id,
                    environment: 'development',
                })
                .returning())[0];

        if (!connection) {
            return NextResponse.json({ error: 'Falha ao criar/encontrar conexão de teste' }, { status: 500 });
        }

        await db.update(connections)
            .set({ assignedPersonaId: persona.id })
            .where(eq(connections.id, connection.id));

        const TEST_PHONE = '5562999999999';
        const existingContacts = await db.select().from(contacts).where(and(
            eq(contacts.companyId, companyId),
            eq(contacts.phone, TEST_PHONE)
        )).limit(1);

        const contact = existingContacts[0] || (await db
            .insert(contacts)
            .values({
                companyId,
                name: 'Contato Teste',
                phone: TEST_PHONE,
                status: 'ACTIVE',
                isGroup: false,
            })
            .returning())[0];

        if (!contact) {
            return NextResponse.json({ error: 'Falha ao criar/encontrar contato de teste' }, { status: 500 });
        }

        const [conversation] = await db
            .insert(conversations)
            .values({
                companyId,
                contactId: contact.id,
                connectionId: connection.id,
                status: 'NEW',
                aiActive: true,
                assignedPersonaId: persona.id,
                contactType: 'PASSIVE',
                source: 'e2e',
                lastMessageAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning();

        if (!conversation) {
            return NextResponse.json({ error: 'Falha ao criar conversa de teste' }, { status: 500 });
        }

        // 4. Insert a new test message
        const messageId = crypto.randomUUID();
        const newMessage = {
            id: messageId,
            companyId: companyId,
            conversationId: conversation.id,
            senderType: 'USER' as const,
            senderId: 'test_user',
            content: 'Olá, gostaria de saber mais sobre os planos e preços.',
            contentType: 'TEXT' as const,
            sentAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'RECEIVED' as const,
            direction: 'INBOUND' as const
        };

        await db.insert(messages).values(newMessage);

        console.log(`[Test] Triggering AI for message ${messageId} in conversation ${conversation.id} with persona ${persona.id}`);

        const startTime = new Date();
        
        // Trigger the process
        await processIncomingMessageTrigger(conversation.id, messageId, { dryRunSend: true });

        // 5. Fetch logs
        // Wait a bit more to ensure logs are written (25s to cover delays)
        await new Promise(resolve => setTimeout(resolve, 25000));

        const logs = await db.select()
            .from(automationLogs)
            .where(and(
                eq(automationLogs.conversationId, conversation.id),
                gte(automationLogs.createdAt, startTime)
            ))
            .orderBy(desc(automationLogs.createdAt));

        return NextResponse.json({
            success: true,
            messageId,
            conversationId: conversation.id,
            personaId: persona.id,
            logs: logs
        });

    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
