import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

async function run() {
  try {
    const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.id, '4089f957-acf9-4a2d-99fc-1bc1b4376cf2') });
    fs.writeFileSync('scratch_imported.json', JSON.stringify(flow?.executionLogic, null, 2), 'utf-8');
    console.log('done');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
