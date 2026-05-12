import { db } from './src/lib/db';
import { connections, contacts } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';

async function run() {
  const companyId = 'f28e5adf-ce84-436b-94c5-cd3941f254b7';
  const conns = await db.query.connections.findMany({
    where: eq(connections.companyId, companyId)
  });
  console.log("Connections:", conns.map(c => c.config_name));
  process.exit(0);
}
run();
