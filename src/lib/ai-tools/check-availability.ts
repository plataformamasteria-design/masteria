/**
 * AI Check Availability Tool
 * Provides a function/tool for AI agents to check Google Calendar availability
 * BEFORE suggesting times to contacts.
 * 
 * This solves the critical issue where the AI would invent times without
 * consulting the actual calendar, leading to unavailable slots being offered.
 */

import { db } from '@/lib/db';
import { googleCalendarCredentials } from '@/lib/db/schema';
import { googleCalendarService } from '@/services/google-calendar.service';
import { eq, and } from 'drizzle-orm';
import { parseDateForAvailability } from '@/lib/ai-tools/date-time-parser';

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

interface CheckAvailabilityParams {
    companyId: string;
    date: string;        // "hoje", "amanhã", "terça", "8 de fevereiro", "2026-02-10", etc.
    duration?: number;   // duration in minutes (default 30)
}

interface CheckAvailabilityResult {
    success: boolean;
    message: string;
    date: string;
    dayOfWeek: string;
    availableSlots: string[];      // ["14:00", "14:30", "15:00"]
    totalAvailable: number;
}

// parseDateForAvailability is now imported from @/lib/ai-tools/date-time-parser

// ═══════════════════════════════════════════════════
// Main function
// ═══════════════════════════════════════════════════

export async function checkAvailability(params: CheckAvailabilityParams): Promise<CheckAvailabilityResult> {
    const { companyId } = params;
    const duration = params.duration || 30;

    // Verify Google Calendar is connected
    const [credential] = await db.select().from(googleCalendarCredentials)
        .where(and(
            eq(googleCalendarCredentials.companyId, companyId),
            eq(googleCalendarCredentials.isActive, true)
        ))
        .limit(1);

    if (!credential) {
        return {
            success: false,
            message: 'Google Calendar não está configurado.',
            date: params.date,
            dayOfWeek: '',
            availableSlots: [],
            totalAvailable: 0,
        };
    }

    // Parse the date
    const targetDate = parseDateForAvailability(params.date);
    if (!targetDate) {
        return {
            success: false,
            message: `Não consegui entender a data "${params.date}". Tente "hoje", "amanhã", "segunda", "8 de fevereiro", ou uma data como "10/02/2026".`,
            date: params.date,
            dayOfWeek: '',
            availableSlots: [],
            totalAvailable: 0,
        };
    }

    // Get "now" in BRT for comparison
    const nowUTC = new Date();
    const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
    const nowBRT = new Date(nowUTC.getTime() + BRT_OFFSET_MS);

    // Day of week names in Portuguese
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayOfWeek = diasSemana[targetDate.getUTCDay ? targetDate.getUTCDay() : new Date(targetDate).getDay()];

    // Format the target date for display
    const targetDateBRT = new Date(targetDate.getTime() + BRT_OFFSET_MS);
    const dateDisplay = `${String(targetDateBRT.getUTCDate()).padStart(2, '0')}/${String(targetDateBRT.getUTCMonth() + 1).padStart(2, '0')}/${targetDateBRT.getUTCFullYear()}`;

    // Call suggestTimeSlots (which now filters past times)
    const slots = await googleCalendarService.suggestTimeSlots(companyId, targetDate, duration);

    // Format slots to HH:MM in BRT
    const formattedSlots = slots.map(slot => {
        const slotBRT = new Date(slot.getTime() + BRT_OFFSET_MS);
        return `${String(slotBRT.getUTCHours()).padStart(2, '0')}:${String(slotBRT.getUTCMinutes()).padStart(2, '0')}`;
    });

    // Filter out any slots that are in the past (double safety)
    const filteredSlots = formattedSlots.filter(slotStr => {
        const [h, m] = slotStr.split(':').map(Number);
        // Check if target date is today
        const isToday =
            targetDateBRT.getUTCFullYear() === nowBRT.getUTCFullYear() &&
            targetDateBRT.getUTCMonth() === nowBRT.getUTCMonth() &&
            targetDateBRT.getUTCDate() === nowBRT.getUTCDate();

        if (!isToday) return true;

        // For today, only include slots at least 15 minutes in the future
        const nowMinutes = nowBRT.getUTCHours() * 60 + nowBRT.getUTCMinutes();
        const slotMinutes = h * 60 + m;
        return slotMinutes > nowMinutes + 15; // 15min buffer
    });

    if (filteredSlots.length === 0) {
        return {
            success: true,
            message: `Não há horários disponíveis para ${dayOfWeek}, ${dateDisplay}. Tente outro dia.`,
            date: dateDisplay,
            dayOfWeek,
            availableSlots: [],
            totalAvailable: 0,
        };
    }

    return {
        success: true,
        message: `Horários disponíveis para ${dayOfWeek}, ${dateDisplay}: ${filteredSlots.join(', ')}.`,
        date: dateDisplay,
        dayOfWeek,
        availableSlots: filteredSlots,
        totalAvailable: filteredSlots.length,
    };
}

// ═══════════════════════════════════════════════════
// Tool definition for Gemini Function Calling
// ═══════════════════════════════════════════════════

export const checkAvailabilityToolDefinition = {
    name: 'check_availability',
    description: 'Consulta os horários disponíveis no Google Calendar para uma data específica. SEMPRE use esta ferramenta ANTES de sugerir horários ao contato. Retorna a lista de horários livres.',
    parameters: {
        type: 'object',
        properties: {
            date: {
                type: 'string',
                description: 'Data a consultar. Aceita: "hoje", "amanhã", "segunda", "terça", "seg", "ter", "8 de fevereiro", "08/02/2026", "8/2", "2026-02-10", "semana que vem", "daqui a 3 dias". SEMPRE normalize para o formato mais simples possível.',
            },
            duration: {
                type: 'number',
                description: 'Duração desejada em minutos (padrão: 30)',
            },
        },
        required: ['date'],
    },
};

