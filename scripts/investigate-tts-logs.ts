
import { db } from '@/lib/db';
import { automationLogs } from '@/lib/db/schema';
import { desc, like } from 'drizzle-orm';

async function checkAutomationLogs() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  INVESTIGAÇÃO DE ERROS NO AUTOMATION ENGINE (TTS)              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    try {
        const logs = await db.select()
            .from(automationLogs)
            .where(like(automationLogs.message, '%TTS%'))
            .orderBy(desc(automationLogs.createdAt))
            .limit(20);

        if (logs.length === 0) {
            console.log('❌ Nenhum log de TTS encontrado (sucesso ou erro).');
            // Tentar logs de erro gerais recentes
            const errorLogs = await db.select()
                .from(automationLogs)
                .where(like(automationLogs.level, 'ERROR'))
                .orderBy(desc(automationLogs.createdAt))
                .limit(5);
            
            if (errorLogs.length > 0) {
                console.log('\n⚠️ Erros gerais recentes:');
                errorLogs.forEach(log => {
                    console.log(`[${log.createdAt?.toLocaleTimeString()}] ${log.message}`);
                    if (log.details) console.log(JSON.stringify(log.details, null, 2));
                });
            }
        } else {
            console.log(`✅ Encontrados ${logs.length} logs relacionados a TTS:`);
            logs.forEach(log => {
                const icon = log.level === 'ERROR' ? '❌' : (log.level === 'WARN' ? '⚠️' : 'ℹ️');
                console.log(`${icon} [${log.createdAt?.toLocaleTimeString()}] ${log.message}`);
                if (log.details && Object.keys(log.details).length > 0) {
                    console.log('   Details:', JSON.stringify(log.details));
                }
            });
        }

    } catch (error) {
        console.error('Erro ao buscar logs:', error);
    }
    process.exit(0);
}

checkAutomationLogs();
