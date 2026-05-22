import { db } from './src/lib/db';
import { connections, companies } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const conns = await db.select().from(connections);
  const comps = await db.select().from(companies);

  const compMap = new Map(comps.map(c => [c.id, c.name]));

  console.log(`Found ${conns.length} total connections.`);
  for (const c of conns) {
    const compName = compMap.get(c.companyId) || 'Unknown';
    if (c.companyId === 'f28e5adf-ce84-436b-94c5-cd3941f254b7' || compName.includes('Master')) {
        console.log(`- [${c.connectionType}] ${c.config_name} (ID: ${c.id}, Company: ${compName} - ${c.companyId})`);
    }
  }
  process.exit(0);
}
check().catch(console.error);
