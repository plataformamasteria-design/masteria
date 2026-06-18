import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { automationFlows } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  
  const flows = await db.select().from(automationFlows).where(eq(automationFlows.companyId, '7cb4773e-1fab-4699-b35d-c70d9f8d9149'));
  const copilotFlows = flows.filter(f => JSON.stringify(f.executionLogic).includes('ai_copilot'));
  console.log(copilotFlows.map(f => ({id: f.id, name: f.name, active: f.isActive})));
  process.exit(0);
}
run();
