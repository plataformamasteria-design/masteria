import { db } from '../src/lib/db';
import { automationLogs, flowExecutions } from '../src/lib/db/schema';
import { desc, eq, like } from 'drizzle-orm';

async function run() {
    console.log("Checking recent automation logs...");
    const logs = await db.query.automationLogs.findMany({
        orderBy: [desc(automationLogs.createdAt)],
        limit: 10
    });
    
    for (const log of logs) {
        console.log(`Log ID: ${log.id} | Action: ${log.action} | Status: ${log.status}`);
        console.log(`Details: ${JSON.stringify(log.details)}`);
        console.log('---');
    }

    console.log("\nChecking flow executions...");
    const execs = await db.query.flowExecutions.findMany({
        orderBy: [desc(flowExecutions.createdAt)],
        limit: 5
    });

    for (const ex of execs) {
        console.log(`Exec ID: ${ex.id} | Flow: ${ex.flowId} | Status: ${ex.status} | Steps: ${ex.currentStepIndex}`);
    }
}

run().catch(console.error).then(() => process.exit(0));
