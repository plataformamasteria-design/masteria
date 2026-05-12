import { db } from './db';
import { connections, messages, contacts } from './db/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
  const allConnections = await db.select({
    id: connections.id,
    name: connections.name,
    provider: connections.provider
  }).from(connections).where(eq(connections.provider, 'evolution'));

  console.log("Evolution connections:");
  console.log(allConnections);

  const recentMessages = await db.select({
    id: messages.id,
    content: messages.content,
    senderType: messages.senderType,
    sentAt: messages.sentAt,
  }).from(messages)
    .orderBy(desc(messages.sentAt))
    .limit(10);

  console.log("\nRecent messages:");
  console.log(recentMessages);
  
  process.exit(0);
}

main().catch(console.error);
