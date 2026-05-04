/**
 * Google Calendar - Calendars Endpoint
 * List calendars and manage active calendars for multi-calendar scheduling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { googleCalendarCredentials } from '@/lib/db/schema';
import { googleCalendarService } from '@/services/google-calendar.service';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - List calendars
export async function GET(request: NextRequest) {
    try {
        const session = await getUserSession();

        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const calendars = await googleCalendarService.listCalendars(session.user.companyId);

        // Get current credential with active calendars
        const [credential] = await db.select().from(googleCalendarCredentials)
            .where(eq(googleCalendarCredentials.companyId, session.user.companyId))
            .limit(1);

        return NextResponse.json({
            calendars: calendars.map(c => ({
                id: c.id,
                name: c.summary,
                primary: c.primary,
                accessRole: c.accessRole,
            })),
            selectedCalendarId: credential?.calendarId,
            activeCalendars: credential?.activeCalendars || [],
            schedulingMode: credential?.schedulingMode || 'fill_first',
        });
    } catch (error) {
        console.error('[Google Calendars] Error:', error);
        return NextResponse.json({ error: 'Failed to list calendars' }, { status: 500 });
    }
}

// POST - Select calendar(s). Supports both single and multi-calendar modes.
export async function POST(request: NextRequest) {
    try {
        const session = await getUserSession();

        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Multi-calendar mode: { activeCalendars: [...] }
        if (body.activeCalendars && Array.isArray(body.activeCalendars)) {
            const activeCalendars = body.activeCalendars.map((c: any, index: number) => ({
                id: c.id,
                name: c.name,
                priority: c.priority ?? (index + 1),
                isActive: c.isActive ?? true,
            }));

            // Also set the primary (priority 1) as the main calendarId for backward compat
            const primary = activeCalendars.find((c: any) => c.priority === 1) || activeCalendars[0];

            await db.update(googleCalendarCredentials)
                .set({
                    activeCalendars,
                    calendarId: primary?.id || null,
                    calendarName: primary?.name || null,
                    schedulingMode: body.schedulingMode || 'fill_first',
                })
                .where(eq(googleCalendarCredentials.companyId, session.user.companyId));

            return NextResponse.json({ success: true, activeCalendars });
        }

        // Single calendar mode (backward compat): { calendarId, calendarName }
        const { calendarId, calendarName } = body;

        if (!calendarId) {
            return NextResponse.json({ error: 'Calendar ID required' }, { status: 400 });
        }

        await db.update(googleCalendarCredentials)
            .set({
                calendarId,
                calendarName: calendarName || calendarId,
                activeCalendars: [{
                    id: calendarId,
                    name: calendarName || calendarId,
                    priority: 1,
                    isActive: true,
                }],
            })
            .where(eq(googleCalendarCredentials.companyId, session.user.companyId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Google Calendars] Error:', error);
        return NextResponse.json({ error: 'Failed to select calendar' }, { status: 500 });
    }
}
