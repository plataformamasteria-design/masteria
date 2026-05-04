import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationAgents, notificationAgentGroups, connections } from '@/lib/db/schema';
import { eq, and, sql, desc, like, or } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

// GET - Listar todos os agentes de notificação

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '0');
    const search = searchParams.get('search') || '';
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const whereConditions = [eq(notificationAgents.companyId, companyId)];
    
    if (search) {
      whereConditions.push(
        or(
          like(notificationAgents.name, `%${search}%`),
          like(notificationAgents.description, `%${search}%`)
        )!
      );
    }

    const agents = await db.query.notificationAgents.findMany({
      where: and(...whereConditions),
      with: {
        connection: {
          columns: {
            id: true,
            config_name: true,
            connectionType: true,
            status: true,
          },
        },
        groups: true,
      },
      ...(limit > 0 ? { limit, offset } : {}),
      orderBy: [desc(notificationAgents.createdAt)],
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationAgents)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return NextResponse.json({
      data: agents,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[NotificationAgents] GET error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar agentes de notificação' },
      { status: 500 }
    );
  }
}

// POST - Criar novo agente de notificação
export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      connectionId, 
      name, 
      description, 
      groupJids, 
      enabledNotifications,
      scheduleTime,
      timezone,
    } = body;

    // Validar campos obrigatórios
    if (!connectionId || !name || !groupJids || groupJids.length === 0) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: connectionId, name, groupJids' },
        { status: 400 }
      );
    }

    // Validar que a conexão existe, pertence à empresa e é tipo Baileys
    const connection = await db.query.connections.findFirst({
      where: and(
        eq(connections.id, connectionId),
        eq(connections.companyId, companyId)
      ),
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    if (connection.connectionType !== 'baileys') {
      return NextResponse.json(
        { error: 'Apenas conexões Baileys são suportadas para agentes de notificação' },
        { status: 400 }
      );
    }

    let newAgent: any = null;

    await db.transaction(async (tx) => {
      const [agent] = await tx.insert(notificationAgents).values({
        companyId,
        connectionId,
        name,
        description: description || null,
        enabledNotifications: enabledNotifications || {
          dailyReport: false,
          weeklyReport: false,
          biweeklyReport: false,
          monthlyReport: false,
          biannualReport: false,
          newMeeting: false,
          newSale: false,
          campaignSent: false,
        },
        scheduleTime: scheduleTime || '09:00',
        timezone: timezone || 'America/Sao_Paulo',
        isActive: true,
      }).returning();

      newAgent = agent;

      if (agent && groupJids && groupJids.length > 0) {
        await tx.insert(notificationAgentGroups).values(
          groupJids.map((jid: string) => ({
            agentId: agent.id,
            groupJid: jid,
            isActive: true,
          }))
        );
      }
    });

    if (!newAgent || !newAgent.id) {
      return NextResponse.json(
        { error: 'Erro ao criar agente' },
        { status: 500 }
      );
    }

    // SECURITY: Validar tenant ao buscar agente criado (já criado com companyId, mas garantindo segurança)
    const agentWithGroups = await db.query.notificationAgents.findFirst({
      where: and(
        eq(notificationAgents.id, newAgent.id),
        eq(notificationAgents.companyId, companyId)
      ),
      with: {
        groups: true,
        connection: true,
      },
    });

    return NextResponse.json(agentWithGroups, { status: 201 });
  } catch (error) {
    console.error('[NotificationAgents] POST error:', error);
    
    // Tratamento de unique constraint violation
    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: 'Já existe um agente com este nome para esta empresa' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao criar agente de notificação' },
      { status: 500 }
    );
  }
}
