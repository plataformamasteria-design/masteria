import 'dotenv/config';
import { db } from '../src/lib/db';
import { campaigns, connections } from '../src/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function run() {
  const allCampaigns = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(10);
  console.log("Last 10 campaigns:");
  allCampaigns.forEach(c => {
    console.log(`- ${c.id} | ${c.name} | ${c.status} | ConnId: ${c.connectionId} | created: ${c.createdAt}`);
  });

  const allConnections = await db.select().from(connections).where(eq(connections.config_name, 'Camila Brandão'));
  console.log("Camila Connections:", allConnections.map(c => ({ id: c.id, name: c.config_name })));
  
  process.exit(0);
}

run();
