import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { automationFlowExecutions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

const updateExecutionSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel']),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ executionId: string }> }) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { executionId } = await params;

    const body = await request.json();
    const parsed = updateExecutionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Ação inválida.', details: parsed.error.flatten() }, { status: 400 });
    }

    const { action } = parsed.data;
    
    let newStatus = '';
    let finishedAt = null;

    if (action === 'pause') newStatus = 'paused';
    if (action === 'resume') newStatus = 'running';
    if (action === 'cancel') {
      newStatus = 'failed';
      finishedAt = new Date();
    }

    const payload: any = { status: newStatus };
    if (finishedAt) payload.finishedAt = finishedAt;

    const [updated] = await db
      .update(automationFlowExecutions)
      .set(payload)
      .where(and(
        eq(automationFlowExecutions.id, executionId),
        eq(automationFlowExecutions.companyId, companyId)
      ))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Execução não encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, execution: updated });

  } catch (error) {
    console.error('Erro ao atualizar execução de automação:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
