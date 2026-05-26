import { db } from '../src/lib/db';
import { contacts } from '../src/lib/db/schema';
import { ilike } from 'drizzle-orm';

async function main() {
  const allContacts = await db.select().from(contacts).where(ilike(contacts.name, '%Ronivaldo Barela%'));
  console.log(`Found ${allContacts.length} Ronivaldo Barela`);
  for (const contact of allContacts) {
    console.log(contact.id);
    let cf = contact.customFields;
    if (typeof cf === 'string') {
      try { cf = JSON.parse(cf); } catch (e) { cf = null; }
    }
    console.log(JSON.stringify(cf, null, 2));
  }
  process.exit(0);
}

main().catch(console.error);
