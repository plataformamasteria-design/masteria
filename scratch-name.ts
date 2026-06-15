import 'dotenv/config';
import { db } from './src/lib/db';
import { contacts } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select({
      phone: contacts.phone,
      name: contacts.name
  }).from(contacts).where(eq(contacts.name, 'Deivid Rodrigues'));
  console.log('Contacts named Deivid:', result);
  process.exit(0);
}
run();
