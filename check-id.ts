import { db } from './src/lib/db/index.js';
import { contacts } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function check() {
  const c = await db.select().from(contacts).where(eq(contacts.id, '4902bcc4-6844-48db-965d-a9bde68ceff0'));
  console.log(c);
  process.exit(0);
}
check();
