// src/app/api/v1/kanban/stage-personas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, kanbanStagePersonas, kanbanBoards } from '@/lib/db';
import { getUserSession } from '@/app/actions';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

const stagePersonaCreateSchema = z.object({
  boardId: z.string().uuid('ID do board inválido'),
  stageId: z.string().min(1, 'ID do estágio é obrigatório').nullable().optional(),
  activePersonaId: z.union([
    z.string().uuid(),
    z.literal('__INACTIVE__'),
  ]).nullable().optional(),
  passivePersonaId: z.union([
    z.string().uuid(),
    z.literal('__INACTIVE__'),
  ]).nullable().optional(),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session.user?.companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json({ error: 'boardId é obrigatório' }, { status: 400 });
    }

    const board = await db.query.kanbanBoards.findFirst({
      where: and(
        eq(kanbanBoards.id, boardId),
        eq(kanbanBoards.companyId, session.user.companyId)
      )
    });

    if (!board) {
      return NextResponse.json({ error: 'Board não encontrado' }, { status: 404 });
    }

    // SECURITY: Validar tenant - board já foi validado acima, garantindo que boardId pertence à empresa
    // kanbanStagePersonas não tem companyId direto, mas está relacionado a kanbanBoards que tem
    // Como já validamos o board acima, podemos usar o boardId com segurança
    const stagePersonas = await db.query.kanbanStagePersonas.findMany({
      where: eq(kanbanStagePersonas.boardId, boardId),
      with: {
        activePersona: true,
        passivePersona: true,
      }
    });

    return NextResponse.json(stagePersonas);
  } catch (error) {
    console.error('[StagePersonas API] Erro ao buscar:', error);
    return NextResponse.json({ error: 'Erro ao buscar configurações' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session.user?.companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = stagePersonaCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        error: parsed.error.errors[0]?.message || 'Dados inválidos'
      }, { status: 400 });
    }

    const board = await db.query.kanbanBoards.findFirst({
      where: and(
        eq(kanbanBoards.id, parsed.data.boardId),
        eq(kanbanBoards.companyId, session.user.companyId)
      )
    });

    if (!board) {
      return NextResponse.json({ error: 'Board não encontrado ou sem permissão' }, { status: 404 });
    }

    // Convert __INACTIVE__ to null personaId + disabled flag
    const activeIsInactive = parsed.data.activePersonaId === '__INACTIVE__';
    const passiveIsInactive = parsed.data.passivePersonaId === '__INACTIVE__';
    const resolvedActivePersonaId = activeIsInactive ? null : (parsed.data.activePersonaId ?? undefined);
    const resolvedPassivePersonaId = passiveIsInactive ? null : (parsed.data.passivePersonaId ?? undefined);

    // SECURITY: Validar tenant - board já foi validado acima
    // kanbanStagePersonas não tem companyId direto, mas está relacionado a kanbanBoards que tem
    const existing = await db.query.kanbanStagePersonas.findFirst({
      where: parsed.data.stageId
        ? and(
          eq(kanbanStagePersonas.boardId, parsed.data.boardId),
          eq(kanbanStagePersonas.stageId, parsed.data.stageId)
        )
        : and(
          eq(kanbanStagePersonas.boardId, parsed.data.boardId),
          isNull(kanbanStagePersonas.stageId)
        )
    });

    // Build update payload: only update the field that was changed
    const updatePayload: any = {};

    if (parsed.data.activePersonaId !== undefined) {
      updatePayload.activePersonaId = resolvedActivePersonaId ?? null;
      updatePayload.activeDisabled = activeIsInactive;
    } else if (existing) {
      updatePayload.activePersonaId = existing.activePersonaId;
      updatePayload.activeDisabled = existing.activeDisabled;
    }

    if (parsed.data.passivePersonaId !== undefined) {
      updatePayload.passivePersonaId = resolvedPassivePersonaId ?? null;
      updatePayload.passiveDisabled = passiveIsInactive;
    } else if (existing) {
      updatePayload.passivePersonaId = existing.passivePersonaId;
      updatePayload.passiveDisabled = existing.passiveDisabled;
    }

    let result;
    if (existing) {
      // SECURITY: Validar tenant - board já foi validado acima, existing pertence ao board validado
      [result] = await db.update(kanbanStagePersonas)
        .set(updatePayload)
        .where(and(
          eq(kanbanStagePersonas.id, existing.id),
          eq(kanbanStagePersonas.boardId, parsed.data.boardId) // Garantir que pertence ao board validado
        ))
        .returning();
    } else {
      [result] = await db.insert(kanbanStagePersonas)
        .values({
          boardId: parsed.data.boardId,
          stageId: parsed.data.stageId,
          activePersonaId: resolvedActivePersonaId ?? null,
          passivePersonaId: resolvedPassivePersonaId ?? null,
          activeDisabled: activeIsInactive,
          passiveDisabled: passiveIsInactive,
        })
        .returning();
    }

    return NextResponse.json(result, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('[StagePersonas API] Erro ao criar/atualizar:', error);
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session.user?.companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // SECURITY: Validar tenant via join com kanbanBoards
    const configResults = await db
      .select()
      .from(kanbanStagePersonas)
      .innerJoin(kanbanBoards, eq(kanbanBoards.id, kanbanStagePersonas.boardId))
      .where(and(
        eq(kanbanStagePersonas.id, id),
        eq(kanbanBoards.companyId, session.user.companyId)
      ))
      .limit(1);

    if (!configResults[0]) {
      return NextResponse.json({ error: 'Configuração não encontrada ou sem permissão' }, { status: 404 });
    }

    // SECURITY: Validar tenant ao deletar (via board já validado acima)
    await db.delete(kanbanStagePersonas).where(and(
      eq(kanbanStagePersonas.id, id),
      eq(kanbanStagePersonas.boardId, configResults[0].kanban_boards.id) // Garantir que pertence ao board validado
    ));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[StagePersonas API] Erro ao deletar:', error);
    return NextResponse.json({ error: 'Erro ao deletar configuração' }, { status: 500 });
  }
}
