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
  let nodes = Array.isArray(logic) ? logic : logic?.steps;
  if (!nodes) {
    console.log('No logic found');
    process.exit(0);
  }

  for (const node of nodes) {
    if (node.type === 'ai_agent') {
      console.log(`\n=== NODE: ${node.id} (${node.type}) ===`);
      console.log(JSON.stringify(node.data, null, 2));
    }
  }

  process.exit(0);
}

run().catch(console.error);
