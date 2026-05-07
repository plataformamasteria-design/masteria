import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationAgents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { evolutionApiService } from '@/services/evolution-api.service';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(
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

    const connectionId = agent.connectionId;
    let sessionData: any;
    let isConnected = false;
    try {
        sessionData = await evolutionApiService.getConnectionState(connectionId);
        if (sessionData?.instance?.state === 'open') {
            isConnected = true;
        }
    } catch (e) {
        // Ignored
    }

    if (!isConnected) {
      return NextResponse.json(
        {
          error: 'Sessão WhatsApp não conectada',
          code: 'SESSION_OFFLINE',
          details: { status: sessionData?.instance?.state || 'not_found' }
        },
        { status: 503 }
      );
    }

    const allGroups = await evolutionApiService.fetchGroups(connectionId);

    const linkedGroupJids = new Set(agent.groups.map(g => g.groupJid));

    const groups = Object.values(allGroups).map((group: any) => ({
      id: group.id,
      subject: group.subject,
      participantCount: group.participants?.length || 0,
      isLinked: linkedGroupJids.has(group.id),
    }));

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('[NotificationAgents][Groups] GET error:', error);
    return NextResponse.json(
      {
        error: 'Erro ao buscar grupos WhatsApp',
        code: 'FETCH_GROUPS_ERROR',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
