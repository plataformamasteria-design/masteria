import { db } from '../src/lib/db';
import { automationLogs } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
    
    console.log('\n--- RECENT LOGS ---');
    const logs = await db.query.automationLogs.findMany({
        where: eq(automationLogs.companyId, companyId),
        orderBy: [desc(automationLogs.createdAt)],
        limit: 20
    });
    for (const log of logs) {
         console.log(`[${log.createdAt?.toISOString()}] Phone: ${log.contactPhone} | RuleID: ${log.ruleId} | NodeID: ${log.nodeId} | Status: ${log.status} | Msg: ${log.message}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
