import { db } from '../src/lib/db';
import { kanbanLeads, contacts } from '../src/lib/db/schema';
import { eq, inArray, ilike } from 'drizzle-orm';

async function main() {
  const allContacts = await db.select().from(contacts).where(ilike(contacts.name, '%Ronivaldo Barela%'));
  
  if (allContacts.length > 0) {
    const contact = allContacts[0];
    let cf = contact.customFields;
    if (typeof cf === 'string') {
      try { cf = JSON.parse(cf); } catch (e) { cf = null; }
    }
    console.log(JSON.stringify(cf, null, 2));
  }
  process.exit(0);
}

main().catch(console.error);
