import { db } from './src/lib/db';
import { automationFlows, companies } from './src/lib/db/schema';
import { eq, like, ilike } from 'drizzle-orm';

async function check() {
  const allFlows = await db.query.automationFlows.findMany({
    where: ilike(automationFlows.name, '%ATIVAR ROBO%'),
    with: {
      company: true
    }
  });

  console.log("Flows encontrados com nome ATIVAR ROBO:");
  for (const f of allFlows) {
    console.log(`ID: ${f.id}`);
    console.log(`Company: ${f.company?.name}`);
    console.log(`IsActive: ${f.isActive}`);
    console.log(`Trigger:`, f.triggerType, f.triggerConfig);
    console.log(`ExecutionLogic count:`, Array.isArray(f.executionLogic) ? f.executionLogic.length : 'not array', typeof f.executionLogic);
    console.log('---');
  }
  process.exit(0);
}
check().catch(console.error);
