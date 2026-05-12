import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { z } from 'zod';

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  completed: z.boolean().default(false),
  contactId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const data = await db.query.tasks.findMany({
      where: eq(tasks.companyId, session.companyId),
      orderBy: [asc(tasks.dueDate)],
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[GET /api/v1/agenda/tasks]', error);
    return NextResponse.json({ error: 'Erro ao buscar tarefas' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const body = await req.json();
    const result = taskSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const newTask = await db.insert(tasks).values({
      companyId: session.companyId,
      title: result.data.title,
      description: result.data.description,
      dueDate: result.data.dueDate || null,
      dueTime: result.data.dueTime || null,
      priority: result.data.priority,
      completed: result.data.completed,
      contactId: result.data.contactId || null,
      assignedTo: result.data.assignedTo || null,
    }).returning();

    return NextResponse.json({ data: newTask[0] });
  } catch (error: any) {
    console.error('[POST /api/v1/agenda/tasks]', error);
    return NextResponse.json({ error: 'Erro ao criar tarefa' }, { status: 500 });
  }
}
