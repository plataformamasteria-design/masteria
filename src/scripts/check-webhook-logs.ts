
import { db } from '../lib/db';
import { webhookLogs } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function checkWebhookLogs() {
    console.log("=== 📦 CHECKING WEBHOOK LOGS ===");

    const logs = await db.select({
        id: webhookLogs.id,
        createdAt: webhookLogs.createdAt,
        payload: webhookLogs.payload
    })
    .from(webhookLogs)
    .orderBy(desc(webhookLogs.createdAt))
    .limit(5);

    if (logs.length === 0) {
        console.log("❌ Nenhum log de webhook encontrado.");
    } else {
        console.log(`✅ Encontrados ${logs.length} logs de webhook recentes:`);
        logs.forEach(log => {
            console.log(`[${log.createdAt?.toISOString()}] ID: ${log.id}`);
            // console.log(JSON.stringify(log.payload, null, 2)); // Uncomment to see full payload
        });
    }
}

checkWebhookLogs().catch(console.error).finally(() => process.exit());
