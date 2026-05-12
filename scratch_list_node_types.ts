import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.name, 'Nova Automação MasterFlow') });
    const steps = Array.isArray(flow?.executionLogic) ? flow?.executionLogic : flow?.executionLogic?.steps;
    console.log(steps?.map(s => s.type));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
