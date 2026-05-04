// src/app/api/v1/ia/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiPersonas, messages, conversations, automationLogs, connections } from '@/lib/db/schema';
import { eq, count, sql, desc, and, gte, inArray } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { subDays } from 'date-fns';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    
    // Cache de métricas IA (30 segundos)
    const cacheKey = `ia-metrics:${companyId}`;
    const data = await getCachedOrFetch(cacheKey, async () => {
      return await fetchIAMetrics(companyId);
    }, CacheTTL.SHORT);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro ao buscar métricas gerais de IA:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

async function fetchIAMetrics(companyId: string) {
    
    const sevenDaysAgo = subDays(new Date(), 7);
    const thirtyDaysAgo = subDays(new Date(), 30);

    // Total de agentes da empresa
    const totalPersonasResult = await db
      .select({ count: count() })
      .from(aiPersonas)
      .where(eq(aiPersonas.companyId, companyId));

    const totalPersonas = totalPersonasResult[0]?.count || 0;

    // Buscar todas as conexões com agentes atribuídos
    const connectionsWithPersonas = await db
      .select({
        personaId: connections.assignedPersonaId,
        connectionId: connections.id,
      })
      .from(connections)
      .where(
        and(
          eq(connections.companyId, companyId),
          sql`${connections.assignedPersonaId} IS NOT NULL`
        )
      );

    const connectionIds = connectionsWithPersonas.map((c) => c.connectionId);

    // Total de mensagens enviadas pela IA
    const totalAIMessagesResult = connectionIds.length > 0
      ? await db
          .select({ count: count() })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .where(
            and(
              inArray(conversations.connectionId, connectionIds),
              eq(messages.senderType, 'AI')
            )
          )
      : [{ count: 0 }];

    const totalAIMessages = totalAIMessagesResult[0]?.count || 0;

    // Mensagens nos últimos 7 dias
    const recentAIMessagesResult = connectionIds.length > 0
      ? await db
          .select({ count: count() })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .where(
            and(
              inArray(conversations.connectionId, connectionIds),
              eq(messages.senderType, 'AI'),
              gte(messages.sentAt, sevenDaysAgo)
            )
          )
      : [{ count: 0 }];

    const recentAIMessages = recentAIMessagesResult[0]?.count || 0;

    // Taxa de sucesso
    const successLogsResult = await db
      .select({ count: count() })
      .from(automationLogs)
      .where(
        and(
          eq(automationLogs.companyId, companyId),
          eq(automationLogs.level, 'INFO'),
          gte(automationLogs.createdAt, thirtyDaysAgo),
          sql`${automationLogs.message} LIKE '%IA respondeu com sucesso%'`
        )
      );

    const errorLogsResult = await db
      .select({ count: count() })
      .from(automationLogs)
      .where(
        and(
          eq(automationLogs.companyId, companyId),
          eq(automationLogs.level, 'ERROR'),
          gte(automationLogs.createdAt, thirtyDaysAgo),
          sql`${automationLogs.message} LIKE '%Falha ao comunicar com a IA%'`
        )
      );

    const successCount = successLogsResult[0]?.count || 0;
    const errorCount = errorLogsResult[0]?.count || 0;
    const totalAttempts = successCount + errorCount;
    const successRate = totalAttempts > 0 
      ? Math.round((successCount / totalAttempts) * 100) 
      : 0;

    // Conversas com IA ativa
    const activeAIConversationsResult = connectionIds.length > 0
      ? await db
          .select({ count: count() })
          .from(conversations)
          .where(
            and(
              inArray(conversations.connectionId, connectionIds),
              eq(conversations.aiActive, true)
            )
          )
      : [{ count: 0 }];

    const activeAIConversations = activeAIConversationsResult[0]?.count || 0;

    // Atividade diária dos últimos 7 dias
    const dailyActivity = connectionIds.length > 0
      ? await db
          .select({
            date: sql<string>`DATE(${messages.sentAt})`,
            count: count(),
          })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .where(
            and(
              inArray(conversations.connectionId, connectionIds),
              eq(messages.senderType, 'AI'),
              gte(messages.sentAt, sevenDaysAgo)
            )
          )
          .groupBy(sql`DATE(${messages.sentAt})`)
          .orderBy(sql`DATE(${messages.sentAt})`)
      : [];

    // Top 5 agentes por mensagens enviadas
    const topPersonas = await db
      .select({
        personaId: aiPersonas.id,
        personaName: aiPersonas.name,
        model: aiPersonas.model,
        messageCount: count(messages.id),
      })
      .from(aiPersonas)
      .leftJoin(connections, eq(connections.assignedPersonaId, aiPersonas.id))
      .leftJoin(conversations, eq(conversations.connectionId, connections.id))
      .leftJoin(
        messages,
        and(
          eq(messages.conversationId, conversations.id),
          eq(messages.senderType, 'AI')
        )
      )
      .where(eq(aiPersonas.companyId, companyId))
      .groupBy(aiPersonas.id, aiPersonas.name, aiPersonas.model)
      .orderBy(desc(count(messages.id)))
      .limit(5);

    return {
      summary: {
        totalPersonas,
        totalAIMessages,
        recentAIMessages7Days: recentAIMessages,
        activeAIConversations,
        successRate,
        successCount,
        errorCount,
        totalAttempts,
      },
      dailyActivity,
      topPersonas,
    };
}
