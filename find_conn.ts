import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { like, or } from 'drizzle-orm';

async function checkConnections() {
  const conns = await db.select().from(connections).where(or(like(connections.config_name, '%Deivid%'), like(connections.config_name, '%deivid%')));
  console.log(`Found ${conns.length} connections matching Deivid`);
  for (const c of conns) {
    console.log(`- [${c.connectionType}] ${c.config_name} (ID: ${c.id}, Status: ${c.status}, Company: ${c.companyId})`);
  }
  process.exit(0);
}

checkConnections().catch(console.error);
