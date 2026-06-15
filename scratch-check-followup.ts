import { db } from './src/lib/db';
import { aiFollowupQueue, connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const followupId = "3d9bcbd0-91b0-4e3d-b56b-5fe1c2f80910";
    
    const followup = await db.query.aiFollowupQueue.findFirst({
        where: eq(aiFollowupQueue.id, followupId)
    });
    
    console.log("Follow-up:", followup);
    
    if (followup) {
        const conns = await db.query.connections.findMany({
            where: eq(connections.companyId, followup.companyId)
        });
        console.log("Company Connections:", conns.map(c => ({ id: c.id, isActive: c.isActive, type: c.connectionType })));
    }
}

main().catch(console.error).finally(() => process.exit(0));
