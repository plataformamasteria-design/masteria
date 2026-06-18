import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { automationExecutions } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  
  const ex = await db.select().from(automationExecutions).where(eq(automationExecutions.id, '87eef9f2-25e2-4bd5-a1c2-c7f3b890885c'));
  console.log(JSON.stringify(ex, null, 2));
  process.exit(0);
}
run();
