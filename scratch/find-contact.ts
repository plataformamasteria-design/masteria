import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { contacts } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');
  
  const c = await db.select().from(contacts).where(and(eq(contacts.companyId, '7cb4773e-1fab-4699-b35d-c70d9f8d9149'), eq(contacts.phone, '5588920008007')));
  console.log(JSON.stringify(c, null, 2));
  process.exit(0);
}
run();
