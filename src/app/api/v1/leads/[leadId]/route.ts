// src/app/api/v1/leads/[leadId]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanLeads, kanbanBoards } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';
import { moveLeadToStage } from '@/lib/kanban/move-lead-to-stage';

const leadUpdateSchema = z.object({
  stageId: z.string().optional(),
  value: z.number().nullable().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

// PUT /api/v1/leads/[leadId]

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { leadId } = await params;

        // First, verify the lead belongs to a board of the correct company
        // SECURITY: Validar tenant ao buscar lead (via board join implícito)
        const [leadVerification] = await db.select({ boardId: kanbanLeads.boardId })
            .from(kanbanLeads)
            .where(eq(kanbanLeads.id, leadId))
            .limit(1);

        if (!leadVerification) {
            return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 });
        }

        const [boardVerification] = await db.select({ id: kanbanBoards.id })
            .from(kanbanBoards)
            .where(and(eq(kanbanBoards.id, leadVerification.boardId), eq(kanbanBoards.companyId, companyId)))
            .limit(1);
        
        if (!boardVerification) {
            return NextResponse.json({ error: 'Lead não pertence à sua empresa.' }, { status: 403 });
        }
        
        const body = await request.json();
        const parsedData = leadUpdateSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }
        
        let finalLead;

        if (parsedData.data.stageId) {
            const moveResult = await moveLeadToStage({
                leadId,
                newStageId: parsedData.data.stageId,
                companyId,
            });

            if (!moveResult.success) {
                return NextResponse.json({ error: moveResult.error }, { status: 400 });
            }

            finalLead = moveResult.lead;
        }

        const updateData: Record<string, any> = {};
        if (parsedData.data.value !== undefined) {
            updateData.value = parsedData.data.value === null ? null : parsedData.data.value.toString();
        }
        if (parsedData.data.title !== undefined) {
            updateData.title = parsedData.data.title;
        }
        if (parsedData.data.notes !== undefined) {
            updateData.notes = parsedData.data.notes;
        }
        if (parsedData.data.status !== undefined) {
            updateData.status = parsedData.data.status;
        }

        if (Object.keys(updateData).length > 0) {
            // SECURITY: Validar tenant ao atualizar lead (via board já validado acima)
            const [updatedLead] = await db.update(kanbanLeads)
                .set(updateData)
                .where(and(
                    eq(kanbanLeads.id, leadId),
                    eq(kanbanLeads.companyId, companyId)
                ))
                .returning();

            finalLead = updatedLead;
        }

        if (!finalLead) {
            // SECURITY: Validar tenant ao buscar lead atual
            const [currentLead] = await db.select()
                .from(kanbanLeads)
                .where(and(
                    eq(kanbanLeads.id, leadId),
                    eq(kanbanLeads.companyId, companyId)
                ))
                .limit(1);
            finalLead = currentLead;
        }

        return NextResponse.json(finalLead);
    } catch (error) {
        console.error('Erro ao atualizar lead:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// DELETE /api/v1/leads/[leadId]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { leadId } = await params;

        // Verify the lead belongs to a board of the correct company before deleting
        // SECURITY: Validar tenant ao buscar lead (via board join implícito)
        const [leadVerification] = await db.select({ boardId: kanbanLeads.boardId })
            .from(kanbanLeads)
            .where(eq(kanbanLeads.id, leadId))
            .limit(1);

        if (!leadVerification) {
            return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 });
        }

        const [boardVerification] = await db.select({ id: kanbanBoards.id })
            .from(kanbanBoards)
            .where(and(eq(kanbanBoards.id, leadVerification.boardId), eq(kanbanBoards.companyId, companyId)))
            .limit(1);
        
        if (!boardVerification) {
            return NextResponse.json({ error: 'Lead não pertence à sua empresa.' }, { status: 403 });
        }
        
        // SECURITY: Validar tenant ao deletar lead (via board já validado acima)
        await db.delete(kanbanLeads).where(and(
            eq(kanbanLeads.id, leadId),
            eq(kanbanLeads.companyId, companyId)
        ));
        
        return new NextResponse(null, { status: 204 });

    } catch (error) {
        console.error('Erro ao excluir lead:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
