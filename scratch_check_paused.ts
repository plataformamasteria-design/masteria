import { db } from './src/lib/db';
import { automationFlowExecutions } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function run() {
  try {
    const execs = await db.query.automationFlowExecutions.findMany({
      where: eq(automationFlowExecutions.status, 'paused'),
      orderBy: [desc(automationFlowExecutions.startedAt)],
      limit: 10
    });
    console.log(execs.map(e => ({
      id: e.id,
      contactId: e.contactId,
      startedAt: e.startedAt,
    })));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
