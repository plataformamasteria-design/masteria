import { db } from '../src/lib/db';
import { automationFlowExecutions, automationLogs } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    const execId = '312cb72d-47ca-46ff-bf6f-2552ea3a6ac6'; // from previous check
    const exec = await db.query.automationFlowExecutions.findFirst({
        where: eq(automationFlowExecutions.id, execId)
    });
    console.log(`\n--- Execution ---`);
    console.log(`Status: ${exec?.status}`);
    console.log(`State: ${JSON.stringify(exec?.state)}`);
    console.log(`Error: ${exec?.error}`);

    console.log('\n--- Execution Logs ---');
    // In automationLogs, ruleId is usually the flowId, but where is the executionId? 
    // Is it in details.executionId?
    const logs = await db.query.automationLogs.findMany({
        where: eq(automationLogs.conversationId, '75c5c756-6dc7-4e5c-b376-cb28abed29eb'),
        orderBy: [desc(automationLogs.createdAt)],
        limit: 10
    });

    for (const log of logs.reverse()) {
        console.log(`[${log.createdAt?.toISOString()}] Node: ${log.nodeId} | Lvl: ${log.level} | Msg: ${log.message} | Details: ${JSON.stringify(log.details)}`);
    }

    // Check variables stored on conversation for this exec
    const { conversations } = await import('../src/lib/db/schema');
    const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, '75c5c756-6dc7-4e5c-b376-cb28abed29eb')
    });
    console.log(`\n--- Conversation Vars ---`);
    console.log(JSON.stringify(conv?.variables));

}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
