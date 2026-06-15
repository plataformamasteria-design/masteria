import 'dotenv/config';
import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select({ content: messages.content }).from(messages).where(eq(messages.conversationId, '75c5c756-6dc7-4e5c-b376-cb28abed29eb'));
  console.log('Messages in 75c5c756:', result);
  process.exit(0);
}
run();
