import { db } from '../src/lib/db';
import { automationFlowExecutions, conversations, automationLogs } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    const conversationId = '541ac40f-8a62-4858-9c37-8979e741f362';

    const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId)
    });

    if (!conv || !conv.contactId) {
        console.log('No contact found');
        return;
    }

    console.log('\n--- FLOW EXECUTIONS ---');
    const execs = await db.query.automationFlowExecutions.findMany({
        where: eq(automationFlowExecutions.contactId, conv.contactId),
        orderBy: [desc(automationFlowExecutions.startedAt)],
        limit: 5
    });

    for (const exec of execs) {
        console.log(`\nExecution ID: ${exec.id} | FlowID: ${exec.flowId} | Status: ${exec.status}`);
        console.log(`  State: ${JSON.stringify(exec.state)}`);
        console.log(`  Error details: ${JSON.stringify(exec.errorDetails)}`);
    }

    console.log('\n--- AUTOMATION LOGS ---');
    const logs = await db.query.automationLogs.findMany({
        where: eq(automationLogs.conversationId, conversationId),
        orderBy: [desc(automationLogs.createdAt)],
        limit: 10
    });
    for (const log of logs) {
        console.log(`[${log.level}] ${log.message} | Details: ${JSON.stringify(log.details)}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
