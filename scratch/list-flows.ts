import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { automationFlows } = await import('../src/lib/db/schema');
  
  const flows = await db.select().from(automationFlows);
  for (const f of flows) {
    let hasCopilot = false;
    let logic: any = f.executionLogic;
    let steps = Array.isArray(logic) ? logic : logic?.steps;
    if (steps) {
      for (const step of steps) {
        if (step.type === 'ai_copilot') hasCopilot = true;
      }
    }
    console.log(f.id, f.name, hasCopilot ? '[HAS_COPILOT]' : '');
  }
  process.exit(0);
}
run();
