import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOr401 } from '@/lib/api-auth-helper';
import { triggerFlow, evaluateMessageTriggers } from '@/lib/flow-engine';
import { db } from '@/lib/db';
import { messages, conversations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuthOr401();
        if ('status' in auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const companyId = auth.companyId;

        const body = await req.json();
        const { contactId, flowId, connectionId, evaluateMessage } = body;

        if (!contactId) {
            return NextResponse.json({ error: 'ContactId é obrigatório' }, { status: 400 });
        }

        if (!connectionId) {
            return NextResponse.json({ error: 'ConnectionId é obrigatório para disparos manuais' }, { status: 400 });
        }

        let triggeredManual = false;
        let triggeredMessage = false;

        // 1. Disparar o fluxo manual, se solicitado
        if (flowId) {
            await triggerFlow(flowId, companyId, contactId, {
                connectionId: connectionId // Força a conexão no escopo do fluxo
            });
            triggeredManual = true;
        }

        // 2. Avaliar gatilhos de Mensagem Recebida, se solicitado
        if (evaluateMessage) {
            const conversation = await db.query.conversations.findFirst({
                where: eq(conversations.contactId, contactId)
            });

            if (conversation) {
                const lastMessage = await db.query.messages.findFirst({
                    where: eq(messages.conversationId, conversation.id),
                    orderBy: [desc(messages.sentAt)]
                });

                if (lastMessage) {
                    // Necessário forçar connectionId no objeto da mensagem para que o motor ancore nela se for nulo
                    const simulatedMessage = {
                        ...lastMessage,
                        connectionId: lastMessage.connectionId || connectionId
                    };
                    
                    // O evaluateMessageTriggers recebe (companyId, contactId, messageData)
                    await evaluateMessageTriggers(companyId, contactId, simulatedMessage);
                    triggeredMessage = true;
                }
            }
        }

        return NextResponse.json({
            success: true,
            triggeredManual,
            triggeredMessage
        });

    } catch (error: any) {
        console.error('[API Trigger Manual] Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
    }
}
