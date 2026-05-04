/**
 * AI Meeting Scheduler Tool
 * Provides a function/tool for AI agents to schedule meetings in Google Calendar
 */

import { db } from '@/lib/db';
import { aiScheduledMeetings, googleCalendarCredentials, contacts, kanbanLeads, kanbanBoards, conversations as conversationsTable, connections as connectionsTable, aiPersonas, companies } from '@/lib/db/schema';
import { googleCalendarService } from '@/services/google-calendar.service';
import { eq, and } from 'drizzle-orm';
import { moveLeadToStage } from '@/lib/kanban/move-lead-to-stage';
import { parseDateTime } from '@/lib/ai-tools/date-time-parser';
import type { KanbanStage } from '@/lib/types';

export interface ScheduleMeetingParams {
    companyId: string;
    conversationId: string;
    contactId: string;
    // Meeting details extracted by AI
    date: string;      // e.g., "2026-02-07", "amanhã", "terça", "8 de fevereiro"
    time: string;      // e.g., "13:00", "13h", "3pm", "manhã"
    duration?: number; // minutes, default 30
    title?: string;
    attendeeEmail?: string;
    attendeeName?: string;
    createMeetLink?: boolean;
}

export interface ScheduleMeetingResult {
    success: boolean;
    message: string;
    eventId?: string;
    meetLink?: string;
    scheduledAt?: Date;
    suggestedSlots?: string[]; // Alternative times if slot not available
}

// parseDateTime is now imported from @/lib/ai-tools/date-time-parser

/**
 * Main function to schedule a meeting
 * This is called by the AI agent during conversation
 */
export async function scheduleMeeting(params: ScheduleMeetingParams): Promise<ScheduleMeetingResult> {
    const { companyId, conversationId, contactId } = params;

    // Check if Google Calendar is connected
    const [credential] = await db.select().from(googleCalendarCredentials)
        .where(and(
            eq(googleCalendarCredentials.companyId, companyId),
            eq(googleCalendarCredentials.isActive, true)
        ))
        .limit(1);

    if (!credential) {
        return {
            success: false,
            message: 'Google Calendar não está configurado. Por favor, conecte sua conta do Google Calendar nas configurações.',
        };
    }

    // Build list of active calendars (backward compat)
    const activeCalendars = (credential.activeCalendars as any[] || []).filter((c: any) => c.isActive);
    const hasMultiCalendar = activeCalendars.length > 0;

    if (!hasMultiCalendar && !credential.calendarId) {
        return {
            success: false,
            message: 'Nenhum calendário selecionado. Por favor, selecione um calendário nas configurações de integração.',
        };
    }

    // Parse date and time
    const scheduledAt = parseDateTime(params.date, params.time);
    if (!scheduledAt) {
        return {
            success: false,
            message: `Não consegui entender a data/hora "${params.date} ${params.time}". Por favor, confirme o horário desejado.`,
        };
    }

    // Validate it's in the future
    if (scheduledAt <= new Date()) {
        return {
            success: false,
            message: 'O horário precisa ser no futuro. Por favor, escolha outro horário.',
        };
    }

    const duration = params.duration || 30;

    // Multi-calendar: find first available calendar
    const availableCalendar = await googleCalendarService.findAvailableCalendar(companyId, scheduledAt, duration);

    if (!availableCalendar) {
        // All calendars are busy — suggest alternative times from primary calendar
        const primaryCalId = hasMultiCalendar ? activeCalendars.sort((a: any, b: any) => a.priority - b.priority)[0].id : credential.calendarId;
        const alternatives = await googleCalendarService.suggestTimeSlots(companyId, scheduledAt, duration);
        const suggestedSlots = alternatives.slice(0, 3).map(d =>
            d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
        );

        return {
            success: false,
            message: hasMultiCalendar
                ? `Todos os ${activeCalendars.length} calendários estão ocupados neste horário.`
                : `Este horário já está ocupado.`,
            suggestedSlots,
        };
    }

    // Get contact info if not provided
    let attendeeName = params.attendeeName;
    let attendeeEmail = params.attendeeEmail;

    if (!attendeeName && contactId) {
        const [contact] = await db.select().from(contacts)
            .where(eq(contacts.id, contactId))
            .limit(1);
        if (contact) {
            attendeeName = contact.name;
            attendeeEmail = attendeeEmail || contact.email || undefined;
        }
    }

    // Create the event
    const title = params.title || `Reunião com ${attendeeName || 'Cliente'}`;

    const eventResult = await googleCalendarService.createEvent(companyId, {
        title,
        description: `Agendado via WhatsApp - MasterIA\n\nContato: ${attendeeName || 'N/A'}\nEmail: ${attendeeEmail || 'N/A'}`,
        startTime: scheduledAt,
        durationMinutes: duration,
        attendeeEmail,
        attendeeName,
        createMeetLink: params.createMeetLink ?? true,
        calendarId: availableCalendar.id,
    });

    if (!eventResult) {
        return {
            success: false,
            message: 'Erro ao criar evento no Google Calendar. Por favor, tente novamente.',
        };
    }

    // 🔍 Find kanban lead BEFORE insert (so we can link kanbanLeadId)
    let activeLead: { id: string; boardId: string; stageId: string } | undefined;
    if (contactId) {
        try {
            const [found] = await db.select({
                id: kanbanLeads.id,
                boardId: kanbanLeads.boardId,
                stageId: kanbanLeads.stageId,
            }).from(kanbanLeads)
                .innerJoin(kanbanBoards, eq(kanbanLeads.boardId, kanbanBoards.id))
                .where(and(
                    eq(kanbanLeads.contactId, contactId),
                    eq(kanbanBoards.companyId, companyId)
                ))
                .limit(1);
            activeLead = found;
        } catch (e) {
            console.error('[ScheduleMeeting] Error finding lead:', e);
        }
    }

    // Save to database
    await db.insert(aiScheduledMeetings).values({
        companyId,
        conversationId,
        contactId,
        kanbanLeadId: activeLead?.id || null,
        googleEventId: eventResult.eventId,
        calendarId: availableCalendar.id,
        calendarName: availableCalendar.name,
        title,
        scheduledAt,
        durationMinutes: duration,
        attendeeEmail,
        attendeeName,
        meetLink: eventResult.meetLink,
        status: 'scheduled',
    });

    // 📧 Persist attendee email to contacts table (avoid asking again)
    if (attendeeEmail && contactId) {
        try {
            const [existingContact] = await db.select({ email: contacts.email })
                .from(contacts)
                .where(eq(contacts.id, contactId))
                .limit(1);
            if (!existingContact?.email) {
                await db.update(contacts)
                    .set({ email: attendeeEmail })
                    .where(eq(contacts.id, contactId));
                console.log(`[ScheduleMeeting] 📧 Saved email ${attendeeEmail} to contact ${contactId}`);
            }
        } catch (emailErr) {
            console.error('[ScheduleMeeting] Error saving email to contact:', emailErr);
        }
    }
    // 🔄 Auto-move kanban lead to "meeting_scheduled" stage
    console.log('[ScheduleMeeting] 🔄 Starting auto-movement check...');
    try {
        if (!activeLead) {
            console.log('[ScheduleMeeting] ⚠️ No active lead found. Creating lead automatically...');
            // Auto-create lead in default board and place in meeting stage
            try {
                // Resolve board with priority: Persona → Company → First available
                let targetBoardId: string | null = null;

                // 1. Try persona's kanbanBoardId via conversation → connection → persona
                const [convo] = await db.select({ connectionId: conversationsTable.connectionId })
                    .from(conversationsTable).where(eq(conversationsTable.id, conversationId)).limit(1);
                if (convo?.connectionId) {
                    const [conn] = await db.select({ assignedPersonaId: connectionsTable.assignedPersonaId })
                        .from(connectionsTable).where(eq(connectionsTable.id, convo.connectionId)).limit(1);
                    if (conn?.assignedPersonaId) {
                        const [persona] = await db.select({ kanbanBoardId: aiPersonas.kanbanBoardId })
                            .from(aiPersonas).where(eq(aiPersonas.id, conn.assignedPersonaId)).limit(1);
                        if (persona?.kanbanBoardId) {
                            targetBoardId = persona.kanbanBoardId;
                            console.log(`[ScheduleMeeting] 📋 Using persona's board: ${targetBoardId}`);
                        }
                    }
                }

                // 2. Try company's defaultKanbanBoardId
                if (!targetBoardId) {
                    const [company] = await db.select({ defaultKanbanBoardId: companies.defaultKanbanBoardId })
                        .from(companies).where(eq(companies.id, companyId)).limit(1);
                    if (company?.defaultKanbanBoardId) {
                        targetBoardId = company.defaultKanbanBoardId;
                        console.log(`[ScheduleMeeting] 📋 Using company default board: ${targetBoardId}`);
                    }
                }

                // 3. Fetch board by ID or fallback to first available
                let board;
                if (targetBoardId) {
                    [board] = await db.select().from(kanbanBoards)
                        .where(and(eq(kanbanBoards.id, targetBoardId), eq(kanbanBoards.companyId, companyId)))
                        .limit(1);
                }
                if (!board) {
                    [board] = await db.select().from(kanbanBoards)
                        .where(eq(kanbanBoards.companyId, companyId))
                        .limit(1);
                }

                if (board) {
                    const stages = (board.stages || []) as KanbanStage[];
                    const meetingStage = stages.find(s => s.semanticType === 'meeting_scheduled');
                    const targetStage = meetingStage || stages[0];

                    if (targetStage) {
                        // Fetch contact name for lead title
                        const [contactInfo] = await db.select({ name: contacts.name, phone: contacts.phone })
                            .from(contacts).where(eq(contacts.id, contactId)).limit(1);

                        const [newLead] = await db.insert(kanbanLeads).values({
                            companyId,
                            boardId: board.id,
                            stageId: targetStage.id,
                            contactId,
                            title: contactInfo?.name || contactInfo?.phone || 'Lead',
                            value: "0",
                            status: 'OPEN',
                            priority: 'MEDIUM',
                            currentStage: targetStage,
                            notes: `📅 Reunião agendada: ${title}`,
                        }).returning();

                        activeLead = { id: newLead.id, boardId: board.id, stageId: targetStage.id };
                        console.log(`[ScheduleMeeting] ✅ Lead created: ${newLead.id} in stage "${targetStage.title}"`);

                        // Update the meeting record with the new lead ID
                        if (eventResult.eventId) {
                            await db.update(aiScheduledMeetings)
                                .set({ kanbanLeadId: newLead.id })
                                .where(and(
                                    eq(aiScheduledMeetings.googleEventId, eventResult.eventId),
                                    eq(aiScheduledMeetings.companyId, companyId)
                                ));
                        }
                    } else {
                        console.log('[ScheduleMeeting] ⚠️ No stages found in board. Cannot create lead.');
                    }
                } else {
                    console.log('[ScheduleMeeting] ⚠️ No kanban board found for company. Cannot create lead.');
                }
            } catch (createError) {
                console.error('[ScheduleMeeting] ❌ Error auto-creating lead:', createError);
            }
        } else {
            console.log(`[ScheduleMeeting] ✅ Active lead found: ${activeLead.id} (boardId: ${activeLead.boardId}, currentStageId: ${activeLead.stageId})`);
            const [board] = await db.select({ stages: kanbanBoards.stages })
                .from(kanbanBoards)
                .where(eq(kanbanBoards.id, activeLead.boardId))
                .limit(1);

            if (!board) {
                console.log('[ScheduleMeeting] ⚠️ Board not found. Lead might be orphaned.');
            } else {
                const stages = (board.stages || []) as KanbanStage[];
                console.log(`[ScheduleMeeting] 📋 Board loaded with ${stages.length} stages`);
                const meetingStage = stages.find(s => s.semanticType === 'meeting_scheduled');

                if (!meetingStage) {
                    console.log('[ScheduleMeeting] ⚠️ No stage with semanticType="meeting_scheduled" found in this board.');
                    console.log('[ScheduleMeeting]    Available semantic types:', stages.map(s => `"${s.title}": ${s.semanticType || 'NONE'}`).join(', '));
                } else {
                    console.log(`[ScheduleMeeting] ✅ Meeting stage found: "${meetingStage.title}" (${meetingStage.id})`);
                    if (meetingStage.id === activeLead.stageId) {
                        console.log('[ScheduleMeeting] ℹ️ Lead already in meeting stage. No movement needed.');
                    } else {
                        console.log(`[ScheduleMeeting] 🚀 Moving lead...`);
                        const moveResult = await moveLeadToStage({
                            leadId: activeLead.id,
                            newStageId: meetingStage.id,
                            companyId,
                        });
                        if (moveResult.success) {
                            console.log(`[ScheduleMeeting] ✅ Lead ${activeLead.id} successfully auto-moved to "${meetingStage.title}"`);
                        } else {
                            console.log(`[ScheduleMeeting] ❌ Failed to move lead: ${moveResult.error || 'Unknown error'}`);
                        }
                    }
                }
            }
        }
    } catch (moveError) {
        console.error('[ScheduleMeeting] ❌ Error auto-moving lead:', moveError);
        // Non-blocking: meeting was created, lead movement is secondary
    }

    return {
        success: true,
        message: eventResult.meetLink
            ? `Reunião agendada para ${scheduledAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}. Link do Meet: ${eventResult.meetLink}`
            : `Reunião agendada para ${scheduledAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}.`,
        eventId: eventResult.eventId,
        meetLink: eventResult.meetLink,
        scheduledAt,
    };
}

/**
 * Tool definition for Gemini function calling
 */
export const scheduleMeetingToolDefinition = {
    name: 'schedule_meeting',
    description: 'Agenda uma reunião no Google Calendar do usuário. Use quando o cliente confirmar uma data e horário para reunião.',
    parameters: {
        type: 'object',
        properties: {
            date: {
                type: 'string',
                description: 'Data da reunião. Aceita: "hoje", "amanhã", "depois de amanhã", dia da semana ("segunda", "terça", "seg", "ter"), data numérica BR ("08/02/2026", "8/2", "08/02/26"), data ISO ("2026-02-08"), data por extenso ("8 de fevereiro de 2026", "15 de mar"), "semana que vem", "daqui a 3 dias". SEMPRE normalize para o formato mais simples possível.',
            },
            time: {
                type: 'string',
                description: 'Horário da reunião. Aceita: "14:00", "14h", "14h30", "14h30min", "2pm", "2:30 PM", "manhã" (=09:00), "tarde" (=14:00), "noite" (=19:00), "meio-dia" (=12:00). SEMPRE normalize para formato 24h quando possível (ex: "14:30").',
            },
            duration: {
                type: 'number',
                description: 'Duração em minutos (padrão: 30)',
            },
            title: {
                type: 'string',
                description: 'Título da reunião (opcional)',
            },
            attendeeEmail: {
                type: 'string',
                description: 'Email do participante para enviar convite (opcional, peça ao cliente se necessário)',
            },
        },
        required: ['date', 'time'],
    },
};
