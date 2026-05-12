import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calendars } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { z } from 'zod';

const calendarSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  isGeneral: z.boolean().default(false),
  orderPosition: z.number().optional().default(0),
  googleCalendarId: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const data = await db.query.calendars.findMany({
      where: eq(calendars.companyId, session.companyId),
      orderBy: [asc(calendars.orderPosition)],
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[GET /api/v1/agenda/calendars]', error);
    return NextResponse.json({ error: 'Erro ao buscar calendários' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const body = await req.json();
    const result = calendarSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const newCalendar = await db.insert(calendars).values({
      companyId: session.companyId,
      createdBy: session.userId,
      name: result.data.name,
      color: result.data.color,
      isGeneral: result.data.isGeneral,
      orderPosition: result.data.orderPosition,
      googleCalendarId: result.data.googleCalendarId,
    }).returning();

    return NextResponse.json({ data: newCalendar[0] });
  } catch (error: any) {
    console.error('[POST /api/v1/agenda/calendars]', error);
    return NextResponse.json({ error: 'Erro ao criar calendário' }, { status: 500 });
  }
}
