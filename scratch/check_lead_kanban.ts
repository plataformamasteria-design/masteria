import { db } from '../src/lib/db';
import { contacts, kanbanLeads } from '../src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function main() {
  const allContacts = await db.select().from(contacts).where(ilike(contacts.phone, '%88920008007%'));
  console.log(`Found ${allContacts.length} contacts with this phone.`);
  
  for (const ct of allContacts) {
      console.log(`Contact: ${ct.id} | ${ct.name} | ${ct.phone}`);
      const leads = await db.select().from(kanbanLeads).where(eq(kanbanLeads.contactId, ct.id));
      for (const l of leads) {
          console.log(`   -> KanbanLead ID: ${l.id} | Board: ${l.boardId} | Stage: ${l.stageId}`);
      }
  }

  process.exit(0);
}

main().catch(console.error);
