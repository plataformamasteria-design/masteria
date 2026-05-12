import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const conn = await db.query.connections.findFirst({ where: eq(connections.id, '9e4cd1de-8555-4f85-8d91-e9d89ae1ed9b') });
    console.log(conn?.webhookUrl);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
