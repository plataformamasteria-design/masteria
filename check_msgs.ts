import { db } from './src/lib/db';
import { messages, conversations, connections, contacts } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function check() {
  const recentMsgs = await db.select()
  .from(messages)
  .orderBy(desc(messages.createdAt))
  .limit(10);
  
  console.log(recentMsgs);
  process.exit(0);
}
check().catch(console.error);
