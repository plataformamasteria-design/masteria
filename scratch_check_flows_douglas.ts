import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { ilike, eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const companyId = 'aca8c096-cf39-49a5-957a-2819b74ab2ab';
  
  const flows = await db.select().from(automationFlows).where(eq(automationFlows.companyId, companyId));
  
  if (flows.length === 0) {
    console.log('Nenhum fluxo encontrado.');
  } else {
    for (const f of flows) {
      console.log(`Flow: ${f.name} (ID: ${f.id})`);
    }
  }
  process.exit(0);
}

run().catch(console.error);
