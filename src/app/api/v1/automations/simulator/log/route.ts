import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { automationLogs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { logId, ruleId, flowName, messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const payloadDetails = {
      isSimulation: true,
      flowName: flowName || 'Fluxo Desconhecido',
      messages,
    };

    if (logId) {
      // Tenta atualizar log existente
      const existing = await db
        .select({ id: automationLogs.id })
        .from(automationLogs)
        .where(
          and(
            eq(automationLogs.id, logId),
            eq(automationLogs.companyId, session.user.companyId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(automationLogs)
          .set({
            details: payloadDetails,
          })
          .where(eq(automationLogs.id, logId));
          
        return NextResponse.json({ success: true, logId });
      }
    }

    // Se não tinha logId ou não encontrou, cria um novo
    const insertResult = await db
      .insert(automationLogs)
      .values({
        companyId: session.user.companyId,
        ruleId: ruleId || null,
        level: 'INFO',
        message: `Simulação Virtual: ${flowName || 'Fluxo'}`,
        details: payloadDetails,
      })
      .returning({ id: automationLogs.id });

    if (!insertResult || insertResult.length === 0) {
      throw new Error("Falha ao criar log");
    }

    return NextResponse.json({ success: true, logId: insertResult[0].id });
  } catch (error) {
    console.error('[SimulatorLog API] Erro ao sincronizar log:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
