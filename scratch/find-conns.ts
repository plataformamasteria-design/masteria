import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { connections } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  
  const conns = await db.select().from(connections).where(eq(connections.companyId, '7cb4773e-1fab-4699-b35d-c70d9f8d9149'));
  console.log(JSON.stringify(conns, null, 2));
  process.exit(0);
}
run();
