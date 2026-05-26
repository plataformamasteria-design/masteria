import { db } from "../src/lib/db";
import { automationFlows } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const flowId = "cdef1914-bf9d-4ea3-9dd5-4431ba715c4c";
  const flow = await db.query.automationFlows.findFirst({
    where: eq(automationFlows.id, flowId)
  });
  
  if (flow) {
    const logic = flow.executionLogic as any;
    const steps = Array.isArray(logic) ? logic : logic?.steps || [];
    const aiNode = steps.find((s: any) => s.type === "ai_agent" || s.type === "ai");
    console.log("Debounce:", aiNode.data.debounce_seconds);
    console.log("AI Model:", aiNode.data.model);
    console.log("Max turns:", aiNode.data.max_turns);
    
    const triggerNode = steps.find((s: any) => s.type === "message_received" || s.type === "trigger");
    console.log("\nTrigger node:", triggerNode);
  }
}

run().catch(console.error).finally(() => process.exit(0));
