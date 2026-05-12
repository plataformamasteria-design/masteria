import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calendarEvents } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { z } from 'zod';
import { googleCalendarService } from '@/services/google-calendar.service';

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  startTime: z.string(),
  endTime: z.string(),
  allDay: z.boolean().default(false),
  color: z.string().nullable().optional(),
  calendarId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const calendarId = searchParams.get('calendarId');

    let conditions = [eq(calendarEvents.companyId, session.companyId)];
    
    if (start && end) {
      conditions.push(gte(calendarEvents.startTime, new Date(start)));
      conditions.push(lte(calendarEvents.endTime, new Date(end)));
    }
    
    if (calendarId && calendarId !== 'null') {
      conditions.push(eq(calendarEvents.calendarId, calendarId));
    }

    const data = await db.query.calendarEvents.findMany({
      where: and(...conditions),
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[GET /api/v1/agenda/events]', error);
    return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const body = await req.json();
    const result = eventSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // 1. Local Database Insert
    const newEvent = await db.insert(calendarEvents).values({
      companyId: session.companyId,
      title: result.data.title,
      description: result.data.description,
      location: result.data.location,
      startTime: new Date(result.data.startTime),
      endTime: new Date(result.data.endTime),
      allDay: result.data.allDay,
      color: result.data.color,
      calendarId: result.data.calendarId || null,
      contactId: result.data.contactId || null,
      assignedTo: result.data.assignedTo || null,
    }).returning();

    // 2. Google Calendar Sync
    try {
      const gcalClient = await googleCalendarService.getCalendarClient(session.companyId);
      if (gcalClient) {
        const start = new Date(result.data.startTime);
        const end = new Date(result.data.endTime);
        const durationMinutes = (end.getTime() - start.getTime()) / 60000;

        const gEvent = await googleCalendarService.createEvent(session.companyId, {
          title: result.data.title,
          description: result.data.description || undefined,
          startTime: start,
          durationMinutes,
        });

        if (gEvent && gEvent.eventId) {
          await db.update(calendarEvents)
            .set({ googleEventId: gEvent.eventId, syncSource: 'google', syncedFromGoogle: true })
            .where(eq(calendarEvents.id, newEvent[0].id));
            
          newEvent[0].googleEventId = gEvent.eventId;
        }
      }
    } catch (gErr) {
      console.warn('[POST /api/v1/agenda/events] Failed to sync to Google Calendar:', gErr);
      // We don't fail the request if Google Sync fails, just log it.
    }

    return NextResponse.json({ data: newEvent[0] });
  } catch (error: any) {
    console.error('[POST /api/v1/agenda/events]', error);
    return NextResponse.json({ error: 'Erro ao criar evento' }, { status: 500 });
  }
}
