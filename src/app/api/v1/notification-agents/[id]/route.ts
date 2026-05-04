import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationAgents, notificationAgentGroups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  enabledNotifications: z.object({
    dailyReport: z.boolean().optional(),
    weeklyReport: z.boolean().optional(),
    biweeklyReport: z.boolean().optional(),
    monthlyReport: z.boolean().optional(),
    biannualReport: z.boolean().optional(),
    newMeeting: z.boolean().optional(),
    newSale: z.boolean().optional(),
    campaignSent: z.boolean().optional(),
  }).optional(),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  groupJids: z.array(z.string()).optional(),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PATCH(
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
    const body = await request.json();

    if ('connectionId' in body) {
      return NextResponse.json(
        { error: 'Não é permitido alterar connectionId', code: 'IMMUTABLE_FIELD' },
        { status: 400 }
      );
    }

    const validation = updateAgentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos', 
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten()
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // SECURITY: Validar tenant ao buscar agente
    const agent = await db.query.notificationAgents.findFirst({
      where: and(
        eq(notificationAgents.id, agentId),
        eq(notificationAgents.companyId, companyId)
      ),
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.scheduleTime !== undefined) updateData.scheduleTime = data.scheduleTime;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.enabledNotifications !== undefined) {
      updateData.enabledNotifications = {
        ...agent.enabledNotifications,
        ...data.enabledNotifications,
      };
    }

    await db.transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        // SECURITY: Validar tenant ao atualizar agente (já validado acima)
        await tx.update(notificationAgents)
          .set(updateData)
          .where(and(
            eq(notificationAgents.id, agentId),
            eq(notificationAgents.companyId, companyId)
          ));
      }

      if (data.groupJids !== undefined) {
        await tx.delete(notificationAgentGroups)
          .where(eq(notificationAgentGroups.agentId, agentId));

        if (data.groupJids.length > 0) {
          await tx.insert(notificationAgentGroups).values(
            data.groupJids.map(jid => ({
              agentId,
              groupJid: jid,
              isActive: true,
            }))
          );
        }
      }
    });

    // SECURITY: Validar tenant ao buscar agente atualizado (já validado acima)
    const updatedAgent = await db.query.notificationAgents.findFirst({
      where: and(
        eq(notificationAgents.id, agentId),
        eq(notificationAgents.companyId, companyId)
      ),
      with: {
        groups: true,
        connection: true,
      },
    });

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error('[NotificationAgents][id] PATCH error:', error);

    if ((error as any).code === '23505') {
      return NextResponse.json(
        { error: 'Já existe um agente com este nome', code: 'DUPLICATE_NAME' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Erro ao atualizar agente',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
    }

    await db.transaction(async (tx) => {
      await tx.delete(notificationAgentGroups)
        .where(eq(notificationAgentGroups.agentId, agentId));

      // SECURITY: Validar tenant ao deletar agente (já validado acima)
      await tx.delete(notificationAgents)
        .where(and(
          eq(notificationAgents.id, agentId),
          eq(notificationAgents.companyId, companyId)
        ));
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[NotificationAgents][id] DELETE error:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao deletar agente',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
