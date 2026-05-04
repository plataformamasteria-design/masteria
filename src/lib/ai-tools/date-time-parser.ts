/**
 * Comprehensive Date/Time Parser for AI Scheduling Tools
 * ═══════════════════════════════════════════════════════
 * Shared module used by schedule-meeting.ts and check-availability.ts
 * 
 * Handles ALL common Brazilian Portuguese date/time formats including:
 * - Relative dates: hoje, amanhã, depois de amanhã, semana que vem
 * - Weekday names: segunda-feira, terça, ter, seg, etc.
 * - Written months: "8 de fevereiro de 2026", "15 de mar"
 * - Numeric BR: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY, D/M
 * - ISO: YYYY-MM-DD
 * - Time formats: HH:MM, HHh, HHhMM, HHhMMmin, AM/PM, periods (manhã/tarde/noite)
 * - Ordinals: 1º/02/2026
 * 
 * ⚠️ CRITICAL: All dates are constructed in America/Sao_Paulo (BRT, UTC-3)
 * The server may run in UTC (Replit), so we use ISO strings with -03:00 offset.
 */

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3

/** Map of weekday name/abbreviation → JS day number (0=Sun, 1=Mon, ...) */
const WEEKDAY_MAP: Record<string, number> = {
    // Domingo
    'domingo': 0, 'dom': 0,
    // Segunda
    'segunda-feira': 1, 'segunda': 1, 'seg': 1,
    // Terça
    'terça-feira': 2, 'terca-feira': 2, 'terça': 2, 'terca': 2, 'ter': 2,
    // Quarta
    'quarta-feira': 3, 'quarta': 3, 'qua': 3,
    // Quinta
    'quinta-feira': 4, 'quinta': 4, 'qui': 4,
    // Sexta
    'sexta-feira': 5, 'sexta': 5, 'sex': 5,
    // Sábado
    'sábado': 6, 'sabado': 6, 'sáb': 6, 'sab': 6,
};

/** Map of month name/abbreviation → month number (0-indexed) */
const MONTH_MAP: Record<string, number> = {
    'janeiro': 0, 'jan': 0,
    'fevereiro': 1, 'fev': 1,
    'março': 2, 'marco': 2, 'mar': 2,
    'abril': 3, 'abr': 3,
    'maio': 4, 'mai': 4,
    'junho': 5, 'jun': 5,
    'julho': 6, 'jul': 6,
    'agosto': 7, 'ago': 7,
    'setembro': 8, 'set': 8,
    'outubro': 9, 'out': 9,
    'novembro': 10, 'nov': 10,
    'dezembro': 11, 'dez': 11,
};

/** Default hours for time-of-day expressions */
const PERIOD_DEFAULTS: Record<string, { hours: number; minutes: number }> = {
    'manhã': { hours: 9, minutes: 0 },
    'manha': { hours: 9, minutes: 0 },
    'tarde': { hours: 14, minutes: 0 },
    'noite': { hours: 19, minutes: 0 },
    'meio-dia': { hours: 12, minutes: 0 },
    'meio dia': { hours: 12, minutes: 0 },
    'meia-noite': { hours: 0, minutes: 0 },
    'meia noite': { hours: 0, minutes: 0 },
};

// ═══════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════

/** Get current date/time in BRT */
function getNowBRT(): Date {
    return new Date(Date.now() + BRT_OFFSET_MS);
}

/** Get the NEXT occurrence of a specific day of the week from a BRT date */
function getNextDayOfWeek(fromBRT: Date, targetDay: number): { year: number; month: number; day: number } {
    const currentDay = fromBRT.getUTCDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7; // Always go to NEXT week if today or past
    const target = new Date(fromBRT.getTime() + diff * 24 * 60 * 60 * 1000);
    return {
        year: target.getUTCFullYear(),
        month: target.getUTCMonth(),
        day: target.getUTCDate(),
    };
}

/** Add days to a BRT date and return year/month/day */
function addDays(fromBRT: Date, days: number): { year: number; month: number; day: number } {
    const target = new Date(fromBRT.getTime() + days * 24 * 60 * 60 * 1000);
    return {
        year: target.getUTCFullYear(),
        month: target.getUTCMonth(),
        day: target.getUTCDate(),
    };
}

/** Clean a date string: remove noise characters and normalize */
function cleanDateStr(raw: string): string {
    let s = raw.toLowerCase().trim();
    // Remove "dia " prefix
    s = s.replace(/^dia\s+/, '');
    // Remove ordinal markers: 1º → 1, 2ª → 2
    s = s.replace(/(\d+)[ºªo°]/g, '$1');
    // Remove trailing period from abbreviations: "fev." → "fev"
    s = s.replace(/\.\s/g, ' ').replace(/\.$/, '');
    // Normalize "proxima" → "próxima"
    s = s.replace(/pr[oó]xim[ao]/g, 'próxima');
    return s;
}

// ═══════════════════════════════════════════════════
// Date Parser
// ═══════════════════════════════════════════════════

interface ParsedDate {
    year: number;
    month: number; // 0-indexed
    day: number;
}

/**
 * Parse a date string into year/month/day components.
 * Handles relative dates, weekday names, written months, and numeric formats.
 */
export function parseDateOnly(dateStr: string): ParsedDate | null {
    const nowBRT = getNowBRT();
    const cleaned = cleanDateStr(dateStr);

    // ─── 1. Relative dates ───
    if (cleaned === 'hoje' || cleaned === 'today') {
        return { year: nowBRT.getUTCFullYear(), month: nowBRT.getUTCMonth(), day: nowBRT.getUTCDate() };
    }
    if (cleaned === 'amanhã' || cleaned === 'amanha' || cleaned === 'tomorrow') {
        return addDays(nowBRT, 1);
    }
    if (cleaned.includes('depois de amanhã') || cleaned.includes('depois de amanha')) {
        return addDays(nowBRT, 2);
    }

    // ─── 2. "semana que vem" (without specific weekday) → +7 days ───
    if (/^semana que vem$/.test(cleaned)) {
        return addDays(nowBRT, 7);
    }

    // ─── 3. "daqui a X dias" ───
    const daquiMatch = cleaned.match(/daqui\s+a?\s*(\d+)\s*dias?/);
    if (daquiMatch) {
        return addDays(nowBRT, parseInt(daquiMatch[1], 10));
    }

    // ─── 4. Weekday names (full, abbreviated, with "próxima", "que vem") ───
    // Remove "próxima" / "que vem" prefix/suffix for weekday matching
    const weekdayInput = cleaned
        .replace(/próxima\s+/g, '')
        .replace(/\s+que\s+vem$/g, '')
        .replace(/\s+próxima$/g, '')
        .trim();

    // Check if the (cleaned) string matches a weekday
    for (const [name, dayNum] of Object.entries(WEEKDAY_MAP)) {
        if (weekdayInput === name || weekdayInput.startsWith(name + ' ') || weekdayInput.startsWith(name + ',')) {
            return getNextDayOfWeek(nowBRT, dayNum);
        }
    }
    // Also check if the original cleaned text CONTAINS a weekday as a prefix (e.g. "segunda 8/2")
    // In this case we prioritize the numeric date if present
    // — this is handled below in the combined checks

    // ─── 5. Written month: "8 de fevereiro de 2026", "15 de mar" ───
    const writtenMonthMatch = cleaned.match(
        /(\d{1,2})\s+de\s+([a-záéíóúãõç]+)(?:\s+de\s+(\d{2,4}))?/
    );
    if (writtenMonthMatch) {
        const dayVal = parseInt(writtenMonthMatch[1], 10);
        const monthName = writtenMonthMatch[2];
        const monthNum = MONTH_MAP[monthName];
        if (monthNum !== undefined) {
            let yearVal = writtenMonthMatch[3]
                ? parseInt(writtenMonthMatch[3], 10)
                : nowBRT.getUTCFullYear();
            if (yearVal < 100) yearVal += 2000; // "26" → 2026
            return { year: yearVal, month: monthNum, day: dayVal };
        }
    }

    // ─── 6. Numeric formats ───
    // Remove any leading weekday or text before the numeric part
    // e.g., "segunda 8/2" → "8/2", "sexta 08/02/2026" → "08/02/2026"
    let numericStr = cleaned;
    for (const name of Object.keys(WEEKDAY_MAP)) {
        if (numericStr.startsWith(name)) {
            numericStr = numericStr.substring(name.length).replace(/^[\s,]+/, '').trim();
            // Remove "dia" again if present after weekday
            numericStr = numericStr.replace(/^dia\s+/, '');
            break;
        }
    }

    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (4-digit year)
    const fullDateMatch = numericStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (fullDateMatch) {
        return {
            day: parseInt(fullDateMatch[1], 10),
            month: parseInt(fullDateMatch[2], 10) - 1,
            year: parseInt(fullDateMatch[3], 10),
        };
    }

    // DD/MM/YY (2-digit year)
    const shortYearMatch = numericStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (shortYearMatch) {
        return {
            day: parseInt(shortYearMatch[1], 10),
            month: parseInt(shortYearMatch[2], 10) - 1,
            year: 2000 + parseInt(shortYearMatch[3], 10),
        };
    }

    // D/M (no year — assume current year, or next year if date has passed)
    const noYearMatch = numericStr.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
    if (noYearMatch) {
        const dayVal = parseInt(noYearMatch[1], 10);
        const monthVal = parseInt(noYearMatch[2], 10) - 1;
        let yearVal = nowBRT.getUTCFullYear();
        // If the date has already passed this year, use next year
        const candidateStr = `${yearVal}-${String(monthVal + 1).padStart(2, '0')}-${String(dayVal).padStart(2, '0')}T23:59:59-03:00`;
        const candidateDate = new Date(candidateStr);
        if (!isNaN(candidateDate.getTime()) && candidateDate.getTime() < Date.now()) {
            yearVal += 1;
        }
        return { day: dayVal, month: monthVal, year: yearVal };
    }

    // ─── 7. ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS ───
    const isoMatch = numericStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        return {
            year: parseInt(isoMatch[1], 10),
            month: parseInt(isoMatch[2], 10) - 1,
            day: parseInt(isoMatch[3], 10),
        };
    }

    // ─── 8. Fallback: try native Date parser ───
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return {
            year: parsed.getUTCFullYear(),
            month: parsed.getUTCMonth(),
            day: parsed.getUTCDate(),
        };
    }

    return null;
}

// ═══════════════════════════════════════════════════
// Time Parser
// ═══════════════════════════════════════════════════

interface ParsedTime {
    hours: number;
    minutes: number;
}

/**
 * Parse a time string into hours/minutes.
 * Handles: HH:MM, HHh, HHhMM, HHhMMmin, AM/PM, period-of-day, meio-dia, meia-noite
 */
export function parseTimeOnly(timeStr: string): ParsedTime | null {
    let s = timeStr.toLowerCase().trim();

    // ─── 1. Period-of-day defaults ───
    // Check for standalone period words
    for (const [period, time] of Object.entries(PERIOD_DEFAULTS)) {
        if (s === period || s === `de ${period}` || s === `à ${period}` || s === `a ${period}`) {
            return time;
        }
    }
    // "começo da tarde" / "início da manhã" etc.
    if (s.includes('começo da tarde') || s.includes('início da tarde') || s.includes('inicio da tarde')) {
        return { hours: 13, minutes: 0 };
    }
    if (s.includes('final da tarde') || s.includes('fim da tarde')) {
        return { hours: 17, minutes: 0 };
    }
    if (s.includes('começo da manhã') || s.includes('começo da manha') || s.includes('início da manhã') || s.includes('inicio da manha')) {
        return { hours: 8, minutes: 0 };
    }
    if (s.includes('final da manhã') || s.includes('final da manha') || s.includes('fim da manhã') || s.includes('fim da manha')) {
        return { hours: 11, minutes: 0 };
    }

    // ─── 2. Remove "da tarde", "da manhã", "da noite" modifiers and detect intent ───
    let isPM = false;
    let isAM = false;
    if (s.includes('da tarde') || s.includes('à tarde')) {
        isPM = true;
        s = s.replace(/da\s+tarde/g, '').replace(/à\s+tarde/g, '').trim();
    }
    if (s.includes('da noite') || s.includes('à noite')) {
        isPM = true;
        s = s.replace(/da\s+noite/g, '').replace(/à\s+noite/g, '').trim();
    }
    if (s.includes('da manhã') || s.includes('da manha') || s.includes('de manhã') || s.includes('de manha')) {
        isAM = true;
        s = s.replace(/d[ea]\s+manh[ãa]/g, '').trim();
    }

    // ─── 3. AM/PM suffixes ───
    if (/pm$/i.test(s)) {
        isPM = true;
        s = s.replace(/\s*pm$/i, '').trim();
    }
    if (/am$/i.test(s)) {
        isAM = true;
        s = s.replace(/\s*am$/i, '').trim();
    }
    // "4:52 PM" or "4 PM" style (PM/AM already stripped above)
    // Also check for " pm" / " am" with space
    if (/\s+pm$/i.test(s)) {
        isPM = true;
        s = s.replace(/\s+pm$/i, '').trim();
    }
    if (/\s+am$/i.test(s)) {
        isAM = true;
        s = s.replace(/\s+am$/i, '').trim();
    }

    // ─── 4. Clean and normalize remaining time string ───
    // Remove "às", "as", "a" prefixes
    s = s.replace(/^[àa]s?\s+/i, '').trim();
    // Remove "horas" / "hora"
    s = s.replace(/\s*horas?\s*/g, ' ').trim();
    // Remove "min" / "minutos" / "minuto"
    s = s.replace(/\s*min(uto)?s?\s*/g, '').trim();

    let hours: number;
    let minutes: number;

    // ─── 5. Try HHhMM or HHh format ───
    // "16h30", "16h", "9h45", "16h30min" (min already stripped)
    const hFormatMatch = s.match(/^(\d{1,2})h(\d{1,2})?$/);
    if (hFormatMatch) {
        hours = parseInt(hFormatMatch[1], 10);
        minutes = hFormatMatch[2] ? parseInt(hFormatMatch[2], 10) : 0;
    }
    // ─── 6. Try HH:MM:SS or HH:MM format ───
    else {
        const colonMatch = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
        if (colonMatch) {
            hours = parseInt(colonMatch[1], 10);
            minutes = parseInt(colonMatch[2], 10);
        }
        // ─── 7. Try standalone number (e.g., "4", "16") ───
        else {
            const numMatch = s.match(/^(\d{1,2})$/);
            if (numMatch) {
                hours = parseInt(numMatch[1], 10);
                minutes = 0;
            } else {
                // Nothing matched
                return null;
            }
        }
    }

    // ─── 8. Apply AM/PM conversion ───
    if (isPM && hours < 12) {
        hours += 12; // 4 PM → 16
    }
    if (isAM && hours === 12) {
        hours = 0; // 12 AM → 0
    }

    // ─── 9. Validate range ───
    if (isNaN(hours) || hours < 0 || hours > 23 || isNaN(minutes) || minutes < 0 || minutes > 59) {
        return null;
    }

    return { hours, minutes };
}

// ═══════════════════════════════════════════════════
// Combined Parsers (public API)
// ═══════════════════════════════════════════════════

/**
 * Parse date + time strings into a single Date object in BRT timezone.
 * Used by schedule-meeting.ts and reschedule-meeting.
 */
export function parseDateTime(dateStr: string, timeStr: string): Date | null {
    const date = parseDateOnly(dateStr);
    if (!date) return null;

    const time = parseTimeOnly(timeStr);
    if (!time) return null;

    // Build ISO string with BRT offset (-03:00)
    const isoStr = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}T${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}:00-03:00`;
    const result = new Date(isoStr);

    return isNaN(result.getTime()) ? null : result;
}

/**
 * Parse a date string into a Date at noon BRT for the target day.
 * Used by check-availability.ts (only needs date, not time).
 */
export function parseDateForAvailability(dateStr: string): Date | null {
    const date = parseDateOnly(dateStr);
    if (!date) return null;

    // Build Date at noon BRT for the target date
    const isoStr = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}T12:00:00-03:00`;
    const result = new Date(isoStr);

    return isNaN(result.getTime()) ? null : result;
}
