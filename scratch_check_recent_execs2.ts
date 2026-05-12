import { db } from './src/lib/db';
import { automationFlowExecutions } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function run() {
  try {
    const execs = await db.query.automationFlowExecutions.findMany({
      orderBy: [desc(automationFlowExecutions.startedAt)],
      limit: 5
    });
    console.log(execs.map(e => ({
      id: e.id,
      flowId: e.flowId,
      status: e.status,
      currentStepId: e.currentStepId,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt,
      error: e.error
    })));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
