import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.name, 'Nova Automação MasterFlow') });
    console.log(JSON.stringify(flow?.executionLogic, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
