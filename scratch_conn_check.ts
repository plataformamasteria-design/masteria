import { db } from './src/lib/db';
import { conversations, connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const conv = await db.query.conversations.findFirst({ where: eq(conversations.id, '062482ff-f751-4c24-a36e-fac49b83a199') });
    const conn = await db.query.connections.findFirst({ where: eq(connections.id, conv.connectionId) });
    console.log('Convo:', conv.id, 'Conn:', conn?.connectionType, conn?.config_name);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
