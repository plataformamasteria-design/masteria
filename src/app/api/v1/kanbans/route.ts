
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanBoards, kanbanLeads } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';
import { ensureCancelledStage, type KanbanStage } from '@/lib/kanban/ensure-cancelled-stage';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';
import { requireAuthWithUserOr401 } from '@/lib/api-auth-helper';

const boardSchema = z.object({
    name: z.string().min(1, 'Nome do funil é obrigatório'),
    stages: z.array(z.object({
        id: z.string().uuid(),
        title: z.string().min(1),
        type: z.enum(['NEUTRAL', 'WIN', 'LOSS']),
        entryAutomationId: z.string().optional().nullable(),
    })).min(1, 'É necessária pelo menos uma etapa'),
    connectionIds: z.array(z.string().uuid()).optional().nullable(),
    settings: z.object({
        autoAssignTeamId: z.string().optional().nullable(),
        autoAssignUserId: z.string().optional().nullable(),
        autoTriggerAutomationId: z.string().optional().nullable(),
        autoTags: z.array(z.string()).optional(),
        defaultEntryStageId: z.string().optional().nullable(),
    }).optional(),
});

// GET /api/v1/kanbans - List all boards for the company

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const authResult = await requireAuthWithUserOr401();
        if (authResult instanceof NextResponse) return authResult;
        const { companyId, user } = authResult;

        const isRestricted = user.role === 'atendente';
        const kanbanViewMode = isRestricted ? (user.permissions?.kanbanViewMode || 'all') : 'all';
        const allowedConnectionIds = isRestricted ? (user.permissions?.allowedConnectionIds || []) : null;

        // Otimização: Em vez de buscar e depois fazer loop (problema N+1),
        // usamos um LEFT JOIN e agregamos os dados diretamente no banco.
        // Além disso, cacheados para aliviar o banco
        const cacheKey = `kanbans:${companyId}:list`;
        const boardsWithCounts = await getCachedOrFetch(cacheKey, async () => {
            return await db
                .select({
                    id: kanbanBoards.id,
                    name: kanbanBoards.name,
                    stages: kanbanBoards.stages,
                    createdAt: kanbanBoards.createdAt,
                    companyId: kanbanBoards.companyId,
                    connectionIds: kanbanBoards.connectionIds,
                    totalLeads: sql<number>`count(${kanbanLeads.id})`.mapWith(Number),
                    totalValue: sql<number>`sum(${kanbanLeads.value})`.mapWith(Number),
                })
                .from(kanbanBoards)
                .leftJoin(kanbanLeads, eq(kanbanBoards.id, kanbanLeads.boardId))
                .where(eq(kanbanBoards.companyId, companyId))
                .groupBy(kanbanBoards.id)
                .orderBy(desc(kanbanBoards.createdAt));
        }, CacheTTL.SHORT);

        if (isRestricted) {
            if (allowedConnectionIds && allowedConnectionIds.length > 0) {
                const filtered = boardsWithCounts.filter(board => {
                    if (!board.connectionIds || board.connectionIds.length === 0) return false;
                    return board.connectionIds.some((id: string) => allowedConnectionIds.includes(id));
                });
                return NextResponse.json(filtered);
            } else {
                return NextResponse.json([]); // No allowed connections -> no boards
            }
        }

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

        const { name, stages, connectionIds, settings } = parsedData.data;

        // 🔄 Auto-insert "Agendamento Desmarcado" if "Reunião Marcada" exists
        const processedStages = ensureCancelledStage(stages as unknown as KanbanStage[]);

        const [newBoard] = await db.insert(kanbanBoards).values({
            companyId,
            name,
            stages: processedStages,
            connectionIds: connectionIds || null,
            settings: settings || {},
        }).returning();

        return NextResponse.json(newBoard, { status: 201 });

    } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.debug('Erro ao criar funil Kanban:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
