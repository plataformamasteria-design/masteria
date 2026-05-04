// src/app/api/v1/contacts/[contactId]/meetings/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiScheduledMeetings, contacts } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';
import { googleCalendarService } from '@/services/google-calendar.service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ contactId: string }> }
) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { contactId } = await params;

        const meetings = await db.select().from(aiScheduledMeetings)
            .where(eq(aiScheduledMeetings.contactId, contactId))
            .orderBy(desc(aiScheduledMeetings.scheduledAt))
            .limit(10);

        return NextResponse.json({ meetings });
    } catch (error) {
        console.error('[Contact Meetings] Error:', error);
        return NextResponse.json({ error: 'Erro ao buscar reuniões' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ contactId: string }> }
) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const companyId = session.user.companyId;
        const { contactId } = await params;
        const body = await request.json();
        const { meetingTime, title } = body;

        if (!meetingTime) {
            return NextResponse.json({ error: 'meetingTime is required' }, { status: 400 });
        }

        // Find the contact
        const [contact] = await db.select().from(contacts)
            .where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)))
            .limit(1);

        if (!contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        const scheduledAt = new Date(meetingTime);
        if (isNaN(scheduledAt.getTime())) {
            return NextResponse.json({ error: 'Invalid meetingTime' }, { status: 400 });
        }

        // Find available calendar
        const availableCalendar = await googleCalendarService.findAvailableCalendar(
            companyId,
            scheduledAt,
            30
        );

        if (!availableCalendar) {
            return NextResponse.json({
                error: 'Nenhum calendário disponível. Conecte ao Google Calendar em Configurações.',
            }, { status: 409 });
        }

        // Create event
        const meetingTitle = title || `Reunião com ${contact.name || 'Contato'}`;
        const eventResult = await googleCalendarService.createEvent(companyId, {
            title: meetingTitle,
            description: `Agendado manualmente via Atendimentos - MasterIA\n\nContato: ${contact.name || 'N/A'}`,
            startTime: scheduledAt,
            durationMinutes: 30,
            attendeeEmail: contact.email || undefined,
            attendeeName: contact.name || undefined,
            createMeetLink: true,
            calendarId: availableCalendar.id,
        });

        if (!eventResult) {
            return NextResponse.json({ error: 'Erro ao criar evento no Calendar' }, { status: 500 });
        }

        // Save to DB
        await db.insert(aiScheduledMeetings).values({
            companyId,
            contactId,
            googleEventId: eventResult.eventId,
            calendarId: availableCalendar.id,
            calendarName: availableCalendar.name,
            title: meetingTitle,
            scheduledAt,
            durationMinutes: 30,
            attendeeName: contact.name || undefined,
            attendeeEmail: contact.email || undefined,
            meetLink: eventResult.meetLink,
            status: 'scheduled',
        });

        return NextResponse.json({
            success: true,
            eventId: eventResult.eventId,
            meetLink: eventResult.meetLink,
            calendarName: availableCalendar.name,
            scheduledAt: scheduledAt.toISOString(),
            title: meetingTitle,
        });
    } catch (error) {
        console.error('[Contact Meetings POST] Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
