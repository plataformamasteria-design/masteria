// src/app/api/v1/kanbans/[boardId]/report/route.ts
// GET /api/v1/kanbans/[boardId]/report?from=YYYY-MM-DD&to=YYYY-MM-DD
// Retorna diagnóstico completo de jornada do funil.

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanBoards, kanbanLeads, conversations, messages, users, usersToTeams } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, inArray, count, min } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import type { KanbanStage } from '@/lib/db/schema';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { boardId } = await params;
    const { searchParams } = new URL(request.url);

    // Período padrão: últimos 30 dias
    const toDate   = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date();
    const fromDate = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const cacheKey = `kanban:report:${companyId}:${boardId}:${fromDate.toISOString()}:${toDate.toISOString()}`;

    const reportData = await getCachedOrFetch(cacheKey, async () => {
      // ── 1. Validar o board ────────────────────────────────────────────────────
      const [board] = await db.select()
        .from(kanbanBoards)
        .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.companyId, companyId)))
        .limit(1);

      if (!board) {
        throw new Error('Funil não encontrado.');
      }

      const stages = board.stages as KanbanStage[];

      // ── 2. Todos os leads do funil ────────────────────────────────────────────
      const allLeads = await db.select()
        .from(kanbanLeads)
        .where(eq(kanbanLeads.boardId, boardId));

      // Leads no período selecionado
      const leadsInPeriod = allLeads.filter(l =>
        l.createdAt && new Date(l.createdAt) >= fromDate && new Date(l.createdAt) <= toDate,
      );

      // Contadores por tipo de etapa
      const wins   = allLeads.filter(l => stages.find(s => s.id === l.stageId)?.type === 'WIN').length;
      const losses = allLeads.filter(l => stages.find(s => s.id === l.stageId)?.type === 'LOSS').length;

      // Leads que avançaram de etapa no período (lastStageChangeAt dentro do período)
      const advanced = allLeads.filter(l =>
        l.lastStageChangeAt &&
        new Date(l.lastStageChangeAt) >= fromDate &&
        new Date(l.lastStageChangeAt) <= toDate,
      ).length;

      // ── 3. Distribuição por etapa ─────────────────────────────────────────────
      const byStage = stages.map(stage => {
        const stageLeads = allLeads.filter(l => l.stageId === stage.id);
        const inPeriod   = leadsInPeriod.filter(l => l.stageId === stage.id);

        // Tempo médio de permanência (lastStageChangeAt - createdAt) em minutos
        const durations = stageLeads
          .filter(l => l.lastStageChangeAt && l.createdAt)
          .map(l => (new Date(l.lastStageChangeAt!).getTime() - new Date(l.createdAt).getTime()) / 60000);

        const avgMinutesInStage = durations.length
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null;

        return {
          stageId        : stage.id,
          stageName      : stage.title,
          stageType      : stage.type,
          total          : stageLeads.length,
          inPeriod       : inPeriod.length,
          avgMinutesInStage,
        };
      });

      // ── 4. Dados de conversas e mensagens ─────────────────────────────────────
      const contactIds = allLeads.map(l => l.contactId).filter(Boolean) as string[];
      let firstContactMinutes: number[] = [];
      let noContactCount = 0;

      if (contactIds.length > 0) {
        const convRows = await db.select({
          contactId      : conversations.contactId,
          conversationId : conversations.id,
          assignedTo     : conversations.assignedTo,
          createdAt      : conversations.createdAt,
        })
        .from(conversations)
        .where(and(
          eq(conversations.companyId, companyId),
          inArray(conversations.contactId, contactIds),
        ));

        const convIds = convRows.map(c => c.conversationId).filter(Boolean) as string[];

        let firstMsgMap: Record<string, Date> = {};
        if (convIds.length > 0) {
          const firstMsgs = await db.select({
            conversationId : messages.conversationId,
            firstAt        : min(messages.sentAt),
          })
          .from(messages)
          .where(inArray(messages.conversationId, convIds))
          .groupBy(messages.conversationId);

          firstMsgs.forEach(r => {
            if (r.conversationId && r.firstAt) {
              firstMsgMap[r.conversationId] = r.firstAt instanceof Date ? r.firstAt : new Date(r.firstAt as any);
            }
          });
        }

        // Mapear leadCreatedAt por contactId
        const leadCreatedByContactId: Record<string, Date> = {};
        allLeads.forEach(l => {
          if (l.contactId && l.createdAt) {
            leadCreatedByContactId[l.contactId] = new Date(l.createdAt);
          }
        });

        convRows.forEach(conv => {
          const firstMsg = conv.conversationId ? firstMsgMap[conv.conversationId] : undefined;
          const leadCreated = conv.contactId ? leadCreatedByContactId[conv.contactId] : undefined;

          if (firstMsg && leadCreated) {
            const diffMin = (firstMsg.getTime() - leadCreated.getTime()) / 60000;
            if (diffMin >= 0) firstContactMinutes.push(diffMin);
          } else if (!firstMsg) {
            noContactCount++;
          }
        });
      }

      const sorted = [...firstContactMinutes].sort((a, b) => a - b);
      const avgFirstContact = sorted.length
        ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
        : null;
      const p50 = sorted.length ? Math.round(sorted[Math.floor(sorted.length * 0.5)]) : null;
      const p90 = sorted.length ? Math.round(sorted[Math.floor(sorted.length * 0.9)]) : null;

      // ── 5. Por agente ─────────────────────────────────────────────────────────
      const agentMap: Record<string, { leadCount: number; responseTimes: number[] }> = {};

      if (contactIds.length > 0) {
        const convs = await db.select({
          contactId  : conversations.contactId,
          assignedTo : conversations.assignedTo,
        })
        .from(conversations)
        .where(and(
          eq(conversations.companyId, companyId),
          inArray(conversations.contactId, contactIds),
        ));

        convs.forEach(c => {
          if (c.assignedTo) {
            if (!agentMap[c.assignedTo]) agentMap[c.assignedTo] = { leadCount: 0, responseTimes: [] };
            agentMap[c.assignedTo].leadCount++;
          }
        });
      }

      // Buscar nome e avatar dos agentes
      const agentIds = Object.keys(agentMap);
      let agentDetails: any[] = [];
      if (agentIds.length > 0) {
        agentDetails = await db.select({
          id       : users.id,
          name     : users.name,
          email    : users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.id, agentIds));
      }

      const byAgent = agentDetails.map(u => ({
        userId   : u.id,
        name     : u.name,
        email    : u.email,
        avatarUrl: u.avatarUrl,
        leadCount: agentMap[u.id]?.leadCount ?? 0,
      })).sort((a, b) => b.leadCount - a.leadCount);

      // ── 6. Timeline diária (entradas no período) ──────────────────────────────
      const timelineMap: Record<string, { entries: number; advances: number }> = {};
      leadsInPeriod.forEach(l => {
        if (!l.createdAt) return;
        const day = new Date(l.createdAt).toISOString().split('T')[0];
        if (!timelineMap[day]) timelineMap[day] = { entries: 0, advances: 0 };
        timelineMap[day].entries++;
      });
      allLeads.forEach(l => {
        if (!l.lastStageChangeAt) return;
        const d = new Date(l.lastStageChangeAt);
        if (d < fromDate || d > toDate) return;
        const day = d.toISOString().split('T')[0];
        if (!timelineMap[day]) timelineMap[day] = { entries: 0, advances: 0 };
        timelineMap[day].advances++;
      });
      const timeline = Object.entries(timelineMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, ...vals }));

      return {
        boardId,
        boardName: board.name,
        period: { from: fromDate.toISOString(), to: toDate.toISOString() },
        summary: {
          totalLeads     : allLeads.length,
          leadsInPeriod  : leadsInPeriod.length,
          advanced,
          wins,
          losses,
        },
        byStage,
        response: {
          avgFirstContactMinutes: avgFirstContact,
          p50,
          p90,
          noContactCount,
          withContactCount: firstContactMinutes.length,
        },
        byAgent,
        timeline,
      };
    }, CacheTTL.SHORT);

    return NextResponse.json(reportData);

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno.';
    if (msg !== 'Funil não encontrado.') {
      console.error('[kanban-report]', error);
    }
    return NextResponse.json(
      { error: msg },
      { status: msg === 'Funil não encontrado.' ? 404 : 500 },
    );
  }
}
