import { db } from '../src/lib/db';
import { kanbanLeads, contacts } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'; // Empresa de Desenvolvimento Master

  const flatLeadsAndContacts = await db
      .select({
          leadId: kanbanLeads.id,
          contactId: contacts.id,
          contactName: contacts.name,
      })
      .from(kanbanLeads)
      .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
      .where(eq(kanbanLeads.companyId, companyId))
      .orderBy(desc(kanbanLeads.createdAt));
      
  const idCounts: Record<string, number> = {};
  let duplicates = 0;
  
  for (const item of flatLeadsAndContacts) {
      if (idCounts[item.leadId]) {
          idCounts[item.leadId]++;
          duplicates++;
          console.log(`Duplicate Lead ID found! ${item.leadId} - Contact: ${item.contactName}`);
      } else {
          idCounts[item.leadId] = 1;
      }
  }

  console.log(`\nTotal leads fetched: ${flatLeadsAndContacts.length}`);
  console.log(`Total duplicate IDs: ${duplicates}`);
  
  process.exit(0);
}

main().catch(console.error);
