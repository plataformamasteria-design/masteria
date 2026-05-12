import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
    const flowId = '1b8eb309-8d76-4d27-817c-0e78c85ad055';
    const flow = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.id, flowId)
    });
    console.log("Flow in DB:", flow ? { id: flow.id, companyId: flow.companyId, name: flow.name } : "Not found");
    process.exit(0);
}
run();
