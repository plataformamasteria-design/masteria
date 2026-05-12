/**
 * Google Calendar OAuth - Connect Endpoint
 * Initiates OAuth flow for Google Calendar integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { googleCalendarService } from '@/services/google-calendar.service';

export const dynamic = 'force-dynamic';

/**
 * Get the correct base URL for redirects.
 */
function getBaseUrl(request: NextRequest): string {
    let url = process.env.NEXT_PUBLIC_APP_URL || '';
    url = url.replace(/['"]/g, '').trim();
    if (!url) {
        const forwardedHost = request.headers.get('x-forwarded-host');
        const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
        if (forwardedHost) {
            url = `${forwardedProto}://${forwardedHost}`;
        } else {
            const host = request.headers.get('host');
            if (host && !host.startsWith('0.0.0.0') && !host.startsWith('localhost')) {
                url = `https://${host}`;
            } else {
                url = request.nextUrl.origin;
            }
        }
    }
    
    let finalUrl = url.replace(/\/+$/, '');
    if (finalUrl.includes('up.railway.app')) {
        finalUrl = 'https://masteria.app';
    }
    return finalUrl;
}

export async function GET(request: NextRequest) {
    try {
        const session = await getUserSession();

        if (!session?.user?.companyId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const baseUrl = getBaseUrl(request);
        const redirectUri = `${baseUrl}/api/v1/integrations/google/callback`;

        // Create state with companyId and userId for callback
        const state = Buffer.from(JSON.stringify({
            companyId: session.user.companyId,
            userId: session.user.id,
            timestamp: Date.now(),
        })).toString('base64');

        const authUrl = googleCalendarService.getAuthUrl(state, redirectUri);

        return NextResponse.json({ authUrl });
    } catch (error) {
        console.error('[Google Connect] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate auth URL' },
            { status: 500 }
        );
    }
}
