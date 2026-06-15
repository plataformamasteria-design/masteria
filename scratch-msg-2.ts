import 'dotenv/config';
import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

async function run() {
  const result = await db.select({ content: messages.content }).from(messages).where(eq(messages.conversationId, '6b23b3f6-c6cb-47ca-bd9b-202dcfa613d3')).orderBy(asc(messages.createdAt));
  console.log('Messages in 6b23b3f6:', result);
  process.exit(0);
}
run();
