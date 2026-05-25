// src/app/api/v1/admin/kanban/bulk-assign/route.ts
// Rota de administração para atribuição em lote de leads a uma equipe.
// POST com body: { boardName, stageName, teamName, cutoffDate }

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  kanbanBoards,
  kanbanLeads,
  teams,
  usersToTeams,
  conversations,
  connections,
} from '@/lib/db/schema';
import { eq, and, gte, ilike } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import type { KanbanStage } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();

    const body = await request.json();
    const {
      boardName  = 'GCR',
      stageName  = 'Lead Novo',
      teamName   = 'Seção de vendas',
      cutoffDate = '2026-05-21',
    } = body as {
      boardName?: string;
      stageName?: string;
      teamName?: string;
      cutoffDate?: string;
    };

    // ── 1. Localizar o funil pelo nome ────────────────────────────────────────
    const [board] = await db
      .select()
      .from(kanbanBoards)
      .where(and(
        eq(kanbanBoards.companyId, companyId),
        ilike(kanbanBoards.name, `%${boardName}%`),
      ))
      .limit(1);

    if (!board) {
      return NextResponse.json(
        { error: `Funil contendo "${boardName}" não encontrado para esta empresa.` },
        { status: 404 },
      );
    }

    // ── 2. Localizar a etapa "Lead Novo" no JSONB do board ────────────────────
    const stages = board.stages as KanbanStage[];
    const targetStage = stages.find(s =>
      s.title.toLowerCase().includes(stageName.toLowerCase()),
    );

    if (!targetStage) {
      return NextResponse.json({
        error: `Etapa "${stageName}" não encontrada no funil "${board.name}".`,
        availableStages: stages.map(s => s.title),
      }, { status: 404 });
    }

    // ── 3. Buscar leads na etapa após a data de corte ─────────────────────────
    const cutoff = new Date(cutoffDate);
    cutoff.setHours(0, 0, 0, 0);

    const leads = await db
      .select()
      .from(kanbanLeads)
      .where(and(
        eq(kanbanLeads.boardId, board.id),
        eq(kanbanLeads.stageId, targetStage.id),
        gte(kanbanLeads.createdAt, cutoff),
      ));

    if (leads.length === 0) {
      return NextResponse.json({
        message: 'Nenhum lead encontrado com os critérios informados.',
        boardFound: board.name,
        stageFound: targetStage.title,
        cutoffDate,
      });
    }

    // ── 4. Localizar a equipe ─────────────────────────────────────────────────
    const [team] = await db
      .select()
      .from(teams)
      .where(and(
        eq(teams.companyId, companyId),
        ilike(teams.name, `%${teamName}%`),
      ))
      .limit(1);

    if (!team) {
      return NextResponse.json(
        { error: `Equipe contendo "${teamName}" não encontrada.` },
        { status: 404 },
      );
    }

    // ── 5. Buscar membros da equipe ───────────────────────────────────────────
    const members = await db
      .select({ userId: usersToTeams.userId })
      .from(usersToTeams)
      .where(eq(usersToTeams.teamId, team.id));

    if (members.length === 0) {
      return NextResponse.json(
        { error: `A equipe "${team.name}" não possui membros cadastrados.` },
        { status: 422 },
      );
    }

    // ── 6. Primeira conexão ativa (para criar conversas sem chat) ─────────────
    const [firstConnection] = await db
      .select({ id: connections.id })
      .from(connections)
      .where(and(
        eq(connections.companyId, companyId),
        eq(connections.isActive, true),
      ))
      .limit(1);

    // ── 7. Processar cada lead ────────────────────────────────────────────────
    let assigned            = 0;
    let conversationsCreated = 0;
    const errors: string[]  = [];

    for (const lead of leads) {
      try {
        // Membro aleatório da equipe
        const randomMember = members[Math.floor(Math.random() * members.length)];

        // Verificar conversa existente
        const [existingConv] = await db
          .select()
          .from(conversations)
          .where(and(
            eq(conversations.companyId, companyId),
            eq(conversations.contactId, lead.contactId),
          ))
          .limit(1);

        if (existingConv) {
          // Atualizar conversa existente — reabre se estava resolvida
          await db
            .update(conversations)
            .set({
              assignedTo : randomMember.userId,
              teamId     : team.id,
              status     : existingConv.status === 'RESOLVED' ? 'OPEN' : existingConv.status,
            })
            .where(eq(conversations.id, existingConv.id));
        } else if (firstConnection) {
          // Criar nova conversa pronta para enviar/receber
          await db.insert(conversations).values({
            companyId,
            contactId    : lead.contactId,
            connectionId : firstConnection.id,
            status       : 'OPEN',
            assignedTo   : randomMember.userId,
            teamId       : team.id,
            lastMessageAt: new Date(),
            aiActive     : false,
          });
          conversationsCreated++;
        }

        assigned++;
      } catch (err) {
        console.error('[bulk-assign] Erro no lead', lead.id, err);
        errors.push(`Lead ${lead.id}: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      }
    }

    return NextResponse.json({
      success             : true,
      boardFound          : board.name,
      stageFound          : targetStage.title,
      teamFound           : team.name,
      teamMembersCount    : members.length,
      leadsFound          : leads.length,
      leadsAssigned       : assigned,
      conversationsCreated,
      errors              : errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[bulk-assign]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}
