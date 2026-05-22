import { db } from './src/lib/db';
import { connections, metaAdAccounts } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const accounts = await db.select().from(metaAdAccounts).where(eq(metaAdAccounts.companyId, 'f28e5adf-ce84-436b-94c5-cd3941f254b7'));
  for (const a of accounts) {
    console.log(`- [META] ${a.name} (ID: ${a.id})`);
  }
  process.exit(0);
}
check().catch(console.error);
