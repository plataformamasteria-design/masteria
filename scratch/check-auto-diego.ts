import { db } from '../src/lib/db';
import { automationLogs } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    const conversationId = '75c5c756-6dc7-4e5c-b376-cb28abed29eb';

    console.log('\n--- AUTOMATION LOGS ---');
    const logs = await db.query.automationLogs.findMany({
        where: eq(automationLogs.conversationId, conversationId),
        orderBy: [desc(automationLogs.createdAt)],
        limit: 50
    });

    for (const log of logs.reverse()) {
        console.log(`[${log.createdAt?.toISOString()}] Level: ${log.level} | Msg: ${log.message} | Details: ${JSON.stringify(log.details)}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
