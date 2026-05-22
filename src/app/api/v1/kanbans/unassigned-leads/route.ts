import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contacts, kanbanLeads } from '@/lib/db/schema';
import { eq, and, notInArray } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const assignedLeadsQuery = db.select({ contactId: kanbanLeads.contactId })
                                     .from(kanbanLeads)
                                     .where(eq(kanbanLeads.companyId, companyId));

        const unassignedContacts = await db.select()
            .from(contacts)
            .where(
                and(
                    eq(contacts.companyId, companyId),
                    notInArray(contacts.id, assignedLeadsQuery)
                )
            );

        return NextResponse.json(unassignedContacts);
    } catch (error) {
        console.error('Erro ao buscar leads não atribuídos:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
