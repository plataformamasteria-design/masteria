import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function run() {
  const flows = await db.select().from(automationFlows)
    .where(inArray(automationFlows.name, ['Cadastro Cliente - Boas Vindas', 'Douglas Bot']));

  for (const flow of flows) {
    console.log(`\n--- Flow: ${flow.name} (${flow.id}) ---`);
    console.log(`IsActive: ${flow.isActive}`);
    
    const logic = flow.executionLogic as any;
    const steps = Array.isArray(logic) ? logic : logic?.steps;
    
    if (!steps?.length) {
      console.log("No steps");
      continue;
    }

    const trigger = steps.find((s: any) => s.type === 'trigger');
    if (trigger) {
      console.log(`Trigger type: ${trigger.type}`);
      console.log(`Trigger data:`, JSON.stringify(trigger.data, null, 2));
    } else {
      console.log("No trigger found");
    }
  }
}

run().catch(console.error).finally(() => process.exit(0));
