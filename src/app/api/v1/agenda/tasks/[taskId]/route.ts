import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  contactId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { taskId } = params;
    const body = await req.json();
    const result = updateTaskSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const updated = await db.update(tasks)
      .set(result.data)
      .where(and(eq(tasks.id, taskId), eq(tasks.companyId, session.companyId)))
      .returning();

    return NextResponse.json({ data: updated[0] });
  } catch (error: any) {
    console.error('[PUT /api/v1/agenda/tasks/:id]', error);
    return NextResponse.json({ error: 'Erro ao atualizar tarefa' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { taskId } = params;

    await db.delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.companyId, session.companyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/v1/agenda/tasks/:id]', error);
    return NextResponse.json({ error: 'Erro ao excluir tarefa' }, { status: 500 });
  }
}
