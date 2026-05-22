import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkConnections() {
  const companyId = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';
  const conns = await db.select().from(connections).where(eq(connections.companyId, companyId));
  console.log(`Found ${conns.length} connections for company ${companyId}`);
  for (const c of conns) {
    console.log(`- [${c.connectionType}] ${c.config_name} (ID: ${c.id}, Status: ${c.status})`);
  }
  process.exit(0);
}

checkConnections().catch(console.error);
