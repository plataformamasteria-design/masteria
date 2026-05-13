import { NextResponse } from 'next/server';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { googleCalendarService } from '@/services/google-calendar.service';

export async function GET(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { searchParams } = new URL(req.url);
    const redirectUrl = searchParams.get('redirectUrl') || '/agenda';

    // Build dynamic redirect URI to prevent redirect_uri_mismatch
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const callbackUri = `${protocol}://${host}/api/v1/integrations/google/callback`;

    // State will carry companyId, redirectUrl, and the callback URI
    const stateObj = {
      c: session.companyId,
      r: redirectUrl,
      cb: callbackUri,
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');

    const authUrl = googleCalendarService.getAuthUrl(state, callbackUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[GET /api/v1/integrations/google/connect]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
