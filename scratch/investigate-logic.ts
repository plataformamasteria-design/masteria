import { db } from "../src/lib/db";
import { automationFlows } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const flowId = "cdef1914-bf9d-4ea3-9dd5-4431ba715c4c";
  const flows = await db.select().from(automationFlows).where(eq(automationFlows.id, flowId));
  if (flows.length > 0) {
      console.log(JSON.stringify(flows[0].executionLogic, null, 2));
  }
}

run().catch(console.error).finally(() => process.exit(0));
