import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq, like } from 'drizzle-orm';

async function run() {
  try {
    const flows = await db.query.automationFlows.findMany({ where: like(automationFlows.name, '%Importado%') });
    console.log(flows.map(f => ({ id: f.id, name: f.name, active: f.isActive })));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
