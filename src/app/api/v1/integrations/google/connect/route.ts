/**
 * Google Calendar OAuth - Connect Endpoint
 * Initiates OAuth flow for Google Calendar integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { googleCalendarService } from '@/services/google-calendar.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getUserSession();

        if (!session?.user?.companyId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Create state with companyId and userId for callback
        const state = Buffer.from(JSON.stringify({
            companyId: session.user.companyId,
            userId: session.user.id,
            timestamp: Date.now(),
        })).toString('base64');

        const authUrl = googleCalendarService.getAuthUrl(state);

        return NextResponse.json({ authUrl });
    } catch (error) {
        console.error('[Google Connect] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate auth URL' },
            { status: 500 }
        );
    }
}
