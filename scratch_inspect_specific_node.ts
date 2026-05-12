import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0';
  
  const flow = await db.query.automationFlows.findFirst({
    where: eq(automationFlows.id, flowId)
  });
  
  const logic = flow?.executionLogic as any;
  for (const node of logic || []) {
    if (node.id === 'ai_agent_1777482851759' || node.id === 'follow_up_ai_1777483838957') {
      console.log(`Node: ${node.id}`);
      console.log(JSON.stringify(node.data, null, 2));
    }
  }

  process.exit(0);
}

run().catch(console.error);
