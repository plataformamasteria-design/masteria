// src/app/api/v1/ia/personas/[personaId]/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiPersonas, messages, conversations, automationLogs, connections } from '@/lib/db/schema';
import { and, eq, count, sql, desc, gte, inArray } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { subDays } from 'date-fns';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { personaId } = await params;

    // Verificar se o agente pertence à empresa
    const persona = await db.query.aiPersonas.findFirst({
      where: and(
        eq(aiPersonas.id, personaId),
        eq(aiPersonas.companyId, companyId)
      ),
    });

    if (!persona) {
      return NextResponse.json(
        { error: 'Agente não encontrado ou não pertence à sua empresa.' },
        { status: 404 }
      );
    }

    const sevenDaysAgo = subDays(new Date(), 7);
    const thirtyDaysAgo = subDays(new Date(), 30);

    // Buscar conversas atendidas pelo agente (onde a conexão tem este agente atribuído)
    const conversationsWithAgent = await db
      .select({
        conversationId: conversations.id,
        aiActive: conversations.aiActive,
      })
      .from(conversations)
      .innerJoin(
        connections,
        eq(conversations.connectionId, connections.id)
      )
      .where(
        and(
          eq(conversations.companyId, companyId),
          eq(connections.assignedPersonaId, personaId)
        )
      );

    const conversationIds = conversationsWithAgent.map((c) => c.conversationId);
    const activeConversationsCount = conversationsWithAgent.filter(
      (c) => c.aiActive
    ).length;

    // Total de mensagens enviadas pela IA neste agente
    const totalMessagesResult = conversationIds.length > 0
      ? await db
          .select({ count: count() })
          .from(messages)
          .where(
            and(
              inArray(messages.conversationId, conversationIds),
              eq(messages.senderType, 'AI')
            )
          )
      : [{ count: 0 }];

    const totalMessages = totalMessagesResult[0]?.count || 0;

    // Mensagens enviadas nos últimos 7 dias
    const recentMessagesResult = conversationIds.length > 0
      ? await db
          .select({ count: count() })
          .from(messages)
          .where(
            and(
              inArray(messages.conversationId, conversationIds),
              eq(messages.senderType, 'AI'),
              gte(messages.sentAt, sevenDaysAgo)
            )
          )
      : [{ count: 0 }];

    const recentMessages = recentMessagesResult[0]?.count || 0;

    // Logs de automação (INFO = sucesso, ERROR = falha) - filtrados por conversações deste agente
    const successLogsResult = conversationIds.length > 0
      ? await db
          .select({ count: count() })
          .from(automationLogs)
          .where(
            and(
              eq(automationLogs.companyId, companyId),
              inArray(automationLogs.conversationId, conversationIds),
              eq(automationLogs.level, 'INFO'),
              gte(automationLogs.createdAt, thirtyDaysAgo),
              sql`${automationLogs.message} LIKE '%IA respondeu com sucesso%'`
            )
          )
      : [{ count: 0 }];

    const errorLogsResult = conversationIds.length > 0
      ? await db
          .select({ count: count() })
          .from(automationLogs)
          .where(
            and(
              eq(automationLogs.companyId, companyId),
              inArray(automationLogs.conversationId, conversationIds),
              eq(automationLogs.level, 'ERROR'),
              gte(automationLogs.createdAt, thirtyDaysAgo),
              sql`${automationLogs.message} LIKE '%Falha ao comunicar com a IA%'`
            )
          )
      : [{ count: 0 }];

    const successCount = successLogsResult[0]?.count || 0;
    const errorCount = errorLogsResult[0]?.count || 0;
    const totalAttempts = successCount + errorCount;
    const successRate = totalAttempts > 0 
      ? Math.round((successCount / totalAttempts) * 100) 
      : 0;

    // Últimas atividades (últimos 10 logs) - filtradas por conversações deste agente
    const recentActivity = conversationIds.length > 0
      ? await db
          .select({
            id: automationLogs.id,
            level: automationLogs.level,
            message: automationLogs.message,
            createdAt: automationLogs.createdAt,
          })
          .from(automationLogs)
          .where(
            and(
              eq(automationLogs.companyId, companyId),
              inArray(automationLogs.conversationId, conversationIds),
              sql`${automationLogs.message} LIKE '%IA%'`
            )
          )
          .orderBy(desc(automationLogs.createdAt))
          .limit(10)
      : [];

    // Dados diários dos últimos 7 dias
    const dailyActivity = conversationIds.length > 0
      ? await db
          .select({
            date: sql<string>`DATE(${messages.sentAt})`,
            count: count(),
          })
          .from(messages)
          .where(
            and(
              inArray(messages.conversationId, conversationIds),
              eq(messages.senderType, 'AI'),
              gte(messages.sentAt, sevenDaysAgo)
            )
          )
          .groupBy(sql`DATE(${messages.sentAt})`)
          .orderBy(sql`DATE(${messages.sentAt})`)
      : [];

    return NextResponse.json({
      persona: {
        id: persona.id,
        name: persona.name,
        model: persona.model,
        provider: persona.provider,
      },
      metrics: {
        totalConversations: conversationsWithAgent.length,
        activeConversations: activeConversationsCount,
        totalMessages,
        recentMessages7Days: recentMessages,
        successRate,
        successCount,
        errorCount,
        totalAttempts,
      },
      dailyActivity,
      recentActivity,
    });
  } catch (error) {
    console.error('Erro ao buscar métricas do agente:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
