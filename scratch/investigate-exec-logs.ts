import { db } from "../src/lib/db";
import { automationFlowExecutions } from "../src/lib/db/schema";
import { eq, desc } from "drizzle-orm";

async function run() {
  const contactId = "881182f7-ca59-4536-9943-ece8f8c10ecc";

  const execs = await db.query.automationFlowExecutions.findMany({
    where: eq(automationFlowExecutions.contactId, contactId)
  });
  
  console.log("Executions via Drizzle:");
  console.log(execs);
}

run().catch(console.error).finally(() => process.exit(0));
