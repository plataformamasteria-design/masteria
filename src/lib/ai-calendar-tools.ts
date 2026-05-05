/**
 * AI Calendar Tools
 * Builds OpenAI-compatible function-calling tool definitions and executes them
 * against googleCalendarService. Used by flow-engine.ts's 'ai_agent' case.
 */

import { googleCalendarService } from '@/services/google-calendar.service';
import { db } from '@/lib/db';
import { aiScheduledMeetings, contacts, conversations } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalendarToolConfig {
    companyId: string;
    createMeetLink: boolean;
    durationMinutes: number;
    workingHoursStart: number; // e.g. 9
    workingHoursEnd: number;   // e.g. 18
    calendarInstruction?: string;
}

export interface CalendarToolContext {
    contactName?: string;
    contactEmail?: string | null;
    contactPhone?: string;
    contactId?: string;
    conversationId?: string;
    config: CalendarToolConfig;
}

export interface CalendarToolResult {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
    meetLink?: string;
    eventId?: string;
}

// ─── Tool Definitions (OpenAI Function Calling format) ───────────────────────

export function buildCalendarTools(config: CalendarToolConfig): object[] {
    return [
        {
            type: 'function',
            function: {
                name: 'check_availability',
                description:
                    'Consulta os horários disponíveis na agenda para uma data específica. ' +
                    'Use quando o cliente quiser saber quando pode ser atendido ou antes de confirmar um agendamento.',
                parameters: {
                    type: 'object',
                    properties: {
                        date: {
                            type: 'string',
                            description:
                                'Data para consultar disponibilidade, no formato ISO 8601 (YYYY-MM-DD). ' +
                                'Calcule com base na data atual fornecida no contexto.',
                        },
                        duration_minutes: {
                            type: 'number',
                            description: `Duração desejada da reunião em minutos. Padrão: ${config.durationMinutes}.`,
                        },
                    },
                    required: ['date'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'create_appointment',
                description:
                    'Cria um agendamento na agenda. ' +
                    'Use SOMENTE após confirmar com o cliente o dia e horário desejados. ' +
                    `${config.createMeetLink ? 'Gera automaticamente um link do Google Meet.' : 'Cria o evento sem link de videoconferência.'}`,
                parameters: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Título do evento. Ex: "Consulta - João Silva"',
                        },
                        date: {
                            type: 'string',
                            description: 'Data do agendamento no formato ISO 8601 (YYYY-MM-DD).',
                        },
                        time: {
                            type: 'string',
                            description: 'Horário no formato HH:MM (24h). Ex: "14:00"',
                        },
                        duration_minutes: {
                            type: 'number',
                            description: `Duração em minutos. Padrão: ${config.durationMinutes}.`,
                        },
                        description: {
                            type: 'string',
                            description: 'Descrição opcional do evento.',
                        },
                        attendee_email: {
                            type: 'string',
                            description: 'E-mail do participante para envio de convite (opcional).',
                        },
                    },
                    required: ['title', 'date', 'time'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'update_appointment',
                description:
                    'Edita um agendamento existente (data, hora, título ou duração). ' +
                    'Use quando o cliente quiser remarcar ou alterar algum detalhe.',
                parameters: {
                    type: 'object',
                    properties: {
                        event_id: {
                            type: 'string',
                            description:
                                'ID do evento no Google Calendar. Obtido anteriormente via create_appointment ou list_appointments.',
                        },
                        title: { type: 'string', description: 'Novo título (opcional).' },
                        date: { type: 'string', description: 'Nova data ISO 8601 (opcional).' },
                        time: { type: 'string', description: 'Novo horário HH:MM (opcional).' },
                        duration_minutes: { type: 'number', description: 'Nova duração em minutos (opcional).' },
                        description: { type: 'string', description: 'Nova descrição (opcional).' },
                    },
                    required: ['event_id'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'cancel_appointment',
                description:
                    'Cancela e remove um agendamento da agenda. ' +
                    'Os participantes serão notificados automaticamente. ' +
                    'Use somente após confirmação explícita do cliente.',
                parameters: {
                    type: 'object',
                    properties: {
                        event_id: {
                            type: 'string',
                            description: 'ID do evento a cancelar.',
                        },
                        reason: {
                            type: 'string',
                            description: 'Motivo do cancelamento (opcional, para registro interno).',
                        },
                    },
                    required: ['event_id'],
                },
            },
        },
    ];
}

// ─── System Prompt Injection ──────────────────────────────────────────────────

export function buildCalendarSystemContext(config: CalendarToolConfig): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'full',
        timeStyle: 'short',
    });
    const dateStr = formatter.format(now);

    return (
        `[Contexto da Agenda]\n` +
        `Hoje é ${dateStr} (horário de Brasília).\n` +
        `Você tem acesso à agenda integrada. Use as ferramentas disponíveis para:\n` +
        `- Verificar horários disponíveis antes de confirmar qualquer agendamento\n` +
        `- Criar eventos ao confirmar data e hora com o cliente\n` +
        `- Editar agendamentos quando o cliente solicitar remarcação\n` +
        `- Cancelar agendamentos apenas com confirmação explícita\n` +
        `Duração padrão das reuniões: ${config.durationMinutes} minutos.\n` +
        `Horário de atendimento: ${config.workingHoursStart}h às ${config.workingHoursEnd}h.\n` +
        `${config.createMeetLink ? 'Ao criar um agendamento, um link do Google Meet será gerado automaticamente.' : 'Os agendamentos não incluem link de videoconferência.'}\n` +
        (config.calendarInstruction ? `\nInstrução adicional: ${config.calendarInstruction}\n` : '')
    );
}

// ─── Tool Executor ────────────────────────────────────────────────────────────

export async function executeCalendarTool(
    toolName: string,
    args: Record<string, unknown>,
    companyId: string,
    ctx: CalendarToolContext
): Promise<CalendarToolResult> {
    try {
        switch (toolName) {
            case 'check_availability':
                return await toolCheckAvailability(args, companyId, ctx.config);

            case 'create_appointment':
                return await toolCreateAppointment(args, companyId, ctx);

            case 'update_appointment':
                return await toolUpdateAppointment(args, companyId);

            case 'cancel_appointment':
                return await toolCancelAppointment(args, companyId);

            default:
                return { success: false, error: `Tool desconhecida: ${toolName}` };
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`[CalendarTool:${toolName}] Erro:`, msg);
        return { success: false, error: msg };
    }
}

// ─── Individual Tool Implementations ─────────────────────────────────────────

async function toolCheckAvailability(
    args: Record<string, unknown>,
    companyId: string,
    config: CalendarToolConfig
): Promise<CalendarToolResult> {
    const dateStr = args.date as string;
    const duration = (args.duration_minutes as number) || config.durationMinutes;

    if (!dateStr) return { success: false, error: 'Data não fornecida.' };

    const targetDate = new Date(dateStr + 'T00:00:00-03:00');
    if (isNaN(targetDate.getTime())) {
        return { success: false, error: `Data inválida: ${dateStr}` };
    }

    const slots = await googleCalendarService.suggestTimeSlots(
        companyId,
        targetDate,
        duration,
        config.workingHoursStart,
        config.workingHoursEnd
    );

    if (slots.length === 0) {
        return {
            success: true,
            data: {
                date: dateStr,
                available_slots: [],
                message: 'Nenhum horário disponível nesta data.',
            },
        };
    }

    const formatted = slots.slice(0, 6).map((slot) => {
        return slot.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
        });
    });

    return {
        success: true,
        data: {
            date: dateStr,
            duration_minutes: duration,
            available_slots: formatted,
            message: `${slots.length} horário(s) disponível(is). Exibindo os primeiros ${formatted.length}.`,
        },
    };
}

async function toolCreateAppointment(
    args: Record<string, unknown>,
    companyId: string,
    ctx: CalendarToolContext
): Promise<CalendarToolResult> {
    const { title, date, time, description, attendee_email } = args as {
        title: string;
        date: string;
        time: string;
        duration_minutes?: number;
        description?: string;
        attendee_email?: string;
    };

    if (!date || !time) return { success: false, error: 'Data e horário são obrigatórios.' };

    const [hours, minutes] = (time as string).split(':').map(Number);
    const startTime = new Date(`${date}T00:00:00-03:00`);
    startTime.setHours(hours ?? 9, minutes ?? 0, 0, 0);

    const duration = (args.duration_minutes as number) || ctx.config.durationMinutes;
    const attendeeEmail = (attendee_email as string) || ctx.contactEmail || undefined;

    const result = await googleCalendarService.createEvent(companyId, {
        title: title as string,
        description: (description as string) || `Agendado automaticamente via MasterIA`,
        startTime,
        durationMinutes: duration,
        attendeeEmail,
        attendeeName: ctx.contactName,
        createMeetLink: ctx.config.createMeetLink,
    });

    if (!result) {
        return { success: false, error: 'Falha ao criar evento. Verifique as credenciais do Google Calendar.' };
    }

    // Persist to aiScheduledMeetings
    try {
        await db.insert(aiScheduledMeetings).values({
            companyId,
            conversationId: ctx.conversationId || null,
            contactId: ctx.contactId || null,
            googleEventId: result.eventId,
            calendarId: result.calendarId,
            title: title as string,
            description: (description as string) || null,
            scheduledAt: startTime,
            durationMinutes: duration,
            attendeeEmail: attendeeEmail || null,
            attendeeName: ctx.contactName || null,
            meetLink: result.meetLink || null,
            status: 'scheduled',
        });
    } catch (dbErr) {
        console.warn('[CalendarTool:create] DB persist failed:', dbErr);
    }

    return {
        success: true,
        eventId: result.eventId,
        meetLink: result.meetLink,
        data: {
            event_id: result.eventId,
            calendar_link: result.htmlLink,
            meet_link: result.meetLink || null,
            scheduled_at: startTime.toISOString(),
            message: `Agendamento criado com sucesso para ${date} às ${time}.${result.meetLink ? ' Link do Meet gerado.' : ''}`,
        },
    };
}

async function toolUpdateAppointment(
    args: Record<string, unknown>,
    companyId: string
): Promise<CalendarToolResult> {
    const { event_id, title, date, time, duration_minutes, description } = args as {
        event_id: string;
        title?: string;
        date?: string;
        time?: string;
        duration_minutes?: number;
        description?: string;
    };

    if (!event_id) return { success: false, error: 'ID do evento não fornecido.' };

    let startTime: Date | undefined;
    if (date && time) {
        const [h, m] = time.split(':').map(Number);
        startTime = new Date(`${date}T00:00:00-03:00`);
        startTime.setHours(h ?? 0, m ?? 0, 0, 0);
    } else if (date) {
        startTime = new Date(`${date}T00:00:00-03:00`);
    }

    const success = await googleCalendarService.updateEvent(companyId, event_id, {
        title,
        description,
        startTime,
        durationMinutes: duration_minutes,
    });

    if (!success) {
        return { success: false, error: 'Falha ao atualizar o evento.' };
    }

    // Sync aiScheduledMeetings
    try {
        const updates: Record<string, unknown> = {};
        if (title) updates.title = title;
        if (description) updates.description = description;
        if (startTime) updates.scheduledAt = startTime;
        if (duration_minutes) updates.durationMinutes = duration_minutes;
        if (Object.keys(updates).length > 0) {
            await db.update(aiScheduledMeetings)
                .set(updates as any)
                .where(and(
                    eq(aiScheduledMeetings.googleEventId, event_id),
                    eq(aiScheduledMeetings.companyId, companyId)
                ));
        }
    } catch (dbErr) {
        console.warn('[CalendarTool:update] DB sync failed:', dbErr);
    }

    return {
        success: true,
        eventId: event_id,
        data: { event_id, message: 'Agendamento atualizado com sucesso.' },
    };
}

async function toolCancelAppointment(
    args: Record<string, unknown>,
    companyId: string
): Promise<CalendarToolResult> {
    const { event_id } = args as { event_id: string; reason?: string };

    if (!event_id) return { success: false, error: 'ID do evento não fornecido.' };

    const success = await googleCalendarService.cancelEvent(companyId, event_id);

    if (!success) {
        return { success: false, error: 'Falha ao cancelar o evento.' };
    }

    // Update aiScheduledMeetings status
    try {
        await db.update(aiScheduledMeetings)
            .set({ status: 'cancelled' })
            .where(and(
                eq(aiScheduledMeetings.googleEventId, event_id),
                eq(aiScheduledMeetings.companyId, companyId)
            ));
    } catch (dbErr) {
        console.warn('[CalendarTool:cancel] DB sync failed:', dbErr);
    }

    return {
        success: true,
        eventId: event_id,
        data: { event_id, message: 'Agendamento cancelado com sucesso.' },
    };
}

// ─── Helper: check if company has active Google credentials ──────────────────

export async function checkGoogleCredential(companyId: string): Promise<boolean> {
    const { googleCalendarCredentials } = await import('@/lib/db/schema');
    const [cred] = await db.select({ id: googleCalendarCredentials.id })
        .from(googleCalendarCredentials)
        .where(and(
            eq(googleCalendarCredentials.companyId, companyId),
            eq(googleCalendarCredentials.isActive, true)
        ))
        .limit(1);
    return !!cred;
}
