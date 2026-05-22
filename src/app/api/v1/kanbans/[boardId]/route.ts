// src/app/api/v1/kanbans/[boardId]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanBoards } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';
import { ensureCancelledStage, type KanbanStage } from '@/lib/kanban/ensure-cancelled-stage';

const boardUpdateSchema = z.object({
    name: z.string().min(1, 'Nome do funil é obrigatório').optional(),
    funnelType: z.enum(['LEAD_CAPTURE', 'SALES', 'CUSTOMER_SUCCESS', 'RETENTION']).nullable().optional(),
    objective: z.string().nullable().optional(),
    stages: z.array(z.object({
        id: z.string().uuid(),
        title: z.string().min(1),
        type: z.enum(['NEUTRAL', 'WIN', 'LOSS']),
        semanticType: z.enum(['meeting_scheduled', 'meeting_cancelled', 'payment_received', 'proposal_sent']).optional(),
        entryAutomationId: z.string().optional().nullable(),
    })).min(1, 'É necessária pelo menos uma etapa').optional(),
    connectionIds: z.array(z.string().uuid()).optional().nullable(),
    settings: z.object({
        autoAssignTeamId: z.string().optional().nullable(),
        autoAssignUserId: z.string().optional().nullable(),
        autoTriggerAutomationId: z.string().optional().nullable(),
        autoTags: z.array(z.string()).optional(),
        defaultEntryStageId: z.string().optional().nullable(),
    }).optional(),
});


// GET /api/v1/kanbans/[boardId]

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { boardId } = await params;
        const result = await db.select()
            .from(kanbanBoards)
            .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.companyId, companyId)))
            .limit(1);

        if (result.length === 0) {
            return NextResponse.json({ error: 'Funil não encontrado.' }, { status: 404 });
        }

        return NextResponse.json(result[0]);

    } catch (error) {
        console.error('Erro ao buscar funil:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}


// PUT /api/v1/kanbans/[boardId]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { boardId } = await params;
        const body = await request.json();
        const parsedData = boardUpdateSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }

        // 🔄 Auto-insert "Agendamento Desmarcado" if "Reunião Marcada" exists and stages are being updated
        const dataToUpdate = parsedData.data;
        if (dataToUpdate.stages) {
            dataToUpdate.stages = ensureCancelledStage(dataToUpdate.stages as unknown as KanbanStage[]);
        }

        const [updatedBoard] = await db.update(kanbanBoards)
            .set(dataToUpdate)
            .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.companyId, companyId)))
            .returning();

        if (!updatedBoard) {
            return NextResponse.json({ error: 'Funil não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        return NextResponse.json(updatedBoard);
    } catch (error) {
        console.error('Erro ao atualizar funil:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// DELETE /api/v1/kanbans/[boardId]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { boardId } = await params;
        const result = await db.delete(kanbanBoards)
            .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.companyId, companyId)))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Funil não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        return new NextResponse(null, { status: 204 });

    } catch (error) {
        console.error('Erro ao excluir funil:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
