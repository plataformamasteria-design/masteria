import { db } from '../src/lib/db';
import { messages } from '../src/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import * as fs from 'fs';

async function run() {
  const msgs = await db.select({
    id: messages.id,
    sentAt: messages.sentAt,
    status: messages.status,
    senderType: messages.senderType,
    provider: messages.providerMessageId,
    content: messages.content
  }).from(messages)
    .where(eq(messages.senderType, 'AGENT'))
    .orderBy(desc(messages.sentAt)).limit(10);
  
  fs.writeFileSync('msgs.json', JSON.stringify(msgs, null, 2));
  process.exit(0);
}
run();
