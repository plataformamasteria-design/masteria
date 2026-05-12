import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq, like } from 'drizzle-orm';

async function run() {
  try {
    const flows = await db.query.automationFlows.findMany({ where: like(automationFlows.name, '%MasterFlow%') });
    console.log(flows.map(f => ({ id: f.id, name: f.name, active: f.isActive, nodes: Array.isArray(f.executionLogic) ? f.executionLogic.map(n => n.type) : f.executionLogic?.steps?.map(n => n.type) })));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
