import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';

async function run() {
  const allConnections = await db.select({
    name: connections.config_name,
    status: connections.status,
    isActive: connections.isActive
  }).from(connections);
  
  console.log("Connections DB State:");
  console.table(allConnections);
  process.exit(0);
}

run();
