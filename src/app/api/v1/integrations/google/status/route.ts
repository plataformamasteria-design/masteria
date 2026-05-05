/**
 * GET /api/v1/integrations/google/status
 * Returns whether the current company has an active Google Calendar credential.
 * Used by AIAgentNode.tsx to show connection status in the Agenda tab.
 */

import { NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { googleCalendarCredentials } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [cred] = await db
            .select({
                id: googleCalendarCredentials.id,
                calendarId: googleCalendarCredentials.calendarId,
                calendarName: googleCalendarCredentials.calendarName,
                isActive: googleCalendarCredentials.isActive,
                activeCalendars: googleCalendarCredentials.activeCalendars,
            })
            .from(googleCalendarCredentials)
            .where(
                and(
                    eq(googleCalendarCredentials.companyId, session.user.companyId),
                    eq(googleCalendarCredentials.isActive, true)
                )
            )
            .limit(1);

        if (!cred) {
            return NextResponse.json({ connected: false, calendarId: null, calendarName: null });
        }

        // Resolve active calendar name (multi-calendar support)
        const activeCalendars = (cred.activeCalendars as any[]) || [];
        const primaryCalendar = activeCalendars.find((c: any) => c.isActive && c.priority === 1);
        const displayName = primaryCalendar?.name || cred.calendarName || cred.calendarId;

        return NextResponse.json({
            connected: true,
            calendarId: primaryCalendar?.id || cred.calendarId,
            calendarName: displayName,
        });
    } catch (error) {
        console.error('[Google Status]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
