import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { inArray } from 'drizzle-orm';

async function run() {
    const flowIds = ['1b8eb309-8d76-4d27-817c-0e78c85ad055', '0e70099f-aa1a-4078-98c3-d137bdd22cb0'];
    const flows = await db.query.automationFlows.findMany({
        where: (flow, { inArray }) => inArray(flow.id, flowIds)
    });
    for (const f of flows) {
        console.log(`\nFlow: ${f.name} (ID: ${f.id})`);
        console.log(JSON.stringify(f.executionLogic, null, 2));
    }
    process.exit(0);
}
run();
