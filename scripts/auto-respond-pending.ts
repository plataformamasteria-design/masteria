/**
 * Serviço de Verificação e Resposta Automática de Mensagens Pendentes
 * 
 * Este serviço verifica periodicamente se há mensagens de contatos (CONTACT)
 * que não foram respondidas pela IA e dispara o processamento automaticamente.
 * 
 * Pode ser executado como:
 * 1. Script manual: npx tsx scripts/auto-respond-pending.ts
 * 2. Cron job: Integrado ao sistema de background services
 */

import { db } from '../src/lib/db';
import { messages, conversations, connections } from '../src/lib/db/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '../src/lib/automation-engine';

interface PendingMessage {
    conversation_id: string;
    message_id: string;
    contact_name: string;
    contact_phone: string;
    connection_name: string;
    message_content: string;
    sent_at: Date;
    minutes_waiting: number;
}

/**
 * Busca mensagens de CONTACT que não foram respondidas pela IA
 * Critérios:
 * - Conversa com aiActive = true
 * - Última mensagem é do tipo CONTACT
 * - Não existe resposta AI posterior
 * - Mensagem foi enviada há mais de 30 segundos (para evitar race conditions)
 * - Mensagem foi enviada há menos de 24 horas (não processar mensagens muito antigas)
 */
async function findPendingMessages(maxAgeHours: number = 24, minAgeSeconds: number = 30): Promise<PendingMessage[]> {
    const result = await db.execute(sql`
        WITH last_contact_messages AS (
            SELECT 
                c.id as conversation_id,
                m.id as message_id,
                ct.name as contact_name,
                ct.phone as contact_phone,
                conn.config_name as connection_name,
                m.content as message_content,
                m.sent_at,
                EXTRACT(EPOCH FROM (NOW() - m.sent_at)) / 60 as minutes_waiting
            FROM conversations c
            JOIN contacts ct ON ct.id = c.contact_id
            JOIN connections conn ON conn.id = c.connection_id
            JOIN messages m ON m.conversation_id = c.id
            WHERE c.ai_active = true
            AND conn.assigned_persona_id IS NOT NULL
            AND m.sender_type = 'CONTACT'
            AND m.sent_at >= NOW() - INTERVAL '${sql.raw(String(maxAgeHours))} hours'
            AND m.sent_at <= NOW() - INTERVAL '${sql.raw(String(minAgeSeconds))} seconds'
            AND m.sent_at = (
                SELECT MAX(m2.sent_at) 
                FROM messages m2 
                WHERE m2.conversation_id = c.id
            )
        )
        SELECT * FROM last_contact_messages
        WHERE NOT EXISTS (
            SELECT 1 FROM messages m3 
            WHERE m3.conversation_id = last_contact_messages.conversation_id 
            AND m3.sender_type IN ('AI', 'USER', 'SYSTEM')
            AND m3.sent_at > last_contact_messages.sent_at
        )
        ORDER BY sent_at ASC
        LIMIT 100
    `);

    const data = Array.isArray(result) ? result : (result as any)?.rows || [];
    return data as PendingMessage[];
}

/**
 * Processa uma mensagem pendente, disparando a IA para responder
 */
async function processPendingMessage(msg: PendingMessage): Promise<boolean> {
    try {
        console.log(`🤖 Processando: ${msg.contact_name} - aguardando há ${Math.round(msg.minutes_waiting)} min`);

        await processIncomingMessageTrigger(msg.conversation_id, msg.message_id);

        console.log(`   ✅ IA disparada com sucesso!`);
        return true;
    } catch (error) {
        console.error(`   ❌ Erro ao processar: ${error}`);
        return false;
    }
}

/**
 * Executa a verificação e processamento de todas as mensagens pendentes
 */
async function runAutoResponder(options: {
    maxAgeHours?: number;
    minAgeSeconds?: number;
    dryRun?: boolean;
} = {}): Promise<{ found: number; processed: number; errors: number }> {
    const { maxAgeHours = 24, minAgeSeconds = 30, dryRun = false } = options;

    console.log('🔍 Buscando mensagens pendentes de resposta...\n');

    const pendingMessages = await findPendingMessages(maxAgeHours, minAgeSeconds);

    if (pendingMessages.length === 0) {
        console.log('✅ Nenhuma mensagem pendente encontrada!');
        return { found: 0, processed: 0, errors: 0 };
    }

    console.log(`📋 Encontradas ${pendingMessages.length} mensagens pendentes:\n`);
    console.log('─'.repeat(70));

    let processed = 0;
    let errors = 0;

    for (const msg of pendingMessages) {
        console.log(`\n📞 ${msg.contact_name} (${msg.contact_phone})`);
        console.log(`   Conexão: ${msg.connection_name}`);
        console.log(`   Mensagem: ${(msg.message_content || '').substring(0, 60)}...`);
        console.log(`   Aguardando há: ${Math.round(msg.minutes_waiting)} minutos`);

        if (dryRun) {
            console.log(`   ⏸️ [DRY RUN] Não processando...`);
            continue;
        }

        const success = await processPendingMessage(msg);
        if (success) {
            processed++;
        } else {
            errors++;
        }

        // Pequeno delay entre processamentos para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '═'.repeat(70));
    console.log('📊 RESUMO:');
    console.log(`   Mensagens encontradas: ${pendingMessages.length}`);
    console.log(`   Processadas com sucesso: ${processed}`);
    console.log(`   Erros: ${errors}`);

    return { found: pendingMessages.length, processed, errors };
}

/**
 * Modo de execução contínua (daemon)
 * Verifica a cada X segundos por novas mensagens pendentes
 */
async function runDaemon(intervalSeconds: number = 30): Promise<void> {
    console.log(`🔄 Iniciando daemon de auto-resposta (intervalo: ${intervalSeconds}s)`);
    console.log('   Pressione Ctrl+C para parar\n');

    while (true) {
        try {
            const result = await runAutoResponder({ maxAgeHours: 1, minAgeSeconds: 30 });

            if (result.found > 0) {
                console.log(`\n⏰ Próxima verificação em ${intervalSeconds} segundos...\n`);
            }
        } catch (error) {
            console.error('❌ Erro no ciclo do daemon:', error);
        }

        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
    }
}

// Execução principal
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--daemon')) {
        const intervalIndex = args.indexOf('--interval');
        const interval = intervalIndex !== -1 ? parseInt(args[intervalIndex + 1]) || 30 : 30;
        await runDaemon(interval);
    } else if (args.includes('--dry-run')) {
        await runAutoResponder({ dryRun: true });
        process.exit(0);
    } else {
        await runAutoResponder();
        process.exit(0);
    }
}

// Exportar funções para uso em outros módulos
export { findPendingMessages, processPendingMessage, runAutoResponder, runDaemon };

main().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
