
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanBoards, kanbanLeads } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';
import { ensureCancelledStage, type KanbanStage } from '@/lib/kanban/ensure-cancelled-stage';

const boardSchema = z.object({
    name: z.string().min(1, 'Nome do funil é obrigatório'),
    stages: z.array(z.object({
        id: z.string().uuid(),
        title: z.string().min(1),
        type: z.enum(['NEUTRAL', 'WIN', 'LOSS']),
    })).min(1, 'É necessária pelo menos uma etapa'),
    connectionIds: z.array(z.string().uuid()).optional().nullable(),
});

// GET /api/v1/kanbans - List all boards for the company

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();

        // Otimização: Em vez de buscar e depois fazer loop (problema N+1),
        // usamos um LEFT JOIN e agregamos os dados diretamente no banco.
        const boardsWithCounts = await db
            .select({
                id: kanbanBoards.id,
                name: kanbanBoards.name,
                stages: kanbanBoards.stages,
                createdAt: kanbanBoards.createdAt,
                companyId: kanbanBoards.companyId,
                totalLeads: sql<number>`count(${kanbanLeads.id})`.mapWith(Number),
                totalValue: sql<number>`sum(${kanbanLeads.value})`.mapWith(Number),
            })
            .from(kanbanBoards)
            .leftJoin(kanbanLeads, eq(kanbanBoards.id, kanbanLeads.boardId))
            .where(eq(kanbanBoards.companyId, companyId))
            .groupBy(kanbanBoards.id)
            .orderBy(desc(kanbanBoards.createdAt));

        return NextResponse.json(boardsWithCounts);
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.debug('Erro ao buscar funis Kanban:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// POST /api/v1/kanbans - Create a new board
export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsedData = boardSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }

        const { name, stages, connectionIds } = parsedData.data;

        // 🔄 Auto-insert "Agendamento Desmarcado" if "Reunião Marcada" exists
        const processedStages = ensureCancelledStage(stages as unknown as KanbanStage[]);

        const [newBoard] = await db.insert(kanbanBoards).values({
            companyId,
            name,
            stages: processedStages,
            connectionIds: connectionIds || null,
        }).returning();

        return NextResponse.json(newBoard, { status: 201 });

    } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.debug('Erro ao criar funil Kanban:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
