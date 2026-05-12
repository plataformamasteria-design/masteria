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
    console.log(`\n=== NODE: ${node.id} (${node.type}) ===`);
    console.log(`Label: ${node.data?.label}`);
    if (node.type === 'ai_agent') {
      console.log(`timeout_amount: ${node.data?.timeout_amount}`);
      console.log(`timeout_unit: ${node.data?.timeout_unit}`);
      console.log(`response_timeout_minutes: ${node.data?.response_timeout_minutes}`);
    } else if (node.type === 'follow_up_ai') {
      console.log(`response_timeout_minutes: ${node.data?.response_timeout_minutes}`);
    }
    console.log('Connections:');
    if (node.connections) {
      for (const conn of node.connections) {
        console.log(`  ${conn.sourceHandle} -> ${conn.target}`);
      }
    }
  }

  process.exit(0);
}

run().catch(console.error);
