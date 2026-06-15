import { db } from './src/lib/db';
import { contacts, kanbanLeads } from './src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
    const leads = await db.select({ 
            kanbanCustomFields: kanbanLeads.customFields,
            contactCustomFields: contacts.customFields,
            contactNotes: contacts.notes,
            leadNotes: kanbanLeads.notes
        })
        .from(kanbanLeads)
        .leftJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
        .where(sql`kanban_leads.board_id = 'b7f872be-03db-4e3a-832c-f7c746aa14cc' AND contacts.custom_fields != '{}'::jsonb`)
        .limit(5);
    
    console.log(JSON.stringify(leads, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
