import { db } from './src/lib/db';
import { contacts, conversations } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const c = await db.select().from(contacts).where(eq(contacts.id, '64d61301-0cb1-42b3-9b12-2335e6b2a276'));
  console.log('Contact 64d61301-0cb1-42b3-9b12-2335e6b2a276:', c);
  process.exit(0);
}
check().catch(console.error);
