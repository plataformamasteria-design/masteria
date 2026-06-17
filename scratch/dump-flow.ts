import { db } from '../src/lib/db';
import { automationFlowExecutions, automationRules } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const exec = await db.query.automationFlowExecutions.findFirst({
        where: eq(automationFlowExecutions.id, '312cb72d-47ca-46ff-bf6f-2552ea3a6ac6')
    });
    
    if (!exec) {
        console.log('Execution not found');
        return;
    }

    const flow = await db.query.automationRules.findFirst({
        where: eq(automationRules.id, exec.flowId)
    });

    console.log(`Flow Name: ${flow?.name}`);
    console.log(`Flow Nodes: ${JSON.stringify(flow?.nodes)}`);
    console.log(`Edges: ${JSON.stringify(flow?.edges)}`);
    console.log(`Variables: ${JSON.stringify(exec?.variables)}`);
    console.log(`State: ${JSON.stringify(exec?.state)}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
