
import { db } from '@/lib/db';
import { automationLogs, conversations, contacts } from '@/lib/db/schema';
import { desc, ilike, or, and, gt, eq, sql } from 'drizzle-orm';

async function checkAudioLogs() {
    console.log('🔍 Buscando logs de automação para diagnósticos de áudio (últimas 24h)...\n');

    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Using raw SQL for complex ILIKE OR logic which is cleaner than Drizzle OR chain sometimes
        const logs = await db
            .select({
                time: automationLogs.createdAt,
                level: automationLogs.level,
                message: automationLogs.message,
                details: automationLogs.details,
                contactName: contacts.name,
                contactPhone: contacts.phone
            })
            .from(automationLogs)
            .innerJoin(conversations, eq(automationLogs.conversationId, conversations.id))
            .leftJoin(contacts, eq(conversations.contactId, contacts.id))
            .where(and(
                gt(automationLogs.createdAt, twentyFourHoursAgo),
                or(
                    ilike(automationLogs.message, '%TTS%'),
                    ilike(automationLogs.message, '%audio%'),
                    ilike(automationLogs.message, '%voz%'),
                    ilike(automationLogs.message, '%speech%'),
                    ilike(automationLogs.message, '%baileys%'),
                    eq(automationLogs.level, 'ERROR')
                )
            ))
            .orderBy(desc(automationLogs.createdAt))
            .limit(50);

        if (logs.length === 0) {
            console.log('✅ Nenhum erro ou log suspeito de áudio/TTS encontrado nas últimas 24h.');
        } else {
            console.log(`⚠️ Encontrados ${logs.length} logs relevantes:\n`);
            logs.forEach(log => {
                const time = log.time.toLocaleString('pt-BR');
                const icon = log.level === 'ERROR' ? '❌' : 'ℹ️';
                console.log(`${icon} [${time}] [${log.level}] ${log.contactName || 'Desconhecido'} (${log.contactPhone})`);
                console.log(`   Msg: ${log.message}`);
                if (log.details && Object.keys(log.details as object).length > 0) {
                    console.log(`   Detalhes: ${JSON.stringify(log.details)}`);
                }
                console.log('---------------------------------------------------');
            });
        }

    } catch (error) {
        console.error('❌ Erro ao buscar logs:', error);
    } finally {
        process.exit(0);
    }
}

checkAudioLogs();
