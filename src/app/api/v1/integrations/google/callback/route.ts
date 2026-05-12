import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { googleCalendarCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { googleCalendarService } from '@/services/google-calendar.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/agenda?error=${error}`, req.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/agenda?error=missing_params', req.url));
    }

    // Decode state
    let stateObj;
    try {
      stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch (e) {
      return NextResponse.redirect(new URL('/agenda?error=invalid_state', req.url));
    }

    const { c: companyId, r: redirectUrl } = stateObj;

    if (!companyId) {
      return NextResponse.redirect(new URL('/agenda?error=invalid_company', req.url));
    }

    // Exchange code for tokens
    const { accessToken, refreshToken, expiry } = await googleCalendarService.getTokensFromCode(code);

    if (!refreshToken) {
      // Se o usuário não deu consentimento para modo offline, o Google não envia refresh_token na segunda vez.
      // O ideal é sempre ter o prompt="consent" no getAuthUrl.
      console.warn('[Google Callback] No refresh token received, using existing or requires re-authentication.');
    }

    // Check if credentials already exist
    const [existing] = await db.select().from(googleCalendarCredentials).where(eq(googleCalendarCredentials.companyId, companyId));

    if (existing) {
      await db.update(googleCalendarCredentials).set({
        accessToken,
        refreshToken: refreshToken || existing.refreshToken, // Keep existing if new one is empty
        tokenExpiry: expiry,
        isActive: true,
        updatedAt: new Date(),
      }).where(eq(googleCalendarCredentials.id, existing.id));
    } else {
      await db.insert(googleCalendarCredentials).values({
        companyId,
        accessToken,
        refreshToken,
        tokenExpiry: expiry,
        isActive: true,
      });
    }

    // Redirect back to the agenda or original page
    const finalRedirect = redirectUrl || '/agenda';
    const redirectUrlObj = new URL(finalRedirect, req.url);
    redirectUrlObj.searchParams.set('google_connected', 'true');

    return NextResponse.redirect(redirectUrlObj);
  } catch (error) {
    console.error('[GET /api/v1/integrations/google/callback]', error);
    return NextResponse.redirect(new URL('/agenda?error=internal_error', req.url));
  }
}
