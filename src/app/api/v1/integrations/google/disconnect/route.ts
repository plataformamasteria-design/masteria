import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { googleCalendarCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';

export async function POST(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    // We can either delete the credential or set isActive = false. Let's delete it completely.
    await db.delete(googleCalendarCredentials).where(eq(googleCalendarCredentials.companyId, session.companyId));

    return NextResponse.json({ success: true, message: 'Google Calendar desconectado com sucesso.' });
  } catch (error) {
    console.error('[POST /api/v1/integrations/google/disconnect]', error);
    return NextResponse.json({ error: 'Erro ao desconectar o Google Calendar' }, { status: 500 });
  }
}
