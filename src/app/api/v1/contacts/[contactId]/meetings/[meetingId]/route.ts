// src/app/api/v1/contacts/[contactId]/meetings/[meetingId]/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiScheduledMeetings, contacts, kanbanLeads, kanbanBoards } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';
import { googleCalendarService } from '@/services/google-calendar.service';
import { moveLeadToStage } from '@/lib/kanban/move-lead-to-stage';
import type { KanbanStage } from '@/lib/types';
import { logContactEvent } from '@/lib/contact-events';

/**
 * DELETE — Cancel a scheduled meeting
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ contactId: string; meetingId: string }> }
) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const companyId = session.user.companyId;
        const { contactId, meetingId } = await params;

        // Find the meeting
        const [meeting] = await db.select().from(aiScheduledMeetings)
            .where(and(
                eq(aiScheduledMeetings.id, meetingId),
                eq(aiScheduledMeetings.contactId, contactId),
                eq(aiScheduledMeetings.companyId, companyId)
            ))
            .limit(1);

        if (!meeting) {
            return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
        }

        if (meeting.status === 'cancelled') {
            return NextResponse.json({ error: 'Reunião já cancelada' }, { status: 400 });
        }

        // Cancel on Google Calendar
        let calendarCancelled = false;
        if (meeting.googleEventId) {
            calendarCancelled = await googleCalendarService.cancelEvent(companyId, meeting.googleEventId);
            console.log(`[MeetingAPI] ${calendarCancelled ? '✅' : '❌'} Google Calendar cancel for event ${meeting.googleEventId}`);
        }

        // Update DB
        await db.update(aiScheduledMeetings)
            .set({ status: 'cancelled' })
            .where(eq(aiScheduledMeetings.id, meetingId));

        try {
            await logContactEvent(companyId, contactId, 'SYSTEM', `Reunião Cancelada: ${meeting.title}`);
        } catch(e) {}

        // Revert kanban lead if in meeting_scheduled stage
        await revertLeadFromMeetingStage(contactId, companyId);

        return NextResponse.json({
            success: true,
            calendarCancelled,
            message: 'Reunião cancelada com sucesso',
        });
    } catch (error) {
        console.error('[MeetingAPI DELETE] Error:', error);
        return NextResponse.json({ error: 'Erro ao cancelar reunião' }, { status: 500 });
    }
}

/**
 * PATCH — Reschedule a meeting to a new date/time
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ contactId: string; meetingId: string }> }
) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const companyId = session.user.companyId;
        const { contactId, meetingId } = await params;
        const body = await request.json();
        const { newDateTime } = body;

        if (!newDateTime) {
            return NextResponse.json({ error: 'newDateTime is required' }, { status: 400 });
        }

        const newScheduledAt = new Date(newDateTime);
        if (isNaN(newScheduledAt.getTime())) {
            return NextResponse.json({ error: 'Invalid newDateTime' }, { status: 400 });
        }

        // Find existing meeting
        const [meeting] = await db.select().from(aiScheduledMeetings)
            .where(and(
                eq(aiScheduledMeetings.id, meetingId),
                eq(aiScheduledMeetings.contactId, contactId),
                eq(aiScheduledMeetings.companyId, companyId)
            ))
            .limit(1);

        if (!meeting) {
            return NextResponse.json({ error: 'Reunião não encontrada' }, { status: 404 });
        }

        // Cancel old event
        if (meeting.googleEventId) {
            await googleCalendarService.cancelEvent(companyId, meeting.googleEventId);
        }

        // Mark old meeting as cancelled
        await db.update(aiScheduledMeetings)
            .set({ status: 'cancelled', description: 'Reagendado via Atendimentos' })
            .where(eq(aiScheduledMeetings.id, meetingId));

        // Find contact for attendee info
        const [contact] = await db.select().from(contacts)
            .where(eq(contacts.id, contactId))
            .limit(1);

        // Find available calendar
        const availableCalendar = await googleCalendarService.findAvailableCalendar(
            companyId,
            newScheduledAt,
            meeting.durationMinutes || 30
        );

        if (!availableCalendar) {
            return NextResponse.json({
                error: 'Nenhum calendário disponível',
                oldMeetingCancelled: true,
            }, { status: 409 });
        }

        // Create new event
        const eventResult = await googleCalendarService.createEvent(companyId, {
            title: meeting.title,
            description: `Reagendado via Atendimentos - MasterIA`,
            startTime: newScheduledAt,
            durationMinutes: meeting.durationMinutes || 30,
            attendeeEmail: meeting.attendeeEmail || contact?.email || undefined,
            attendeeName: meeting.attendeeName || contact?.name || undefined,
            createMeetLink: !!meeting.meetLink,
            calendarId: availableCalendar.id,
        });

        if (!eventResult) {
            return NextResponse.json({
                error: 'Erro ao criar novo evento no Calendar',
                oldMeetingCancelled: true,
            }, { status: 500 });
        }

        // Save new meeting
        const [newMeeting] = await db.insert(aiScheduledMeetings).values({
            companyId,
            contactId,
            conversationId: meeting.conversationId,
            googleEventId: eventResult.eventId,
            calendarId: availableCalendar.id,
            calendarName: availableCalendar.name,
            title: meeting.title,
            scheduledAt: newScheduledAt,
            durationMinutes: meeting.durationMinutes || 30,
            attendeeName: meeting.attendeeName || contact?.name || undefined,
            attendeeEmail: meeting.attendeeEmail || contact?.email || undefined,
            meetLink: eventResult.meetLink,
            status: 'scheduled',
        }).returning();

        try {
            await logContactEvent(companyId, contactId, 'SYSTEM', `Reunião Reagendada: ${meeting.title}`);
        } catch(e) {}

        return NextResponse.json({
            success: true,
            meeting: newMeeting,
            meetLink: eventResult.meetLink,
            message: 'Reunião reagendada com sucesso',
        });
    } catch (error) {
        console.error('[MeetingAPI PATCH] Error:', error);
        return NextResponse.json({ error: 'Erro ao reagendar reunião' }, { status: 500 });
    }
}

/**
 * Helper: Revert lead from meeting_scheduled stage to previous neutral stage
 */
async function revertLeadFromMeetingStage(contactId: string, companyId: string) {
    try {
        // Find lead for this contact
        const [lead] = await db.select({
            id: kanbanLeads.id,
            boardId: kanbanLeads.boardId,
            stageId: kanbanLeads.stageId,
        }).from(kanbanLeads)
            .where(and(
                eq(kanbanLeads.contactId, contactId),
                eq(kanbanLeads.companyId, companyId)
            ))
            .limit(1);

        if (!lead) return;

        // Get board stages
        const [board] = await db.select({ stages: kanbanBoards.stages })
            .from(kanbanBoards)
            .where(eq(kanbanBoards.id, lead.boardId))
            .limit(1);

        if (!board) return;

        const stages = (board.stages || []) as KanbanStage[];
        const currentStage = stages.find(s => s.id === lead.stageId);

        // Only revert if currently in a meeting_scheduled stage
        if (currentStage?.semanticType !== 'meeting_scheduled') return;

        // Find the first neutral stage before the current one (fallback to first stage)
        const currentIndex = stages.indexOf(currentStage);
        let targetStage: KanbanStage | undefined;

        // Look backwards for first NEUTRAL stage without semanticType
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (stages[i].type === 'NEUTRAL' && !stages[i].semanticType) {
                targetStage = stages[i];
                break;
            }
        }

        // Fallback: first stage
        if (!targetStage && stages.length > 0) {
            targetStage = stages[0];
        }

        if (targetStage && targetStage.id !== lead.stageId) {
            await moveLeadToStage({
                leadId: lead.id,
                newStageId: targetStage.id,
                companyId,
            });
            console.log(`[MeetingAPI] 🔄 Lead ${lead.id} reverted from "${currentStage.title}" to "${targetStage.title}"`);
        }
    } catch (err) {
        console.error('[MeetingAPI] Error reverting lead stage:', err);
    }
}
