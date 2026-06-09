// src/app/api/v1/conversations/[conversationId]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { conversations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuthWithUserOr401 } from '@/lib/api-auth-helper';

// GET /api/v1/conversations/[conversationId] -> Retrieve a conversation

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
    try {
        const authResult = await requireAuthWithUserOr401();
        if (authResult instanceof NextResponse) return authResult;
        const { companyId, user } = authResult;
        const { conversationId } = await params;

        const viewMode = user.permissions?.viewMode || 'all';
        const isAssignedOnly = user.role === 'atendente' && viewMode === 'assigned_only';
        const allowedConnectionIds = user.role === 'atendente' ? (user.permissions?.allowedConnectionIds || []) : null;

        const [conversation] = await db
            .select()
            .from(conversations)
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ))
            .limit(1);

        if (!conversation) {
            return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 });
        }

        if (user.role === 'atendente') {
            if (allowedConnectionIds && allowedConnectionIds.length > 0) {
                if (!allowedConnectionIds.includes(conversation.connectionId)) {
                    return NextResponse.json({ error: 'Você não tem permissão para acessar esta conversa.' }, { status: 403 });
                }
            }

            if (isAssignedOnly) {
                if (conversation.assignedTo !== user.id) {
                    return NextResponse.json({ error: 'Você não tem permissão para acessar esta conversa pois não está atribuída a você.' }, { status: 403 });
                }
            }
        }

        return NextResponse.json(conversation);

    } catch (error) {
        console.error('Erro ao buscar conversa:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// PATCH /api/v1/conversations/[conversationId] -> Update conversation fields
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { conversationId } = await params;
        const body = await request.json();

        // Permitir apenas campos seguros para atualização
        const allowedUpdates: Record<string, any> = {};

        if (body.assignedPersonaId !== undefined) {
            // Validação crítica de segurança multi-tenant
            if (body.assignedPersonaId !== null) {
                const { aiPersonas } = await import('@/lib/db/schema');
                
                const [persona] = await db
                    .select()
                    .from(aiPersonas)
                    .where(and(
                        eq(aiPersonas.id, body.assignedPersonaId),
                        eq(aiPersonas.companyId, companyId)
                    ))
                    .limit(1);

                if (!persona) {
                    return NextResponse.json({ 
                        error: 'Agente IA não encontrado ou não pertence à sua empresa.' 
                    }, { status: 403 });
                }
            }
            
            allowedUpdates.assignedPersonaId = body.assignedPersonaId;
        }

        if (body.aiActive !== undefined) {
            allowedUpdates.aiActive = body.aiActive;
        }

        const [updatedConversation] = await db
            .update(conversations)
            .set(allowedUpdates)
            .where(and(
                eq(conversations.id, conversationId),
                eq(conversations.companyId, companyId)
            ))
            .returning();

        if (!updatedConversation) {
            return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 });
        }

        return NextResponse.json(updatedConversation);

    } catch (error) {
        console.error('Erro ao atualizar conversa:', error);
        return NextResponse.json({ error: 'Erro interno ao atualizar conversa.' }, { status: 500 });
    }
}
