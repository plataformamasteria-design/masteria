import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { automationExecutionLogs } = await import('../src/lib/db/schema');
  const { desc } = await import('drizzle-orm');
  
  const logs = await db.select().from(automationExecutionLogs).orderBy(desc(automationExecutionLogs.createdAt)).limit(15);
  
  console.log(logs.map(l => `[${l.createdAt}] Node: ${l.nodeType} | Status: ${l.status} | Message: ${l.message}`));
  process.exit(0);
}
run();
