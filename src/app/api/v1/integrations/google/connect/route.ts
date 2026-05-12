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

    // State will carry companyId and redirectUrl
    const stateObj = {
      c: session.companyId,
      r: redirectUrl,
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');

    const authUrl = googleCalendarService.getAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[GET /api/v1/integrations/google/connect]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
