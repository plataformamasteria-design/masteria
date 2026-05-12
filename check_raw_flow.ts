import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const flows = await db.select().from(automationFlows)
    .where(eq(automationFlows.id, '0e70099f-aa1a-4078-98c3-d137bdd22cb0'));

  console.log("Douglas Bot Flow executionLogic:");
  console.log(JSON.stringify(flows[0].executionLogic, null, 2));
}

run().catch(console.error).finally(() => process.exit(0));
