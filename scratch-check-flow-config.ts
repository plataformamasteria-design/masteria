import { db } from './src/lib/db/index.js';
import { automationFlows } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
    const flowId = '6da0c07b-639c-44a7-9178-58fa158f833a';
    const flow = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.id, flowId)
    });
    console.log(JSON.stringify(flow?.flowData || flow?.nodes, null, 2));
    process.exit(0);
}
main().catch(console.error);
