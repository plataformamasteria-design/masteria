import { db } from '../src/lib/db';
import { companies, aiPersonas, contactsToContactLists } from '../src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function main() {
  const comps = await db.select().from(companies).where(ilike(companies.name, '%Empresa de Desenvolvimento Master%'));
  if (comps.length === 0) { console.log('Company not found'); return; }
  const companyId = comps[0].id;
  
  // Find Personas
  const personas = await db.select().from(aiPersonas).where(eq(aiPersonas.companyId, companyId));
  console.log('\n--- Personas ---');
  for (const p of personas) {
     console.log(p.id, '|', p.name);
  }

  // Count leads in the list
  const listId = '88cb53b2-56b6-4c6f-9baf-43a676602b80';
  const leads = await db.select().from(contactsToContactLists).where(eq(contactsToContactLists.contactListId, listId));
  console.log('\nLeads in "A Mesa Disparo":', leads.length);

  process.exit(0);
}

main().catch(console.error);
