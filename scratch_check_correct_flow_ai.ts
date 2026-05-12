import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.id, '8e742e70-7955-43fc-901a-9b16fbefb832') });
    const steps = Array.isArray(flow?.executionLogic) ? flow?.executionLogic : flow?.executionLogic?.steps;
    const aiStep = steps?.find(s => s.type === 'ai_agent');
    console.log(JSON.stringify(aiStep?.data, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
