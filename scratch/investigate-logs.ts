import { db } from "../src/lib/db";
import { automationLogs } from "../src/lib/db/schema";
import { eq, desc } from "drizzle-orm";

async function run() {
  const convId = "c441f409-6024-4c02-b69a-e2304ce0111c";
  console.log("Searching for automation logs for this conversation...");
  const logListConv = await db.select().from(automationLogs)
    .where(eq(automationLogs.conversationId, convId))
    .orderBy(desc(automationLogs.createdAt))
    .limit(20);
  
  logListConv.reverse().forEach(l => console.log(`- [${l.createdAt}] ${l.level}: ${l.message} | details: ${JSON.stringify(l.details)}`));
}

run().catch(console.error).finally(() => process.exit(0));
