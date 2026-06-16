import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const flowId = '765a3f6d-9cf1-4ad2-9b82-a7fd660556a4';
  
  const flowList = await db.select().from(automationFlows).where(eq(automationFlows.id, flowId)).limit(1);
  if (!flowList.length) {
    console.log('Flow not found');
    process.exit(1);
  }
  
  const flow = flowList[0];
  const logic = flow.executionLogic;
  const steps = Array.isArray(logic) ? logic : (logic as any).steps;
  
  for (const step of steps) {
    console.log(`- Node ID: ${step.id}, Type: ${step.type}`);
    if (step.id === 'ai_agent-1776816431980' || step.type === 'trigger') {
        console.log(JSON.stringify(step.data, null, 2));
    }
  }
  
  process.exit(0);
}

run().catch(console.error);
