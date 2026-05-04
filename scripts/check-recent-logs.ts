import { db } from '../src/lib/db';
import { automationLogs } from '../src/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

async function main() {
    const logs = await db.select({
        level: automationLogs.level,
        message: automationLogs.message,
        createdAt: automationLogs.createdAt
    })
        .from(automationLogs)
        .where(sql`${automationLogs.createdAt} > NOW() - INTERVAL '5 minutes'`)
        .orderBy(desc(automationLogs.createdAt))
        .limit(15);

    console.log('📋 Logs dos últimos 5 minutos:\n');

    for (const l of logs) {
        const time = l.createdAt?.toISOString().substring(11, 19);
        const icon = l.level === 'ERROR' ? '❌' : l.level === 'WARN' ? '⚠️' : '✅';
        const msg = (l.message || '').substring(0, 100);
        console.log(`[${time}] ${icon} ${msg}`);
    }

    if (logs.length === 0) {
        console.log('Nenhum log encontrado nos últimos 5 minutos.');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
});
