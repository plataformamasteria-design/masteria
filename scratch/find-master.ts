import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const { db } = await import('../src/lib/db');
  const { companies } = await import('../src/lib/db/schema');
  const { like } = await import('drizzle-orm');
  
  const comps = await db.select().from(companies).where(like(companies.name, '%Master%'));
  console.log(JSON.stringify(comps, null, 2));
  process.exit(0);
}
run();
