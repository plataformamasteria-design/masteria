import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calendars, calendarEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  isGeneral: z.boolean().optional(),
  orderPosition: z.number().optional(),
  googleCalendarId: z.string().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: { calendarId: string } }) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { calendarId } = params;
    const body = await req.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const updated = await db.update(calendars)
      .set(result.data)
      .where(and(eq(calendars.id, calendarId), eq(calendars.companyId, session.companyId)))
      .returning();

    return NextResponse.json({ data: updated[0] });
  } catch (error: any) {
    console.error('[PUT /api/v1/agenda/calendars/:id]', error);
    return NextResponse.json({ error: 'Erro ao atualizar calendário' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { calendarId: string } }) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { calendarId } = params;

    // A exclusão de calendário não exclui os eventos, apenas remove o calendarId deles.
    await db.update(calendarEvents)
      .set({ calendarId: null })
      .where(and(eq(calendarEvents.calendarId, calendarId), eq(calendarEvents.companyId, session.companyId)));

    await db.delete(calendars)
      .where(and(eq(calendars.id, calendarId), eq(calendars.companyId, session.companyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/v1/agenda/calendars/:id]', error);
    return NextResponse.json({ error: 'Erro ao excluir calendário' }, { status: 500 });
  }
}
