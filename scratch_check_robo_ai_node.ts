import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.name, 'Nova Automação MasterFlow') });
    const steps = Array.isArray(flow?.executionLogic) ? flow?.executionLogic : flow?.executionLogic?.steps;
    const aiStep = steps?.find(s => s.type === 'ai_agent');
    console.log(JSON.stringify(aiStep, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
