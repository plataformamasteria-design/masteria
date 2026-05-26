import { db } from '../src/lib/db';
import { companies, contacts, contactLists, kanbanBoards, funnels, tags } from '../src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';

async function main() {
  const comps = await db.select().from(companies).where(ilike(companies.name, '%Empresa de Desenvolvimento Master%'));
  if (comps.length === 0) { console.log('Company not found'); return; }
  const companyId = comps[0].id;
  
  // Check contact lists
  const lists = await db.select().from(contactLists).where(eq(contactLists.companyId, companyId));
  console.log('\n--- Contact Lists ---');
  for (const l of lists) {
     if (l.name?.toLowerCase().includes('mesa') || l.name?.toLowerCase().includes('disparo')) {
         console.log('List:', l.id, '|', l.name);
     }
  }

  // Check funnels/kanban boards
  const boards = await db.select().from(kanbanBoards).where(eq(kanbanBoards.companyId, companyId));
  console.log('\n--- Kanban Boards ---');
  for (const b of boards) {
     if (b.name?.toLowerCase().includes('mesa') || b.name?.toLowerCase().includes('disparo')) {
         console.log('Board:', b.id, '|', b.name);
     }
  }

  // Check funnels
  const fns = await db.select().from(funnels).where(eq(funnels.companyId, companyId));
  console.log('\n--- Funnels ---');
  for (const f of fns) {
     if (f.name?.toLowerCase().includes('mesa') || f.name?.toLowerCase().includes('disparo')) {
         console.log('Funnel:', f.id, '|', f.name);
     }
  }

  // Explore a single contact to see the bot field
  const sampleContact = await db.select().from(contacts).where(eq(contacts.companyId, companyId)).limit(1);
  if (sampleContact.length > 0) {
      console.log('\n--- Sample Contact Keys ---');
      console.log(Object.keys(sampleContact[0]));
  }
  
  process.exit(0);
}

main().catch(console.error);
