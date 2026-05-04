
import { db } from '../src/lib/db';
import { automationLogs } from '../src/lib/db/schema';
import { desc } from 'drizzle-orm';

async function checkLogs() {
    console.log('🔍 Buscando logs de automação recentes (últimos 10)...');
    try {
        const logs = await db.select()
            .from(automationLogs)
            .orderBy(desc(automationLogs.createdAt))
            .limit(10);

        logs.forEach(l => {
            console.log(`[${l.level}] ${l.message}`);
        });
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkLogs();
