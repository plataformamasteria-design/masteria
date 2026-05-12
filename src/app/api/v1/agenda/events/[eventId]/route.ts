import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calendarEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { z } from 'zod';

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.boolean().optional(),
  color: z.string().nullable().optional(),
  calendarId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: { eventId: string } }) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { eventId } = params;
    const body = await req.json();
    const result = updateEventSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const updateData: any = { ...result.data };
    if (result.data.startTime) updateData.startTime = new Date(result.data.startTime);
    if (result.data.endTime) updateData.endTime = new Date(result.data.endTime);

    const updated = await db.update(calendarEvents)
      .set(updateData)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.companyId, session.companyId)))
      .returning();

    return NextResponse.json({ data: updated[0] });
  } catch (error: any) {
    console.error('[PUT /api/v1/agenda/events/:id]', error);
    return NextResponse.json({ error: 'Erro ao atualizar evento' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { eventId: string } }) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { eventId } = params;

    await db.delete(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.companyId, session.companyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/v1/agenda/events/:id]', error);
    return NextResponse.json({ error: 'Erro ao excluir evento' }, { status: 500 });
  }
}
