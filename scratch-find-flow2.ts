import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { ilike } from 'drizzle-orm';

async function main() {
  const flows = await db.select({
    id: automationFlows.id,
    name: automationFlows.name,
    nodes: automationFlows.nodes,
    edges: automationFlows.edges,
    companyId: automationFlows.companyId,
  })
  .from(automationFlows)
  .where(ilike(automationFlows.name, '%GCR%'));
  
  for (const flow of flows) {
    console.log(`Flow ID: ${flow.id}, Name: ${flow.name}, Company: ${flow.companyId}`);
    // console.log(JSON.stringify(flow.nodes, null, 2));
    
    const fieldsNode = (flow.nodes as any[]).find(n => n.type === 'customFields');
    if (fieldsNode) {
      console.log('Custom Fields Node:');
      console.log(JSON.stringify(fieldsNode, null, 2));
    }
  }
  process.exit(0);
}

main().catch(console.error);
