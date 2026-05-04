/**
 * AI Meeting Management Tools — Cancel & Reschedule
 * Provides function/tools for AI agents to cancel or reschedule meetings
 */

import { db } from '@/lib/db';
import { aiScheduledMeetings, contacts, kanbanLeads, kanbanBoards } from '@/lib/db/schema';
import { googleCalendarService } from '@/services/google-calendar.service';
import { eq, and, desc } from 'drizzle-orm';
import { scheduleMeeting } from './schedule-meeting';
import { moveLeadToStage } from '@/lib/kanban/move-lead-to-stage';
import type { KanbanStage } from '@/lib/types';

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

interface CancelMeetingParams {
    companyId: string;
    conversationId: string;
    contactId: string;
    reason?: string;
}

interface RescheduleMeetingParams {
    companyId: string;
    conversationId: string;
    contactId: string;
    date: string;
    time: string;
    duration?: number;
}

interface ManageMeetingResult {
    success: boolean;
    message: string;
}

// ═══════════════════════════════════════════════════
// Helper: Find the most recent active meeting for a contact
// ═══════════════════════════════════════════════════

async function findActiveMeeting(companyId: string, contactId: string, conversationId: string) {
    // Try conversation-specific first, then fallback to any active meeting for this contact
    const [meeting] = await db.select()
        .from(aiScheduledMeetings)
        .where(and(
            eq(aiScheduledMeetings.companyId, companyId),
            eq(aiScheduledMeetings.contactId, contactId),
            eq(aiScheduledMeetings.status, 'scheduled')
        ))
        .orderBy(desc(aiScheduledMeetings.createdAt))
        .limit(1);

    return meeting || null;
}

// ═══════════════════════════════════════════════════
// Helper: Revert lead from meeting_scheduled stage
// ═══════════════════════════════════════════════════

async function revertLeadFromMeetingStage(contactId: string, companyId: string) {
    console.log('[CancelMeeting] 🔄 Starting auto-movement to "Agendamento Desmarcado"...');
    try {
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

        if (!lead) {
            console.log('[CancelMeeting] ⚠️ No lead found for contact. Skipping auto-movement.');
            return;
        }

        console.log(`[CancelMeeting] ✅ Lead found: ${lead.id} (boardId: ${lead.boardId}, currentStageId: ${lead.stageId})`);

        const [board] = await db.select({ stages: kanbanBoards.stages })
            .from(kanbanBoards)
            .where(eq(kanbanBoards.id, lead.boardId))
            .limit(1);

        if (!board) {
            console.log('[CancelMeeting] ⚠️ Board not found. Lead might be orphaned.');
            return;
        }

        const stages = (board.stages || []) as KanbanStage[];
        console.log(`[CancelMeeting] 📋 Board loaded with ${stages.length} stages`);

        const currentStage = stages.find(s => s.id === lead.stageId);

        if (currentStage?.semanticType !== 'meeting_scheduled') {
            console.log(`[CancelMeeting] ℹ️ Lead not in meeting_scheduled stage. Current stage: "${currentStage?.title}", semanticType: ${currentStage?.semanticType || 'NONE'}`);
            return;
        }

        // 🚫 Find "meeting_cancelled" stage
        const cancelledStage = stages.find(s => s.semanticType === 'meeting_cancelled');

        if (!cancelledStage) {
            console.log('[CancelMeeting] ⚠️ No stage with semanticType="meeting_cancelled" found in this board.');
            console.log('[CancelMeeting]    Available semantic types:', stages.map(s => `"${s.title}": ${s.semanticType || 'NONE'}`).join(', '));
            return;
        }

        console.log(`[CancelMeeting] ✅ Cancelled stage found: "${cancelledStage.title}" (${cancelledStage.id})`);

        if (cancelledStage.id === lead.stageId) {
            console.log('[CancelMeeting] ℹ️ Lead already in cancelled stage. No movement needed.');
            return;
        }

        console.log(`[CancelMeeting] 🚀 Moving lead from "${currentStage.title}" to "${cancelledStage.title}"...`);
        await moveLeadToStage({ leadId: lead.id, newStageId: cancelledStage.id, companyId });
        console.log(`[CancelMeeting] ✅ Lead ${lead.id} successfully moved to "Agendamento Desmarcado"!`);
    } catch (err) {
        console.error('[CancelMeeting] ❌ Error moving lead to cancelled stage:', err);
    }
}

// ═══════════════════════════════════════════════════
// Cancel Meeting
// ═══════════════════════════════════════════════════

export async function cancelMeeting(params: CancelMeetingParams): Promise<ManageMeetingResult> {
    const { companyId, conversationId, contactId, reason } = params;

    console.log(`[CancelMeeting] 🔍 Looking for active meeting — contact: ${contactId}, company: ${companyId}`);

    const meeting = await findActiveMeeting(companyId, contactId, conversationId);

    if (!meeting) {
        return {
            success: false,
            message: 'Não encontrei nenhuma reunião ativa para cancelar. Pode ser que já tenha sido cancelada anteriormente.',
        };
    }

    // Cancel on Google Calendar
    let calendarCancelled = false;
    if (meeting.googleEventId) {
        calendarCancelled = await googleCalendarService.cancelEvent(companyId, meeting.googleEventId);
        console.log(`[CancelMeeting] ${calendarCancelled ? '✅' : '❌'} Google Calendar cancel for event ${meeting.googleEventId}`);
    }

    // Update DB status
    await db.update(aiScheduledMeetings)
        .set({
            status: 'cancelled',
            description: reason ? `Cancelado: ${reason}` : 'Cancelado pelo contato',
        })
        .where(eq(aiScheduledMeetings.id, meeting.id));

    // Revert kanban lead from meeting_scheduled stage
    await revertLeadFromMeetingStage(contactId, companyId);

    const dateStr = meeting.scheduledAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const timeStr = meeting.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    console.log(`[CancelMeeting] ✅ Meeting ${meeting.id} cancelled — was scheduled for ${dateStr} ${timeStr}`);

    return {
        success: true,
        message: `Reunião "${meeting.title}" de ${dateStr} às ${timeStr} foi cancelada com sucesso.${calendarCancelled ? ' O evento foi removido do Google Calendar.' : ''}`,
    };
}

// ═══════════════════════════════════════════════════
// Reschedule Meeting
// ═══════════════════════════════════════════════════

export async function rescheduleMeeting(params: RescheduleMeetingParams): Promise<ManageMeetingResult> {
    const { companyId, conversationId, contactId, date, time, duration } = params;

    console.log(`[RescheduleMeeting] 🔍 Looking for active meeting to reschedule — contact: ${contactId}`);

    const meeting = await findActiveMeeting(companyId, contactId, conversationId);

    if (!meeting) {
        return {
            success: false,
            message: 'Não encontrei nenhuma reunião ativa para reagendar. Deseja criar um novo agendamento?',
        };
    }

    // Step 1: Cancel old event on Google Calendar
    if (meeting.googleEventId) {
        const cancelled = await googleCalendarService.cancelEvent(companyId, meeting.googleEventId);
        console.log(`[RescheduleMeeting] ${cancelled ? '✅' : '⚠️'} Old event ${meeting.googleEventId} cancelled`);
    }

    // Step 2: Update old meeting status in DB
    await db.update(aiScheduledMeetings)
        .set({
            status: 'cancelled',
            description: 'Reagendado pelo contato',
        })
        .where(eq(aiScheduledMeetings.id, meeting.id));

    // Step 3: Create new meeting using existing scheduleMeeting
    // Recover attendee info from old meeting or contacts table
    let attendeeEmail = meeting.attendeeEmail;
    let attendeeName = meeting.attendeeName;

    if (!attendeeEmail) {
        // Try to get email from contacts
        const [contact] = await db.select({ email: contacts.email, name: contacts.name })
            .from(contacts)
            .where(eq(contacts.id, contactId))
            .limit(1);
        attendeeEmail = contact?.email || null;
        attendeeName = attendeeName || contact?.name || null;
    }

    const newMeetingResult = await scheduleMeeting({
        companyId,
        conversationId,
        contactId,
        date,
        time,
        duration: duration || meeting.durationMinutes,
        title: meeting.title,
        attendeeEmail: attendeeEmail || undefined,
        attendeeName: attendeeName || undefined,
        createMeetLink: !!meeting.meetLink, // Keep same Meet link behavior
    });

    if (!newMeetingResult.success) {
        return {
            success: false,
            message: `A reunião anterior foi cancelada, mas houve um problema ao criar a nova: ${newMeetingResult.message}`,
        };
    }

    const oldDateStr = meeting.scheduledAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const oldTimeStr = meeting.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    console.log(`[RescheduleMeeting] ✅ Meeting rescheduled from ${oldDateStr} ${oldTimeStr} → ${newMeetingResult.message}`);

    return {
        success: true,
        message: `Reunião reagendada! A anterior (${oldDateStr} às ${oldTimeStr}) foi cancelada. ${newMeetingResult.message}`,
    };
}

// ═══════════════════════════════════════════════════
// Tool Definitions for Gemini Function Calling
// ═══════════════════════════════════════════════════

export const cancelMeetingToolDefinition = {
    name: 'cancel_meeting',
    description: 'Cancela a reunião agendada do contato no Google Calendar. Use quando o contato quiser cancelar um agendamento.',
    parameters: {
        type: 'object',
        properties: {
            reason: {
                type: 'string',
                description: 'Motivo do cancelamento informado pelo contato (opcional)',
            },
        },
        required: [],
    },
};

export const rescheduleMeetingToolDefinition = {
    name: 'reschedule_meeting',
    description: 'Reagenda a reunião do contato para um novo horário. Cancela automaticamente a reunião anterior e cria uma nova no Google Calendar.',
    parameters: {
        type: 'object',
        properties: {
            date: {
                type: 'string',
                description: 'Nova data da reunião. Aceita: "hoje", "amanhã", dia da semana ("segunda", "seg"), data BR ("08/02/2026", "8/2"), data ISO ("2026-02-10"), data por extenso ("8 de fevereiro"), "semana que vem". SEMPRE normalize para o formato mais simples.',
            },
            time: {
                type: 'string',
                description: 'Novo horário da reunião. Aceita: "14:00", "14h", "14h30", "2pm", "manhã" (=09:00), "tarde" (=14:00). SEMPRE normalize para formato 24h (ex: "14:30").',
            },
            duration: {
                type: 'number',
                description: 'Duração em minutos (padrão: mesma duração anterior)',
            },
        },
        required: ['date', 'time'],
    },
};
