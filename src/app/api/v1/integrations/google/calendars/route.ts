import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { googleCalendarCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { googleCalendarService } from '@/services/google-calendar.service';

export async function GET(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const [credential] = await db.select().from(googleCalendarCredentials).where(eq(googleCalendarCredentials.companyId, session.companyId));

    if (!credential || !credential.isActive) {
      return NextResponse.json({ connected: false });
    }

    // Fetch live calendars from Google
    const calendars = await googleCalendarService.listCalendars(session.companyId);

    return NextResponse.json({
      connected: true,
      calendars: calendars.map(c => ({
        id: c.id,
        name: c.summary,
        primary: c.primary || false,
      })),
      selectedCalendarId: credential.calendarId,
      schedulingMode: credential.schedulingMode,
      activeCalendars: credential.activeCalendars || [],
    });
  } catch (error) {
    console.error('[GET /api/v1/integrations/google/calendars]', error);
    return NextResponse.json({ error: 'Erro ao buscar calendários do Google' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const body = await req.json();
    const { calendarId, calendarName, schedulingMode, activeCalendars } = body;

    const [credential] = await db.select().from(googleCalendarCredentials).where(eq(googleCalendarCredentials.companyId, session.companyId));

    if (!credential) {
      return NextResponse.json({ error: 'Conta do Google não conectada' }, { status: 400 });
    }

    const updates: any = {};
    if (calendarId !== undefined) updates.calendarId = calendarId;
    if (calendarName !== undefined) updates.calendarName = calendarName;
    if (schedulingMode !== undefined) updates.schedulingMode = schedulingMode;
    if (activeCalendars !== undefined) updates.activeCalendars = activeCalendars;

    await db.update(googleCalendarCredentials).set(updates).where(eq(googleCalendarCredentials.companyId, session.companyId));

    return NextResponse.json({ success: true, message: 'Configurações de calendário atualizadas' });
  } catch (error) {
    console.error('[POST /api/v1/integrations/google/calendars]', error);
    return NextResponse.json({ error: 'Erro ao atualizar configurações' }, { status: 500 });
  }
}
