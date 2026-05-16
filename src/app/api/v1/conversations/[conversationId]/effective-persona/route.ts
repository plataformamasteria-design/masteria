import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversations, kanbanLeads, kanbanStagePersonas, aiPersonas, kanbanBoards } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { conversationId } = await params;

    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.companyId, companyId)
      ),
      with: {
        connection: true,
        contact: true
      }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    let effectivePersonaId: string | null = null;
    let source: 'stage' | 'funnel' | 'connection' | 'conversation' | 'none' = 'none';
    let details: any = {};

    const contactType = conversation.contactType || 'PASSIVE';

    const contact = conversation.contact as { id: string } | null;
    const contactId = contact?.id || conversation.contactId;

    let activeLead: { boardId: string; stageId: string; board: { name: string } } | null = null;
    if (contactId) {
      // SECURITY: Validar tenant ao buscar lead
      const lead = await db.query.kanbanLeads.findFirst({
        where: and(
          eq(kanbanLeads.contactId, contactId),
          eq(kanbanLeads.companyId, companyId)
        ),
        with: { board: true },
        orderBy: (kanbanLeads, { desc }) => [desc(kanbanLeads.createdAt)]
      });
      if (lead) {
        const board = lead.board as { name: string };
        activeLead = { boardId: lead.boardId, stageId: lead.stageId, board };
      }
    }

    if (activeLead) {
      // SECURITY: Validar tenant via join com kanbanBoards (kanbanStagePersonas não tem companyId direto)
      const stageConfigResults = await db
        .select()
        .from(kanbanStagePersonas)
        .innerJoin(kanbanBoards, eq(kanbanBoards.id, kanbanStagePersonas.boardId))
        .where(and(
          eq(kanbanStagePersonas.boardId, activeLead.boardId),
          eq(kanbanStagePersonas.stageId, activeLead.stageId),
          eq(kanbanBoards.companyId, companyId)
        ))
        .limit(1);
      const stageConfig = stageConfigResults[0]?.kanbanStagePersonas || null;

      if (stageConfig) {
        const personaId = contactType === 'ACTIVE' 
          ? stageConfig.activePersonaId 
          : stageConfig.passivePersonaId;

        if (personaId) {
          effectivePersonaId = personaId;
          source = 'stage';
          details = {
            boardName: activeLead.board.name,
            stageId: activeLead.stageId,
            contactType
          };
        }
      }

      if (!effectivePersonaId) {
        // SECURITY: Validar tenant via join com kanbanBoards
        const boardConfigResults = await db
          .select()
          .from(kanbanStagePersonas)
          .innerJoin(kanbanBoards, eq(kanbanBoards.id, kanbanStagePersonas.boardId))
          .where(and(
            eq(kanbanStagePersonas.boardId, activeLead.boardId),
            isNull(kanbanStagePersonas.stageId),
            eq(kanbanBoards.companyId, companyId)
          ))
          .limit(1);
        const boardConfig = boardConfigResults[0]?.kanbanStagePersonas || null;

        if (boardConfig) {
          const personaId = contactType === 'ACTIVE' 
            ? boardConfig.activePersonaId 
            : boardConfig.passivePersonaId;

          if (personaId) {
            effectivePersonaId = personaId;
            source = 'funnel';
            details = {
              boardName: activeLead.board.name,
              contactType
            };
          }
        }
      }
    }

    const connection = conversation.connection as { assignedPersonaId?: string | null; config_name?: string } | null;
    if (!effectivePersonaId && connection?.assignedPersonaId) {
      effectivePersonaId = connection.assignedPersonaId;
      source = 'connection';
      details = { connectionName: connection.config_name };
    }

    if (!effectivePersonaId && conversation.assignedPersonaId) {
      effectivePersonaId = conversation.assignedPersonaId;
      source = 'conversation';
    }

    let personaInfo = null;
    if (effectivePersonaId) {
      // SECURITY: Validar tenant ao buscar persona
      personaInfo = await db.query.aiPersonas.findFirst({
        where: and(
          eq(aiPersonas.id, effectivePersonaId),
          eq(aiPersonas.companyId, companyId)
        )
      });
    }

    return NextResponse.json({
      effectivePersonaId,
      source,
      details,
      persona: personaInfo ? {
        id: personaInfo.id,
        name: personaInfo.name,
        provider: personaInfo.provider
      } : null,
      manualPersonaId: conversation.assignedPersonaId
    });

  } catch (error) {
    console.error('Erro ao buscar agente efetivo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar agente efetivo' },
      { status: 500 }
    );
  }
}
