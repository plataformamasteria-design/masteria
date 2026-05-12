import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.id, '8e742e70-7955-43fc-901a-9b16fbefb832') });
    console.log(flow?.name, flow?.isActive);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
