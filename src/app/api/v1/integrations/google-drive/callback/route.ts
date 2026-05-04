// src/app/api/v1/integrations/google-drive/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { googleDriveService } from '@/services/google-drive.service';
import { db } from '@/lib/db';
import { googleDriveCredentials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const stateParam = searchParams.get('state');
        const error = searchParams.get('error');

        console.log('[GoogleDrive Callback] Received callback:', {
            hasCode: !!code,
            hasState: !!stateParam,
            error: error || 'none',
            url: request.url.substring(0, 100) + '...',
        });

        // Helper to build redirect URL back to persona page
        const buildRedirectUrl = (personaId?: string, params?: string) => {
            if (personaId) {
                return `${baseUrl}/agentes-ia/${personaId}?tab=resources${params ? '&' + params : ''}`;
            }
            return `${baseUrl}/agentes-ia${params ? '?' + params : ''}`;
        };

        if (error) {
            console.error('[GoogleDrive Callback] OAuth error from Google:', error);
            return NextResponse.redirect(buildRedirectUrl(undefined, `google_drive=error&message=${error}`));
        }

        if (!code || !stateParam) {
            console.error('[GoogleDrive Callback] Missing code or state params');
            return NextResponse.redirect(buildRedirectUrl(undefined, 'google_drive=error&message=missing_params'));
        }

        // Decode state
        let state: { companyId: string; userId: string; personaId: string };
        try {
            state = JSON.parse(Buffer.from(stateParam, 'base64').toString());
            console.log('[GoogleDrive Callback] Decoded state:', {
                companyId: state.companyId,
                userId: state.userId,
                personaId: state.personaId,
            });
        } catch (e) {
            console.error('[GoogleDrive Callback] Failed to decode state:', e);
            return NextResponse.redirect(buildRedirectUrl(undefined, 'google_drive=error&message=invalid_state'));
        }

        console.log('[GoogleDrive Callback] Exchanging authorization code...');
        let credentials;
        try {
            credentials = await googleDriveService.getTokensFromCode(code);
            console.log('[GoogleDrive Callback] Authorization exchange success');
        } catch (exchangeError) {
            console.error('[GoogleDrive Callback] Authorization exchange FAILED:', exchangeError);
            return NextResponse.redirect(buildRedirectUrl(state.personaId, 'google_drive=error&message=token_exchange_failed'));
        }

        // Upsert credentials
        console.log('[GoogleDrive Callback] Saving credentials to database...');
        try {
            const existing = await db.select().from(googleDriveCredentials)
                .where(and(
                    eq(googleDriveCredentials.companyId, state.companyId),
                    eq(googleDriveCredentials.isActive, true)
                ))
                .limit(1);

            console.log('[GoogleDrive Callback] Existing credentials found:', existing.length);

            if (existing.length > 0) {
                const existingCred = existing[0]!;
                await db.update(googleDriveCredentials)
                    .set({
                        accessToken: credentials.accessToken,
                        refreshToken: credentials.refreshToken,
                        tokenExpiry: credentials.expiry,
                        userId: state.userId,
                        personaId: state.personaId || existingCred.personaId,
                    })
                    .where(eq(googleDriveCredentials.id, existingCred.id));
                console.log('[GoogleDrive Callback] Updated existing credential:', existingCred.id);
            } else {
                const [inserted] = await db.insert(googleDriveCredentials).values({
                    companyId: state.companyId,
                    userId: state.userId,
                    accessToken: credentials.accessToken,
                    refreshToken: credentials.refreshToken,
                    tokenExpiry: credentials.expiry,
                    personaId: state.personaId || null,
                }).returning();
                console.log('[GoogleDrive Callback] Inserted new credential:', inserted?.id);
            }
        } catch (dbError) {
            console.error('[GoogleDrive Callback] Database FAILED:', dbError);
            return NextResponse.redirect(buildRedirectUrl(state.personaId, 'google_drive=error&message=db_save_failed'));
        }

        const redirectUrl = buildRedirectUrl(state.personaId, 'google_drive=success');
        console.log(`[GoogleDrive Callback] SUCCESS! Redirecting to: ${redirectUrl}`);
        return NextResponse.redirect(redirectUrl);
    } catch (error) {
        console.error('[GoogleDrive Callback] Unhandled error:', error);
        return NextResponse.redirect(`${baseUrl}/agentes-ia?google_drive=error&message=unhandled_error`);
    }
}

