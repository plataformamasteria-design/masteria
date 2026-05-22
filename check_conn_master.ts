import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const conns = await db.select().from(connections).where(eq(connections.companyId, 'f28e5adf-ce84-436b-94c5-cd3941f254b7'));
  for (const c of conns) {
    console.log(`- [${c.connectionType}] ${c.config_name} (ID: ${c.id}, Status: ${c.status})`);
  }
  process.exit(0);
}
check().catch(console.error);
