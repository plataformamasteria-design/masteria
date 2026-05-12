/**
 * Google Calendar OAuth - Callback Endpoint
 * Handles OAuth callback and stores credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { googleCalendarCredentials } from '@/lib/db/schema';
import { googleCalendarService } from '@/services/google-calendar.service';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Get the correct base URL for redirects.
 * Uses NEXT_PUBLIC_APP_URL or reconstructs from request headers.
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
    const baseUrl = getBaseUrl(request);

    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle OAuth errors
        if (error) {
            console.error('[Google Callback] OAuth error:', error);
            return NextResponse.redirect(
                new URL(`/settings?error=${encodeURIComponent(error)}`, baseUrl)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL('/settings?error=missing_params', baseUrl)
            );
        }

        // Decode state
        let stateData: { companyId: string; userId: string; timestamp: number };
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        } catch {
            return NextResponse.redirect(
                new URL('/settings?error=invalid_state', baseUrl)
            );
        }

        // Validate timestamp (15 minutes max)
        if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
            return NextResponse.redirect(
                new URL('/settings?error=state_expired', baseUrl)
            );
        }

        // Exchange code for tokens
        const redirectUri = `${baseUrl}/api/v1/integrations/google/callback`;
        const tokens = await googleCalendarService.getTokensFromCode(code, redirectUri);

        if (!tokens.accessToken || !tokens.refreshToken) {
            return NextResponse.redirect(
                new URL('/settings?error=token_exchange_failed', baseUrl)
            );
        }

        // Check if credentials already exist for this company
        const existing = await db.select().from(googleCalendarCredentials)
            .where(eq(googleCalendarCredentials.companyId, stateData.companyId))
            .limit(1);

        if (existing.length > 0) {
            // Update existing credentials
            await db.update(googleCalendarCredentials)
                .set({
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    tokenExpiry: tokens.expiry,
                    userId: stateData.userId,
                    isActive: true,
                })
                .where(eq(googleCalendarCredentials.companyId, stateData.companyId));
        } else {
            // Create new credentials
            await db.insert(googleCalendarCredentials).values({
                companyId: stateData.companyId,
                userId: stateData.userId,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                tokenExpiry: tokens.expiry,
                isActive: true,
            });
        }

        // Redirect to success page
        return NextResponse.redirect(
            new URL('/settings?google_calendar=connected', baseUrl)
        );
    } catch (error) {
        console.error('[Google Callback] Error:', error);
        return NextResponse.redirect(
            new URL('/settings/integrations?error=callback_failed', baseUrl)
        );
    }
}
