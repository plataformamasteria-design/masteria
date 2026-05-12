import { db } from './src/lib/db';
import { automationFlowExecutions } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function run() {
  try {
    const execs = await db.query.automationFlowExecutions.findMany({
      where: eq(automationFlowExecutions.flowId, 'ea3bcbde-87bc-4bb8-82ff-3c89fd7dfe87'),
      orderBy: [desc(automationFlowExecutions.startedAt)],
      limit: 10
    });
    console.log(execs.map(e => ({
      id: e.id,
      contactId: e.contactId,
      status: e.status,
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
