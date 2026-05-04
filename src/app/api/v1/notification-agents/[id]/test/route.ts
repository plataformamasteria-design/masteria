import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationAgents, notificationLogs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { baileysBridge as baileysSessionManager } from '@/lib/baileys-bridge-client';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const agentId = id;
    const body = await request.json().catch(() => ({}));
    const customMessage = body.message as string | undefined;

    // SECURITY: Validar tenant ao buscar agente
    const agent = await db.query.notificationAgents.findFirst({
      where: and(
        eq(notificationAgents.id, agentId),
        eq(notificationAgents.companyId, companyId)
      ),
      with: {
        connection: true,
        groups: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
    }

    if (!agent.isActive) {
      return NextResponse.json(
        { error: 'Agente desativado', code: 'AGENT_INACTIVE' },
        { status: 400 }
      );
    }

    const connectionId = agent.connectionId;
    const sessionData = baileysSessionManager['sessions'].get(connectionId);

    if (!sessionData || sessionData.status !== 'connected') {
      return NextResponse.json(
        {
          error: 'Sessão WhatsApp não conectada',
          code: 'SESSION_OFFLINE',
          details: { status: sessionData?.status || 'not_found' }
        },
        { status: 503 }
      );
    }

    const activeGroups = agent.groups.filter(g => g.isActive);

    if (activeGroups.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum grupo ativo configurado', code: 'NO_ACTIVE_GROUPS' },
        { status: 400 }
      );
    }

    const defaultMessage = '🔔 **Teste de Notificação**\n\nSe você está vendo esta mensagem, o agente de notificações está funcionando corretamente!';
    const message = customMessage || defaultMessage;

    const results = await Promise.all(
      activeGroups.map(async (group) => {
        try {
          const messageId = await baileysSessionManager.sendMessage(
            connectionId,
            group.groupJid,
            { text: message }
          );

          await db.insert(notificationLogs).values({
            agentId,
            type: 'test',
            groupJid: group.groupJid,
            message,
            status: messageId ? 'sent' : 'failed',
            failureReason: messageId ? null : 'Falha ao enviar mensagem',
            retryCount: 0,
          } as any);

          return {
            groupJid: group.groupJid,
            groupName: group.groupName,
            success: !!messageId,
            messageId: messageId || undefined,
            error: messageId ? undefined : 'Falha ao enviar',
          };
        } catch (error) {
          await db.insert(notificationLogs).values({
            agentId,
            type: 'test',
            groupJid: group.groupJid,
            message,
            status: 'failed',
            failureReason: error instanceof Error ? error.message : 'Erro desconhecido',
            errorCode: 'SEND_ERROR',
            retryCount: 0,
          } as any);

          return {
            groupJid: group.groupJid,
            groupName: group.groupName,
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          };
        }
      })
    );

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      summary: {
        total: activeGroups.length,
        sent,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error('[NotificationAgents][Test] POST error:', error);
    return NextResponse.json(
      {
        error: 'Erro ao enviar mensagens de teste',
        code: 'TEST_ERROR',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
