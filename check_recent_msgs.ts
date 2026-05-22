import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { desc } from 'drizzle-orm';

async function check() {
  const msgs = await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(10);
  console.log(msgs.map(m => m.content.substring(0, 50)));
  process.exit(0);
}
check().catch(console.error);
