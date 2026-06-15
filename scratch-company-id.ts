import 'dotenv/config';
import { db } from './src/lib/db';
import { contacts } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      companyId: contacts.companyId
  }).from(contacts).where(eq(contacts.phone, '5515974035171'));
  console.log('Contacts:', result);
  process.exit(0);
}
run();
