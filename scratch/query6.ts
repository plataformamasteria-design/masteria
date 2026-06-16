import { db } from '../src/lib/db';
import { automationFlows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149'; // Company ID from previous logs
  
  const flows = await db.select().from(automationFlows).where(eq(automationFlows.companyId, companyId));
  
  console.log(`Flows in company:`);
  for (const flow of flows) {
      console.log(`- Flow: ${flow.name} (${flow.id}), Active: ${flow.isActive}, Type: ${flow.triggerType}, Config: ${JSON.stringify(flow.triggerConfig)}`);
  }
  
  process.exit(0);
}

run().catch(console.error);
