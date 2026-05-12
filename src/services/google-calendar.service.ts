/**
 * Google Calendar Service
 * Handles OAuth authentication and calendar operations
 */

import { google, calendar_v3 } from 'googleapis';
import { db } from '@/lib/db';
import { googleCalendarCredentials, aiScheduledMeetings, calendarEvents, calendars } from '@/lib/db/schema';

// OAuth2 Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/integrations/google/callback`;

// Required scopes for calendar access
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
];

export class GoogleCalendarService {
    private oauth2Client: InstanceType<typeof google.auth.OAuth2>;

    constructor() {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            console.warn('[GoogleCalendar] Missing OAuth credentials - service will be disabled');
        }
        this.oauth2Client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            REDIRECT_URI
        );
    }

    /**
     * Generate OAuth authorization URL
     */
    getAuthUrl(state: string, redirectUri?: string): string {
        const client = redirectUri ? new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri) : this.oauth2Client;
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            state,
            prompt: 'consent', // Force consent to get refresh_token
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokensFromCode(code: string, redirectUri?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiry: Date | null;
    }> {
        const client = redirectUri ? new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri) : this.oauth2Client;
        const { tokens } = await client.getToken(code);

        return {
            accessToken: tokens.access_token || '',
            refreshToken: tokens.refresh_token || '',
            expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        };
    }

    /**
     * Refresh access token if expired
     */
    async refreshAccessToken(refreshToken: string): Promise<{
        accessToken: string;
        expiry: Date | null;
    }> {
        this.oauth2Client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await this.oauth2Client.refreshAccessToken();

        return {
            accessToken: credentials.access_token || '',
            expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        };
    }

    /**
     * Get authenticated calendar client for a company
     */
    async getCalendarClient(companyId: string): Promise<calendar_v3.Calendar | null> {
        const [credential] = await db.select().from(googleCalendarCredentials)
            .where(and(
                eq(googleCalendarCredentials.companyId, companyId),
                eq(googleCalendarCredentials.isActive, true)
            ))
            .limit(1);

        if (!credential) {
            console.log(`[GoogleCalendar] No credentials found for company ${companyId}`);
            return null;
        }

        // Check if token needs refresh
        if (credential.tokenExpiry && new Date() >= credential.tokenExpiry) {
            try {
                const { accessToken, expiry } = await this.refreshAccessToken(credential.refreshToken);

                // Update token in database
                await db.update(googleCalendarCredentials)
                    .set({
                        accessToken,
                        tokenExpiry: expiry,
                    })
                    .where(eq(googleCalendarCredentials.id, credential.id));

                credential.accessToken = accessToken;
            } catch (error) {
                console.error('[GoogleCalendar] Failed to refresh token:', error);
                return null;
            }
        }

        this.oauth2Client.setCredentials({
            access_token: credential.accessToken,
            refresh_token: credential.refreshToken,
        });

        return google.calendar({ version: 'v3', auth: this.oauth2Client });
    }

    /**
     * List user's calendars
     */
    async listCalendars(companyId: string): Promise<calendar_v3.Schema$CalendarListEntry[]> {
        const calendar = await this.getCalendarClient(companyId);
        if (!calendar) return [];

        try {
            const response = await calendar.calendarList.list();
            return response.data.items || [];
        } catch (error) {
            console.error('[GoogleCalendar] Failed to list calendars:', error);
            return [];
        }
    }

    /**
     * Get availability (free/busy) for a time range
     */
    async getAvailability(
        companyId: string,
        timeMin: Date,
        timeMax: Date,
        calendarIdOverride?: string
    ): Promise<{ start: Date; end: Date }[]> {
        const calendar = await this.getCalendarClient(companyId);
        if (!calendar) return [];

        let targetCalendarId = calendarIdOverride;

        if (!targetCalendarId) {
            const [credential] = await db.select().from(googleCalendarCredentials)
                .where(eq(googleCalendarCredentials.companyId, companyId))
                .limit(1);
            targetCalendarId = credential?.calendarId || undefined;
        }

        if (!targetCalendarId) return [];

        try {
            const response = await calendar.freebusy.query({
                requestBody: {
                    timeMin: timeMin.toISOString(),
                    timeMax: timeMax.toISOString(),
                    items: [{ id: targetCalendarId }],
                },
            });

            const busy = response.data.calendars?.[targetCalendarId]?.busy || [];
            return busy.map(slot => ({
                start: new Date(slot.start || ''),
                end: new Date(slot.end || ''),
            }));
        } catch (error) {
            console.error('[GoogleCalendar] Failed to get availability:', error);
            return [];
        }
    }

    /**
     * Check if a specific time slot is available
     */
    async isSlotAvailable(
        companyId: string,
        startTime: Date,
        durationMinutes: number = 30,
        calendarIdOverride?: string
    ): Promise<boolean> {
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        const busySlots = await this.getAvailability(companyId, startTime, endTime, calendarIdOverride);
        return busySlots.length === 0;
    }

    /**
     * Resolves the correct Google Calendar ID based on internal calendar ID or global fallback
     */
    private async resolveTargetCalendarId(companyId: string, internalCalendarId?: string): Promise<string | undefined> {
        if (internalCalendarId) {
            const [calendar] = await db.select().from(calendars)
                .where(and(eq(calendars.id, internalCalendarId), eq(calendars.companyId, companyId)))
                .limit(1);
            if (calendar?.googleCalendarId) return calendar.googleCalendarId;
        }
        
        const [credential] = await db.select().from(googleCalendarCredentials)
            .where(eq(googleCalendarCredentials.companyId, companyId))
            .limit(1);
        return credential?.calendarId || undefined;
    }

    /**
     * Create a calendar event (meeting)
     */
    async createEvent(
        companyId: string,
        event: {
            title: string;
            description?: string;
            startTime: Date;
            durationMinutes: number;
            attendeeEmail?: string;
            attendeeName?: string;
            createMeetLink?: boolean;
            calendarId?: string; // Override para multi-calendar
        }
    ): Promise<{
        eventId: string;
        meetLink?: string;
        htmlLink: string;
        calendarId: string;
    } | null> {
        const calendar = await this.getCalendarClient(companyId);
        if (!calendar) return null;

        const targetCalendarId = await this.resolveTargetCalendarId(companyId, event.calendarId);
        if (!targetCalendarId) return null;

        const endTime = new Date(event.startTime.getTime() + event.durationMinutes * 60 * 1000);

        const eventData: calendar_v3.Schema$Event = {
            summary: event.title,
            description: event.description || `Agendado automaticamente via MasterIA`,
            start: {
                dateTime: event.startTime.toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            attendees: event.attendeeEmail ? [
                { email: event.attendeeEmail, displayName: event.attendeeName }
            ] : undefined,
            conferenceData: event.createMeetLink ? {
                createRequest: {
                    requestId: `masteria-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            } : undefined,
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 60 },
                    { method: 'popup', minutes: 15 },
                ],
            },
        };

        try {
            const response = await calendar.events.insert({
                calendarId: targetCalendarId,
                requestBody: eventData,
                conferenceDataVersion: event.createMeetLink ? 1 : 0,
                sendUpdates: event.attendeeEmail ? 'all' : 'none',
            });

            const meetLink = response.data.conferenceData?.entryPoints?.find(
                e => e.entryPointType === 'video'
            )?.uri;

            return {
                eventId: response.data.id || '',
                meetLink: meetLink || undefined,
                htmlLink: response.data.htmlLink || '',
                calendarId: targetCalendarId,
            };
        } catch (error) {
            console.error('[GoogleCalendar] Failed to create event:', error);
            return null;
        }
    }

    /**
     * Update an existing event
     */
    async updateEvent(
        companyId: string,
        eventId: string,
        updates: Partial<{
            title: string;
            description: string;
            startTime: Date;
            durationMinutes: number;
        }>
    ): Promise<boolean> {
        const calendar = await this.getCalendarClient(companyId);
        if (!calendar) return false;

        const targetCalendarId = await this.resolveTargetCalendarId(companyId, updates.calendarId);
        if (!targetCalendarId) return false;

        try {
            const existing = await calendar.events.get({
                calendarId: targetCalendarId,
                eventId,
            });

            const eventData: calendar_v3.Schema$Event = {
                ...existing.data,
                summary: updates.title || existing.data.summary,
                description: updates.description || existing.data.description,
            };

            if (updates.startTime) {
                const duration = updates.durationMinutes || 30;
                const endTime = new Date(updates.startTime.getTime() + duration * 60 * 1000);
                eventData.start = {
                    dateTime: updates.startTime.toISOString(),
                    timeZone: 'America/Sao_Paulo',
                };
                eventData.end = {
                    dateTime: endTime.toISOString(),
                    timeZone: 'America/Sao_Paulo',
                };
            }

            await calendar.events.update({
                calendarId: targetCalendarId,
                eventId,
                requestBody: eventData,
            });

            return true;
        } catch (error) {
            console.error('[GoogleCalendar] Failed to update event:', error);
            return false;
        }
    }

    /**
     * Cancel/delete an event
     */
    async cancelEvent(companyId: string, eventId: string, internalCalendarId?: string | null): Promise<boolean> {
        const calendar = await this.getCalendarClient(companyId);
        if (!calendar) return false;

        const targetCalendarId = await this.resolveTargetCalendarId(companyId, internalCalendarId || undefined);
        if (!targetCalendarId) return false;

        try {
            await calendar.events.delete({
                calendarId: targetCalendarId,
                eventId,
                sendUpdates: 'all',
            });
            return true;
        } catch (error) {
            console.error('[GoogleCalendar] Failed to cancel event:', error);
            return false;
        }
    }

    /**
     * Suggest available time slots for a given date
     */
    async suggestTimeSlots(
        companyId: string,
        date: Date,
        durationMinutes: number = 30,
        workingHoursStart: number = 9,
        workingHoursEnd: number = 18
    ): Promise<Date[]> {
        // Set date to start of working hours
        const dayStart = new Date(date);
        dayStart.setHours(workingHoursStart, 0, 0, 0);

        const dayEnd = new Date(date);
        dayEnd.setHours(workingHoursEnd, 0, 0, 0);

        const busySlots = await this.getAvailability(companyId, dayStart, dayEnd);

        const availableSlots: Date[] = [];
        let currentTime = dayStart;

        // ⏰ FIX CRÍTICO: Se for hoje, pular horários que já passaram
        const now = new Date();
        if (now > dayStart && now < dayEnd) {
            // Arredondar para o próximo slot de 30 minutos + 15 min buffer
            const bufferMs = 15 * 60 * 1000; // 15 minutos de margem
            const nowPlusBuffer = new Date(now.getTime() + bufferMs);
            const slotMs = 30 * 60 * 1000;
            const roundedMs = Math.ceil(nowPlusBuffer.getTime() / slotMs) * slotMs;
            const earliestSlot = new Date(roundedMs);
            if (earliestSlot > currentTime) {
                currentTime = earliestSlot;
                console.log(`[GoogleCalendar] ⏰ suggestTimeSlots: skipping past times, starting from ${currentTime.toISOString()}`);
            }
        }

        while (currentTime.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
            const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);

            const isConflict = busySlots.some(busy =>
                (currentTime >= busy.start && currentTime < busy.end) ||
                (slotEnd > busy.start && slotEnd <= busy.end) ||
                (currentTime <= busy.start && slotEnd >= busy.end)
            );

            if (!isConflict) {
                availableSlots.push(new Date(currentTime));
            }

            // Move to next 30-minute slot
            currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        }

        return availableSlots;
    }

    /**
     * Get active calendars for a company (backward compatible)
     * Returns activeCalendars from DB, falling back to single calendarId
     */
    async getActiveCalendars(companyId: string): Promise<Array<{ id: string; name: string; priority: number; isActive: boolean }>> {
        const [credential] = await db.select().from(googleCalendarCredentials)
            .where(and(
                eq(googleCalendarCredentials.companyId, companyId),
                eq(googleCalendarCredentials.isActive, true)
            ))
            .limit(1);

        if (!credential) return [];

        // Use activeCalendars if available, fallback to single calendarId
        const activeCalendars = (credential.activeCalendars as any[] || []).filter((c: any) => c.isActive);

        if (activeCalendars.length > 0) {
            return activeCalendars.sort((a: any, b: any) => a.priority - b.priority);
        }

        // Backward compat: single calendarId
        if (credential.calendarId) {
            return [{
                id: credential.calendarId,
                name: credential.calendarName || credential.calendarId,
                priority: 1,
                isActive: true,
            }];
        }

        return [];
    }

    /**
     * Get the scheduling mode for a company
     */
    async getSchedulingMode(companyId: string): Promise<'fill_first' | 'round_robin'> {
        const [credential] = await db.select({
            schedulingMode: googleCalendarCredentials.schedulingMode
        }).from(googleCalendarCredentials)
            .where(and(
                eq(googleCalendarCredentials.companyId, companyId),
                eq(googleCalendarCredentials.isActive, true)
            ))
            .limit(1);

        return (credential?.schedulingMode as 'fill_first' | 'round_robin') || 'fill_first';
    }

    /**
     * Find the first available calendar for a given time slot (multi-calendar)
     * Supports two modes:
     * - fill_first: Fill Calendar 1 completely, then Calendar 2, etc.
     * - round_robin: Distribute meetings across calendars in rotation
     */
    async findAvailableCalendar(
        companyId: string,
        startTime: Date,
        durationMinutes: number = 30,
        mode?: 'fill_first' | 'round_robin'
    ): Promise<{ id: string; name: string } | null> {
        const calendars = await this.getActiveCalendars(companyId);

        if (calendars.length === 0) {
            console.log('[GoogleCalendar] No active calendars configured');
            return null;
        }

        // Resolve mode from DB if not provided
        const schedulingMode = mode || await this.getSchedulingMode(companyId);

        if (schedulingMode === 'round_robin' && calendars.length > 1) {
            return this.findCalendarRoundRobin(companyId, calendars, startTime, durationMinutes);
        }

        // fill_first: try each calendar in priority order
        return this.findCalendarFillFirst(companyId, calendars, startTime, durationMinutes);
    }

    /**
     * Fill First mode: try each calendar in priority order
     */
    private async findCalendarFillFirst(
        companyId: string,
        calendars: Array<{ id: string; name: string; priority: number }>,
        startTime: Date,
        durationMinutes: number
    ): Promise<{ id: string; name: string } | null> {
        for (const cal of calendars) {
            const available = await this.isSlotAvailable(companyId, startTime, durationMinutes, cal.id);
            if (available) {
                console.log(`[GoogleCalendar] ✅ [fill_first] Calendar "${cal.name}" (priority ${cal.priority}) has availability`);
                return { id: cal.id, name: cal.name };
            }
            console.log(`[GoogleCalendar] ❌ [fill_first] Calendar "${cal.name}" (priority ${cal.priority}) is busy`);
        }
        return null;
    }

    /**
     * Round Robin mode: distribute across calendars in rotation
     * Checks which calendar was used last and tries the next one
     */
    private async findCalendarRoundRobin(
        companyId: string,
        calendars: Array<{ id: string; name: string; priority: number }>,
        startTime: Date,
        durationMinutes: number
    ): Promise<{ id: string; name: string } | null> {
        // Find the last meeting to determine which calendar was used
        const [lastMeeting] = await db.select({
            calendarId: aiScheduledMeetings.calendarId
        }).from(aiScheduledMeetings)
            .where(eq(aiScheduledMeetings.companyId, companyId))
            .orderBy(desc(aiScheduledMeetings.createdAt))
            .limit(1);

        // Determine starting index (next calendar after the last one used)
        let startIndex = 0;
        if (lastMeeting?.calendarId) {
            const lastIndex = calendars.findIndex(c => c.id === lastMeeting.calendarId);
            if (lastIndex >= 0) {
                startIndex = (lastIndex + 1) % calendars.length;
            }
        }

        // Try each calendar starting from the next in rotation
        for (let i = 0; i < calendars.length; i++) {
            const index = (startIndex + i) % calendars.length;
            const cal = calendars[index];
            if (!cal) continue;
            const available = await this.isSlotAvailable(companyId, startTime, durationMinutes, cal.id);
            if (available) {
                console.log(`[GoogleCalendar] ✅ [round_robin] Calendar "${cal.name}" (rotation index ${index}) has availability`);
                return { id: cal.id, name: cal.name };
            }
            console.log(`[GoogleCalendar] ❌ [round_robin] Calendar "${cal.name}" (rotation index ${index}) is busy`);
        }

        console.log('[GoogleCalendar] All calendars are busy for this slot');
        return null;
    }

    /**
     * Fetch events from Google Calendar and sync them to local database
     */
    async syncEventsFromGoogle(
        companyId: string,
        timeMin: Date,
        timeMax: Date
    ): Promise<void> {
        const calendarClient = await this.getCalendarClient(companyId);
        if (!calendarClient) return;

        // Fetch all calendars for this company that have a googleCalendarId
        const companyCalendars = await db.select().from(calendars).where(eq(calendars.companyId, companyId));
        
        const googleCalendarIdsToSync = new Set<string>();
        
        // Add globally connected calendar if exists
        const [credential] = await db.select().from(googleCalendarCredentials)
            .where(eq(googleCalendarCredentials.companyId, companyId))
            .limit(1);
        if (credential?.calendarId) googleCalendarIdsToSync.add(credential.calendarId);

        // Add mapped internal calendars
        for (const cal of companyCalendars) {
            if (cal.googleCalendarId) googleCalendarIdsToSync.add(cal.googleCalendarId);
        }

        if (googleCalendarIdsToSync.size === 0) return;

        try {
            for (const targetCalendarId of googleCalendarIdsToSync) {
                const response = await calendarClient.events.list({
                    calendarId: targetCalendarId,
                    timeMin: timeMin.toISOString(),
                    timeMax: timeMax.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime',
                });

                const items = response.data.items || [];
                if (items.length === 0) continue;

                // Find internal calendar ID to link if available
                const mappedInternalCalendar = companyCalendars.find(c => c.googleCalendarId === targetCalendarId);
                const internalCalendarId = mappedInternalCalendar?.id || null;

                // Fetch existing local events synced from Google for this specific Google Calendar
                const existingEvents = await db.select({
                    id: calendarEvents.id,
                    googleEventId: calendarEvents.googleEventId,
                }).from(calendarEvents).where(and(
                    eq(calendarEvents.companyId, companyId),
                    eq(calendarEvents.syncSource, 'google')
                ));

                const existingGoogleIds = new Set(existingEvents.map(e => e.googleEventId).filter(Boolean));

                for (const item of items) {
                    if (!item.id || item.status === 'cancelled') continue;

                    // Only sync if it's not already in the DB
                    if (!existingGoogleIds.has(item.id)) {
                        let start = item.start?.dateTime ? new Date(item.start.dateTime) : null;
                        let end = item.end?.dateTime ? new Date(item.end.dateTime) : null;
                        let allDay = false;

                        // Handle all-day events
                        if (!start && item.start?.date) {
                            start = new Date(item.start.date + 'T00:00:00');
                            allDay = true;
                        }
                        if (!end && item.end?.date) {
                            end = new Date(item.end.date + 'T23:59:59');
                        }

                        if (start && end) {
                            const meetLink = item.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
                            
                            await db.insert(calendarEvents).values({
                                companyId,
                                title: item.summary || 'Evento do Google',
                                description: item.description || null,
                                location: meetLink || item.location || null,
                                startTime: start,
                                endTime: end,
                                allDay,
                                color: mappedInternalCalendar?.color || '#4285F4',
                                googleEventId: item.id,
                                syncSource: 'google',
                                syncedFromGoogle: true,
                                calendarId: internalCalendarId, 
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[GoogleCalendar] Failed to sync events from Google:', error);
        }
    }
}

// Singleton instance
export const googleCalendarService = new GoogleCalendarService();
