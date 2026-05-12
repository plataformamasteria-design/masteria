import 'dotenv/config';
import { db } from './src/lib/db';
import { conversations, connections } from './src/lib/db/schema';
import { eq, isNotNull } from 'drizzle-orm';

async function test() {
  const conv = await db.query.conversations.findFirst({
    where: isNotNull(conversations.connectionId),
    with: { connection: true }
  });
  console.log(conv);
  process.exit(0);
}
test().catch(console.error);
