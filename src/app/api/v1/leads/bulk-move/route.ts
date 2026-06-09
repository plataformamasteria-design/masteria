// src/app/api/v1/leads/bulk-move/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanLeads, kanbanBoards } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { apiCache } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

// Suporta dois formatos:
// 1. Todos os leads para o mesmo board+stage: { leadIds, targetBoardId, targetStageId }
// 2. Moves individuais: { moves: [{ leadId, targetBoardId, targetStageId }] }
const bulkMoveSchema = z.union([
  z.object({
    leadIds: z.array(z.string().uuid()).min(1).max(500),
    targetBoardId: z.string().uuid(),
    targetStageId: z.string(),
  }),
  z.object({
    moves: z.array(z.object({
      leadId: z.string().uuid(),
      targetBoardId: z.string().uuid(),
      targetStageId: z.string(),
    })).min(1).max(500),
  }),
]);

/**
 * POST /api/v1/leads/bulk-move
 *
 * Formato 1: { leadIds, targetBoardId, targetStageId }
 * Formato 2: { moves: [{ leadId, targetBoardId, targetStageId }] }
 *
 * Suporta mover leads para stages diferentes no mesmo request.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireCompanyIdOr401();
  if (authResult instanceof NextResponse) return authResult;
  const { companyId } = authResult;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const parsed = bulkMoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  // Normalizar para o formato de moves individuais
  let moves: { leadId: string; targetBoardId: string; targetStageId: string }[];
  if ('leadIds' in parsed.data) {
    moves = parsed.data.leadIds.map(id => ({
      leadId: id,
      targetBoardId: parsed.data.targetBoardId,
      targetStageId: parsed.data.targetStageId,
    }));
  } else {
    moves = parsed.data.moves;
  }

  // Validar todos os boards destino em um batch
  const uniqueBoardIds = [...new Set(moves.map(m => m.targetBoardId))];
  const validBoards = await db
    .select({ id: kanbanBoards.id, name: kanbanBoards.name, stages: kanbanBoards.stages })
    .from(kanbanBoards)
    .where(and(
      inArray(kanbanBoards.id, uniqueBoardIds),
      eq(kanbanBoards.companyId, companyId)
    ));
  const boardMap = new Map(validBoards.map(b => [b.id, b]));

  // Validar stages e filtrar moves inválidos
  const validMoves = moves.filter(m => {
    const board = boardMap.get(m.targetBoardId);
    if (!board) return false;
    const stages = (board.stages as any[]) || [];
    return stages.some(s => s.id === m.targetStageId);
  });

  if (validMoves.length === 0) {
    return NextResponse.json({ error: 'Nenhum move válido encontrado' }, { status: 400 });
  }

  // Verificar que os leads pertencem à empresa (segurança IDOR)
  const allLeadIds = validMoves.map(m => m.leadId);
  const existingLeads = await db
    .select({ id: kanbanLeads.id, boardId: kanbanLeads.boardId })
    .from(kanbanLeads)
    .where(and(inArray(kanbanLeads.id, allLeadIds), eq(kanbanLeads.companyId, companyId)));
  const existingLeadSet = new Set(existingLeads.map(l => l.id));
  const sourceBoardIds = [...new Set(existingLeads.map(l => l.boardId))];

  // Agrupar moves por (targetBoardId, targetStageId) para UPDATE em lote
  const groupedMoves = new Map<string, string[]>();
  for (const m of validMoves) {
    if (!existingLeadSet.has(m.leadId)) continue; // segurança
    const key = `${m.targetBoardId}::${m.targetStageId}`;
    if (!groupedMoves.has(key)) groupedMoves.set(key, []);
    groupedMoves.get(key)!.push(m.leadId);
  }

  let totalMoved = 0;
  const affectedBoards = new Set<string>(sourceBoardIds);

  for (const [key, leadIds] of groupedMoves.entries()) {
    const [targetBoardId, targetStageId] = key.split('::');
    const targetBoard = boardMap.get(targetBoardId);
    const stages = (targetBoard?.stages as any[]) || [];
    const targetStageObj = stages.find(s => s.id === targetStageId) || null;

    await db
      .update(kanbanLeads)
      .set({ 
        boardId: targetBoardId, 
        stageId: targetStageId,
        currentStage: targetStageObj,
        lastStageChangeAt: new Date()
      })
      .where(and(inArray(kanbanLeads.id, leadIds), eq(kanbanLeads.companyId, companyId)));
    totalMoved += leadIds.length;
    affectedBoards.add(targetBoardId);
  }

  // Invalidar cache de todos os boards afetados
  for (const bid of affectedBoards) {
    apiCache.invalidatePattern(`leads:${companyId}:${bid}`);
  }

  console.log(`[BulkMove] ${companyId}: ${totalMoved} leads movidos em ${groupedMoves.size} grupo(s)`);

  return NextResponse.json({
    moved: totalMoved,
    skipped: moves.length - totalMoved,
    groups: groupedMoves.size,
  });
}
