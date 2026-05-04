
import { db } from '../lib/db';
import { automationLogs } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function checkAllLogs() {
    console.log("=== 📜 CHECKING ALL AUTOMATION LOGS ===");

    const logs = await db.select({
        id: automationLogs.id,
        level: automationLogs.level,
        message: automationLogs.message,
        createdAt: automationLogs.createdAt,
        conversationId: automationLogs.conversationId
    })
    .from(automationLogs)
    .orderBy(desc(automationLogs.createdAt))
    .limit(20);

    if (logs.length === 0) {
        console.log("❌ Nenhum log encontrado na tabela automation_logs.");
    } else {
        console.log(`✅ Encontrados ${logs.length} logs recentes:`);
        logs.forEach(log => {
            console.log(`[${log.createdAt?.toISOString()}] [${log.level}] ${log.message} (Conv: ${log.conversationId})`);
        });
    }
}

checkAllLogs().catch(console.error).finally(() => process.exit());
