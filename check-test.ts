import { db } from './src/lib/db/index.js';
import { contacts } from './src/lib/db/schema.js';
import { inArray } from 'drizzle-orm';

async function check() {
  const c = await db.select().from(contacts).where(inArray(contacts.phone, ['5588920008007', '55889920008007']));
  console.log(c.map(x => ({ id: x.id, phone: x.phone, companyId: x.companyId })));
  process.exit(0);
}
check();
