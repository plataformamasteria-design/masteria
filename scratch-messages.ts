import 'dotenv/config';
import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select({
      content: messages.content,
      status: messages.status,
      senderType: messages.senderType
  }).from(messages).where(eq(messages.conversationId, 'd9d69692-827c-447a-9694-8d7cfe8c9b00'));
  console.log('Messages:', result);
  process.exit(0);
}
run();
