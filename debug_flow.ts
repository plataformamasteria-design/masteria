import { db } from './src/lib/db';
import { automationExecutionLogs } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const logs = await db.select().from(automationExecutionLogs)
    .where(eq(automationExecutionLogs.executionId, 'a0946314-27ec-4ed1-bb9b-e230cf440869'));
  const ll = logs.find(l => l.nodeType === 'lookup_lead');
  console.log(JSON.stringify(ll, null, 2));
  process.exit(0);
}
check().catch(console.error);
