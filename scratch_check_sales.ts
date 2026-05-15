import 'dotenv/config';
import { db } from './src/lib/db';
import { messages } from './src/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

async function checkConvo(id: string) {
  const msgs = await db.select({
    content: messages.content,
    senderType: messages.senderType
  })
  .from(messages)
  .where(eq(messages.conversationId, id))
  .orderBy(asc(messages.sentAt));

  console.log(`\n=== CONVERSATION: ${id} ===`);
  const lastMsgs = msgs.slice(-10); // Last 10 messages
  for (const m of lastMsgs) {
    console.log(`[${m.senderType}]: ${m.content}`);
  }
}

async function run() {
  await checkConvo('f5fd04bd-5ded-4565-9e9c-901f99aa02a8'); // R$ 2424.52
  await checkConvo('632fdb98-a591-42ab-8d66-e15ae3f1926c'); // R$ 949.50
  await checkConvo('323fede8-e00d-4636-82ac-c48cc709f1e7'); // R$ 2300
  process.exit(0);
}

run();
