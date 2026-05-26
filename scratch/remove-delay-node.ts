import { db } from "../src/lib/db";
import { automationFlows } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const flowId = "cdef1914-bf9d-4ea3-9dd5-4431ba715c4c";
  
  const flow = await db.query.automationFlows.findFirst({
    where: eq(automationFlows.id, flowId)
  });
  
  if (!flow) return;
  
  let logic = flow.executionLogic as any;
  let steps = Array.isArray(logic) ? logic : logic?.steps;
  
  if (!steps) return;
  
  steps = steps.filter((s: any) => {
      if (s.type === 'delay' && s.data?.amount == 9999) {
          console.log(`Removing delay node ${s.id}`);
          return false;
      }
      return true;
  });
  
  const newLogic = Array.isArray(logic) ? steps : { ...logic, steps };
  await db.update(automationFlows).set({ executionLogic: newLogic }).where(eq(automationFlows.id, flowId));
  console.log("Flow updated successfully!");
}

run().catch(console.error).finally(() => process.exit(0));
