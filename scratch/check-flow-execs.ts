import { db } from '../src/lib/db';
import { automationFlowExecutions, conversations } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    const conversationId = '75c5c756-6dc7-4e5c-b376-cb28abed29eb';

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
        limit: 10
    });

    for (const exec of execs) {
        console.log(`Execution ID: ${exec.id} | FlowID: ${exec.flowId} | Status: ${exec.status}`);
        console.log(`  State: ${JSON.stringify(exec.state)}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
