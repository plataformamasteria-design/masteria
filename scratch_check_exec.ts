import 'dotenv/config';
import { db } from './src/lib/db';
import { automationFlowExecutions } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function test() {
  const exec = await db.query.automationFlowExecutions.findFirst({
    where: eq(automationFlowExecutions.id, 'ecbeae3e-227a-47fd-af33-c258cb932f41')
  });

  if (!exec) {
    console.log("Execution not found");
    process.exit(0);
  }

  console.log(`Exec: ${exec.id}`);
  console.log(`currentStepId: ${exec.currentStepId}`);
  console.log(`status: ${exec.status}`);

  process.exit(0);
}
test().catch(console.error);
