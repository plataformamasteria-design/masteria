import { db } from "../src/lib/db";
import { automationFlows } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";

async function run() {
  const flowId = "cdef1914-bf9d-4ea3-9dd5-4431ba715c4c";
  const flows = await db.select().from(automationFlows).where(eq(automationFlows.id, flowId));
  if (flows.length > 0) {
      const logic = flows[0].executionLogic as any[];
      const trigger = logic.find(n => n.type === 'trigger');
      let result = "Trigger Node:\n" + JSON.stringify(trigger, null, 2) + "\n\n";
      
      const firstConnections = trigger?.connections || [];
      for (const conn of firstConnections) {
          const nextNode = logic.find(n => n.id === conn.target);
          result += "Next Node:\n" + JSON.stringify(nextNode, null, 2) + "\n\n";
      }
      fs.writeFileSync("scratch/nodes-output.json", result);
  }
}

run().catch(console.error).finally(() => process.exit(0));
