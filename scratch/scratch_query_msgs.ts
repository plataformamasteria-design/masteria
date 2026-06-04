import { db } from "../src/lib/db";
import { eq, desc } from "drizzle-orm";
import { messages, conversations } from "../src/lib/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });

async function check() {
  const connectionId = "26c20a74-01d0-44e8-b2c8-4af5f3146ca1";

  const recentMsgs = await db.query.messages.findMany({
    where: eq(messages.connectionId, connectionId),
    orderBy: [desc(messages.sentAt)],
    limit: 5
  });

  console.log("Recent messages for this connection:");
  console.log(recentMsgs.map(m => ({ id: m.id, content: m.content, sentAt: m.sentAt })));

  const recentConvs = await db.query.conversations.findMany({
    where: eq(conversations.connectionId, connectionId),
    orderBy: [desc(conversations.lastMessageAt)],
    limit: 5
  });

  console.log("\nRecent conversations for this connection:");
  console.log(recentConvs.map(c => ({ id: c.id, lastMessageAt: c.lastMessageAt })));
}

check().catch(console.error).finally(() => process.exit(0));
