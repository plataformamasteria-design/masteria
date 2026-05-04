// src/app/api/v1/kanban/schedule-meeting/route.ts
// API para agendar reunião a partir do kanban card

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { kanbanLeads, aiScheduledMeetings } from '@/lib/db/schema';
import { googleCalendarService } from '@/services/google-calendar.service';
import { getUserSession } from '@/app/actions';
import { eq } from 'drizzle-orm';
import { moveLeadToStage } from '@/lib/kanban/move-lead-to-stage';
import type { KanbanStage } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const companyId = session.user.companyId;

        const body = await request.json();
        const { leadId, meetingTime, title } = body;

        if (!leadId || !meetingTime) {
            return NextResponse.json({ error: 'leadId and meetingTime are required' }, { status: 400 });
        }

        // Find the lead with contact info
        const lead = await db.query.kanbanLeads.findFirst({
            where: eq(kanbanLeads.id, leadId),
            with: { contact: true, board: true },
        });

        if (!lead || lead.board.companyId !== companyId) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Parse the meeting time
        const scheduledAt = new Date(meetingTime);
        if (isNaN(scheduledAt.getTime())) {
            return NextResponse.json({ error: 'Invalid meetingTime format. Use ISO 8601.' }, { status: 400 });
        }

        // Find available calendar
        const availableCalendar = await googleCalendarService.findAvailableCalendar(
            companyId,
            scheduledAt,
            30
        );

        if (!availableCalendar) {
            return NextResponse.json({
                error: 'Nenhum calendário disponível para este horário.',
                suggestion: 'Tente outro horário ou adicione mais calendários.',
            }, { status: 409 });
        }

        // Create the Google Calendar event
        const meetingTitle = title || `Reunião com ${lead.contact?.name || 'Lead'}`;

        const eventResult = await googleCalendarService.createEvent(companyId, {
            title: meetingTitle,
            description: `Agendado via Kanban - MasterIA\n\nContato: ${lead.contact?.name || 'N/A'}`,
            startTime: scheduledAt,
            durationMinutes: 30,
            attendeeEmail: lead.contact?.email || undefined,
            attendeeName: lead.contact?.name || undefined,
            createMeetLink: true,
            calendarId: availableCalendar.id,
        });

        if (!eventResult) {
            return NextResponse.json({ error: 'Erro ao criar evento no Google Calendar' }, { status: 500 });
        }

        // Save to aiScheduledMeetings
        await db.insert(aiScheduledMeetings).values({
            companyId,
            contactId: lead.contactId,
            kanbanLeadId: lead.id,
            googleEventId: eventResult.eventId,
            calendarId: availableCalendar.id,
            calendarName: availableCalendar.name,
            title: meetingTitle,
            scheduledAt,
            durationMinutes: 30,
            attendeeName: lead.contact?.name || undefined,
            attendeeEmail: lead.contact?.email || undefined,
            meetLink: eventResult.meetLink,
            status: 'scheduled',
        });

        // Auto-move lead to meeting_scheduled stage if available
        try {
            const stages = (lead.board.stages || []) as KanbanStage[];
            const meetingStage = stages.find(s => s.semanticType === 'meeting_scheduled');
            if (meetingStage && meetingStage.id !== lead.stageId) {
                await moveLeadToStage({
                    leadId: lead.id,
                    newStageId: meetingStage.id,
                    companyId,
                });
            }
        } catch (e) {
            console.error('[KanbanSchedule] Auto-move error:', e);
        }

        return NextResponse.json({
            success: true,
            eventId: eventResult.eventId,
            meetLink: eventResult.meetLink,
            calendarName: availableCalendar.name,
            scheduledAt: scheduledAt.toISOString(),
        });
    } catch (error) {
        console.error('[KanbanSchedule] Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
