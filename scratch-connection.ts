import 'dotenv/config';
import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const conn = await db.select().from(connections).where(eq(connections.id, 'e2790431-b5a0-4a07-9ded-23615103c981'));
  console.log('Connection:', conn);
  process.exit(0);
}
run();
