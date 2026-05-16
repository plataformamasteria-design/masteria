import 'dotenv/config';
import { db } from './src/lib/db';
import { kanbanLeads, contacts, contactsToTags, tags } from './src/lib/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';

async function test() {
    try {
        const boardId = '2496b926-6cfd-4634-8bb0-a1a3e9a95c67';
        console.log('Testing fetchLeadsData equivalent...');
        
        const flatLeadsAndContacts = await db
            .select({
              lead: kanbanLeads,
              contact: {
                id: contacts.id,
                companyId: contacts.companyId,
                name: contacts.name,
                whatsappName: contacts.whatsappName,
                phone: contacts.phone,
                email: contacts.email,
                avatarUrl: contacts.avatarUrl,
                status: contacts.status,
                notes: contacts.notes,
                profileLastSyncedAt: contacts.profileLastSyncedAt,
                addressStreet: contacts.addressStreet,
                addressNumber: contacts.addressNumber,
                addressComplement: contacts.addressComplement,
                addressDistrict: contacts.addressDistrict,
                addressCity: contacts.addressCity,
                addressState: contacts.addressState,
                addressZipCode: contacts.addressZipCode,
                createdAt: contacts.createdAt,
                externalId: contacts.externalId,
                externalProvider: contacts.externalProvider
              },
            })
            .from(kanbanLeads)
            .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
            .where(eq(kanbanLeads.boardId, boardId))
            .orderBy(asc(kanbanLeads.createdAt));

    } catch (e: any) {
        console.error('Postgres error detail:', e);
    }
    process.exit(0);
}
test();
