import { db } from "../src/lib/db";
import { automationLogs } from "../src/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import * as fs from "fs";

async function run() {
  const convId = "c441f409-6024-4c02-b69a-e2304ce0111c";
  const logListConv = await db.select().from(automationLogs)
    .where(eq(automationLogs.conversationId, convId))
    .orderBy(desc(automationLogs.createdAt))
    .limit(30);
  
  let output = "";
  logListConv.reverse().forEach(l => {
      output += `- [${l.createdAt}] ${l.level}: ${l.message}\n`;
  });
  fs.writeFileSync("scratch/logs-output.txt", output);
}

run().catch(console.error).finally(() => process.exit(0));
