import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contactEvents } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ contactId: string }> }
) {
    try {
        const { contactId } = await context.params;
        const companyId = await getCompanyIdFromSession();

        const events = await db.query.contactEvents.findMany({
            where: and(
                eq(contactEvents.contactId, contactId),
                eq(contactEvents.companyId, companyId)
            ),
            orderBy: [desc(contactEvents.createdAt)]
        });

        return NextResponse.json(events);
    } catch (error: any) {
        console.error('[GET /api/v1/contacts/:id/events] Erro:', error);
        return NextResponse.json({ error: 'Erro ao carregar histórico', details: error.message }, { status: 500 });
    }
}
