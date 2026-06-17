import { db } from '../src/lib/db';
import { automationRules, automationFlowExecutions } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    const flowId = '5fa23500-0607-4cf7-9135-d25e076c760d';

    console.log('\n--- FLOW DEFINITION ---');
    const flow = await db.query.automationRules.findFirst({
        where: eq(automationRules.id, flowId)
    });
    console.log(`Flow ID: ${flow?.id}`);
    console.log(`Flow Name: ${flow?.name}`);
    console.log(`Nodes: ${JSON.stringify(flow?.nodes)}`);

    const exec = await db.query.automationFlowExecutions.findFirst({
        where: eq(automationFlowExecutions.id, '312cb72d-47ca-46ff-bf6f-2552ea3a6ac6')
    });
    console.log('\n--- EXECUTION DETAILS ---');
    console.log(`Status: ${exec?.status}`);
    console.log(`State: ${JSON.stringify(exec?.state)}`);
    console.log(`Error: ${exec?.error}`);

}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
