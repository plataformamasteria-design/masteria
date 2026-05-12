import 'dotenv/config';
import { db } from './src/lib/db';
import { conversations, connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function test() {
  const conv = await db.query.conversations.findFirst({
    with: { connection: true }
  });
  console.log(conv?.connection);
  process.exit(0);
}
test().catch(console.error);
