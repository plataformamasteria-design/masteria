// src/app/api/v1/conversations/[conversationId]/archive/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { conversations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession, getUserIdFromSession } from '@/app/actions';

// POST /api/v1/conversations/[conversationId]/archive -> Archives a conversation

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const userId = await getUserIdFromSession();
        
        const { conversationId } = await params;

        const [updatedConversation] = await db.update(conversations)
            .set({
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archivedBy: userId, 
            })
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ))
            .returning();
            
        if (!updatedConversation) {
            return NextResponse.json({ error: 'Conversa não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }

        // Não há uma mensagem nova, então não disparamos o gatilho aqui.
        // O gatilho correto seria 'conversation_updated', que pode ser implementado no futuro.

        return NextResponse.json(updatedConversation);

    } catch (error) {
        console.error('Erro ao arquivar conversa:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}


// DELETE /api/v1/conversations/[conversationId]/archive -> Unarchives a conversation
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { conversationId } = await params;
        
        const [updatedConversation] = await db.update(conversations)
            .set({
                status: 'IN_PROGRESS', 
                archivedAt: null,
                archivedBy: null,
            })
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ))
            .returning();

        if (!updatedConversation) {
            return NextResponse.json({ error: 'Conversa não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }
        
        return NextResponse.json(updatedConversation);

    } catch (error) {
        console.error('Erro ao reabrir conversa:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
