import 'dotenv/config';
import { db } from './src/lib/db';
import { contacts } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select({
      phone: contacts.phone,
      name: contacts.name,
      whatsappName: contacts.whatsappName
  }).from(contacts).where(eq(contacts.phone, '5515991914069'));
  console.log('Contact:', result);
  process.exit(0);
}
run();
