// src/app/api/v1/dashboard/insights/route.ts
// GET /api/v1/dashboard/insights
// Returns weekly insights comparing current vs previous period across all modules

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCompanyIdFromSession } from '@/app/actions';
import { and, count, eq, gte, lt, inArray } from 'drizzle-orm';
import {
  conversations, kanbanLeads, kanbanBoards, messages, leadDiagnostics,
} from '@/lib/db/schema';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

interface PeriodMetrics {
  newConversations: number;
  resolvedConversations: number;
  pendingConversations: number;
  leadsCreated: number;
  leadsAdvanced: number;
  messagesSent: number;
  adSpend: number;
  adClicks: number;
}

async function getPeriodMetrics(companyId: string, from: Date, to: Date): Promise<PeriodMetrics> {
  const fromDt = startOfDay(from);
  const toDt = endOfDay(to);

  const [newConvs, resolvedConvs, pendingConvs] = await Promise.all([
    db.select({ count: count() }).from(conversations)
      .where(and(eq(conversations.companyId, companyId), gte(conversations.createdAt, fromDt), lt(conversations.createdAt, toDt))),
    db.select({ count: count() }).from(conversations)
      .where(and(eq(conversations.companyId, companyId), eq(conversations.status, 'RESOLVED'), gte(conversations.updatedAt, fromDt), lt(conversations.updatedAt, toDt))),
    db.select({ count: count() }).from(conversations)
      .where(and(eq(conversations.companyId, companyId), eq(conversations.status, 'NEW'))),
  ]);

  // Kanban leads
  const boardIds = await db.select({ id: kanbanBoards.id }).from(kanbanBoards).where(eq(kanbanBoards.companyId, companyId));
  const boardIdList = boardIds.map(b => b.id);

  let leadsCreated = 0;
  let leadsAdvanced = 0;
  if (boardIdList.length > 0) {
    const [lc, la] = await Promise.all([
      db.select({ count: count() }).from(kanbanLeads)
        .where(and(inArray(kanbanLeads.boardId, boardIdList), gte(kanbanLeads.createdAt, fromDt), lt(kanbanLeads.createdAt, toDt))),
      db.select({ count: count() }).from(kanbanLeads)
        .where(and(inArray(kanbanLeads.boardId, boardIdList), gte(kanbanLeads.lastStageChangeAt, fromDt), lt(kanbanLeads.lastStageChangeAt, toDt))),
    ]);
    leadsCreated = lc[0]?.count ?? 0;
    leadsAdvanced = la[0]?.count ?? 0;
  }

  // Messages sent (outbound — senderType AGENT means sent by the platform)
  const msgsRes = await db.select({ count: count() }).from(messages)
    .where(and(
      eq(messages.companyId, companyId),
      eq(messages.senderType, 'AGENT'),
      gte(messages.sentAt, fromDt),
      lt(messages.sentAt, toDt),
    ));
  const messagesSent = msgsRes[0]?.count ?? 0;

  // Marketing data from leadDiagnostics
  const monthKey = `${fromDt.getFullYear()}-${String(fromDt.getMonth() + 1).padStart(2, '0')}`;
  const diag = await db.select().from(leadDiagnostics).where(eq(leadDiagnostics.referenceMonth, monthKey)).limit(1);
  const d = diag[0];

  return {
    newConversations: newConvs[0]?.count ?? 0,
    resolvedConversations: resolvedConvs[0]?.count ?? 0,
    pendingConversations: pendingConvs[0]?.count ?? 0,
    leadsCreated,
    leadsAdvanced,
    messagesSent,
    adSpend: Number(d?.adSpend ?? 0),
    adClicks: Number(d?.campaignClicks ?? 0),
  };
}

function buildInsights(current: PeriodMetrics, previous: PeriodMetrics): string[] {
  const insights: string[] = [];
  const pct = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

  // Atendimentos
  const convPct = pct(current.newConversations, previous.newConversations);
  if (convPct !== null) {
    if (convPct > 20) insights.push(`🚀 Atendimentos cresceram ${convPct}% vs período anterior — excelente volume!`);
    else if (convPct < -20) insights.push(`⚠️ Atendimentos caíram ${Math.abs(convPct)}% — verifique o fluxo de entrada.`);
  }

  // Taxa resolução
  if (current.resolvedConversations > 0 && current.newConversations > 0) {
    const resRate = Math.round((current.resolvedConversations / current.newConversations) * 100);
    if (resRate > 70) insights.push(`✅ Taxa de resolução em ${resRate}% — time performando muito bem!`);
    else if (resRate < 40) insights.push(`⚠️ Taxa de resolução em ${resRate}% — muitos atendimentos sem resposta.`);
  }

  // Pendentes crítico
  if (current.pendingConversations > 50) {
    insights.push(`🔴 ${current.pendingConversations} atendimentos pendentes aguardando 1ª resposta!`);
  }

  // Leads
  const leadsPct = pct(current.leadsCreated, previous.leadsCreated);
  if (leadsPct !== null && Math.abs(leadsPct) > 10) {
    if (leadsPct > 0) insights.push(`📈 ${current.leadsCreated} novos leads no Kanban (+${leadsPct}% vs anterior).`);
    else insights.push(`📉 Entrada de leads caiu ${Math.abs(leadsPct)}% — revise as fontes de captação.`);
  }

  // Movimentação kanban
  if (current.leadsAdvanced > 0) {
    const advPct = pct(current.leadsAdvanced, previous.leadsAdvanced);
    if (advPct !== null && advPct > 10) {
      insights.push(`🎯 ${current.leadsAdvanced} leads avançaram no pipeline (+${advPct}%) — funil ativo!`);
    }
  }

  // Disparos
  if (current.messagesSent > 0) {
    const msgPct = pct(current.messagesSent, previous.messagesSent);
    if (current.messagesSent > 500) {
      const trend = msgPct !== null && msgPct > 0 ? ` (+${msgPct}%)` : '';
      insights.push(`📤 ${current.messagesSent.toLocaleString('pt-BR')} mensagens enviadas${trend} no período.`);
    }
  }

  // Tráfego pago
  if (current.adSpend > 0) {
    const cpl = current.adClicks > 0 ? current.adSpend / current.adClicks : null;
    insights.push(`💰 Investimento em tráfego: R$ ${current.adSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
    if (cpl !== null) {
      insights.push(`📊 CPC atual: R$ ${cpl.toFixed(2)} — ${cpl < 5 ? 'excelente!' : cpl > 20 ? 'acima do ideal.' : 'dentro do esperado.'}`);
    }
  }

  if (insights.length === 0) {
    insights.push('📋 Continue registrando atividades para receber insights comparativos semanais.');
  }

  return insights.slice(0, 5);
}

export async function GET(_request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();

    const now = new Date();
    const weekStart = startOfDay(subDays(now, 7));
    const cacheKey = `dashboard-insights:${companyId}:${weekStart.toISOString()}`;

    const result = await getCachedOrFetch(cacheKey, async () => {
      const currentFrom = subDays(now, 7);
      const previousFrom = subDays(now, 14);
      const previousTo = subDays(now, 7);

      const [current, previous] = await Promise.all([
        getPeriodMetrics(companyId, currentFrom, now),
        getPeriodMetrics(companyId, previousFrom, previousTo),
      ]);

      const insights = buildInsights(current, previous);
      const hasCritical = insights.some(i => i.includes('🔴'));
      const hasPositive = insights.some(i => i.startsWith('🚀') || i.startsWith('✅') || i.startsWith('📈') || i.startsWith('🎯'));

      return {
        generatedAt: now.toISOString(),
        period: { from: currentFrom.toISOString(), to: now.toISOString() },
        previousPeriod: { from: previousFrom.toISOString(), to: previousTo.toISOString() },
        insights,
        status: hasCritical ? 'critical' : hasPositive ? 'positive' : 'neutral',
      };
    }, CacheTTL.LONG);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[dashboard-insights]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
