import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calendarEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { z } from 'zod';
import { googleCalendarService } from '@/services/google-calendar.service';

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

    // Sync to Google
    const evt = updated[0];
    if (evt && evt.googleEventId) {
      try {
        const gcalClient = await googleCalendarService.getCalendarClient(session.companyId);
        if (gcalClient) {
          const durationMinutes = evt.startTime && evt.endTime 
            ? (evt.endTime.getTime() - evt.startTime.getTime()) / 60000 
            : undefined;
            
          await googleCalendarService.updateEvent(session.companyId, evt.googleEventId, {
            title: updateData.title || evt.title,
            description: updateData.description || evt.description || undefined,
            startTime: updateData.startTime || evt.startTime,
            durationMinutes,
          });
        }
      } catch (gErr) {
        console.warn('[PUT /api/v1/agenda/events/:id] Failed to update Google Calendar:', gErr);
      }
    }

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

    // First fetch to see if it has a google event id
    const [existing] = await db.select().from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.companyId, session.companyId)));

    if (existing && existing.googleEventId) {
      try {
        await googleCalendarService.cancelEvent(session.companyId, existing.googleEventId);
      } catch (gErr) {
        console.warn('[DELETE /api/v1/agenda/events/:id] Failed to delete from Google Calendar:', gErr);
      }
    }

    await db.delete(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.companyId, session.companyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/v1/agenda/events/:id]', error);
    return NextResponse.json({ error: 'Erro ao excluir evento' }, { status: 500 });
  }
}
