import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const connectionId = '81994284-e8f0-4a2b-b17b-a9440a0d563a';
    const c = await db.query.connections.findFirst({
      where: eq(connections.id, connectionId)
    });
    console.log("WABA ID:", c?.wabaId);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
