import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.id, 'ea3bcbde-87bc-4bb8-82ff-3c89fd7dfe87') });
    console.log(JSON.stringify(flow?.executionLogic, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
