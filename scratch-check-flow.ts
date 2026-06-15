import { db } from './src/lib/db/index.js';
import { automationFlowExecutions, automationExecutionLogs, contacts } from './src/lib/db/schema.js';
import { eq, desc, ilike } from 'drizzle-orm';

async function main() {
    const leadPhone = '%8892161399%';
    const execs = await db.query.automationFlowExecutions.findMany({
        with: {
            flow: true,
            contact: true
        },
        orderBy: [desc(automationFlowExecutions.startedAt)],
        limit: 10
    });

    const relevantExecs = execs.filter(e => e.contact?.phone?.includes('8892161399') || e.companyId === '2f07bde0-4ccd-4f7e-9a38-42dd5e698d97');

    console.log(`Found ${relevantExecs.length} relevant executions.`);
    for (const exec of relevantExecs) {
        console.log(`Company: ${exec.companyId}`);
        console.log(`Execution ID: ${exec.id}`);
        console.log(`Flow: ${exec.flow?.name} (${exec.flow?.id})`);
        console.log(`Contact: ${exec.contact?.name} (${exec.contact?.phone})`);
        console.log(`Status: ${exec.status}`);
        
        const logs = await db.query.automationExecutionLogs.findMany({
            where: eq(automationExecutionLogs.executionId, exec.id),
            orderBy: [desc(automationExecutionLogs.createdAt)]
        });
        
        console.log("Logs:");
        for (const log of logs) {
            console.log(`  [${log.level}] Node ${log.nodeId}: ${log.message} - Data: ${JSON.stringify(log.data)}`);
        }
        console.log("---------------------------------------------------");
    }
    process.exit(0);
}
main().catch(console.error);
