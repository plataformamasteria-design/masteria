/**
 * Serviço de Auto-Resposta para Mensagens Pendentes
 * 
 * Verifica periodicamente se há mensagens de contatos que não foram
 * respondidas pela IA e dispara o processamento automaticamente.
 * 
 * Integração: Inicializado automaticamente pelo init-worker.ts
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';

class PendingMessagesResponder {
    private static instance: PendingMessagesResponder | null = null;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;
    private checkIntervalMs = 60_000; // 60 segundos
    private maxAgeHours = 24;
    private minAgeSeconds = 45; // Aguarda 45s para evitar race condition com processamento normal

    private constructor() { }

    static getInstance(): PendingMessagesResponder {
        if (!PendingMessagesResponder.instance) {
            PendingMessagesResponder.instance = new PendingMessagesResponder();
        }
        return PendingMessagesResponder.instance;
    }

    /**
     * Inicia o serviço de verificação periódica
     */
    start(): void {
        if (this.intervalId) {
            console.log('[PendingMessagesResponder] Serviço já está rodando');
            return;
        }

        console.log(`[PendingMessagesResponder] 🚀 Iniciando serviço de auto-resposta (intervalo: ${this.checkIntervalMs / 1000}s)`);

        // Executa imediatamente na primeira vez
        this.checkAndRespond();

        // Configura o intervalo
        this.intervalId = setInterval(() => {
            this.checkAndRespond();
        }, this.checkIntervalMs);
    }

    /**
     * Para o serviço
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[PendingMessagesResponder] Serviço parado');
        }
    }

    /**
     * Executa a verificação e resposta
     */
    private async checkAndRespond(): Promise<void> {
        if (this.isRunning) {
            console.log('[PendingMessagesResponder] Verificação anterior ainda em andamento, pulando...');
            return;
        }

        this.isRunning = true;

        try {
            const pendingMessages = await this.findPendingMessages();

            if (pendingMessages.length > 0) {
                console.log(`[PendingMessagesResponder] 📋 Encontradas ${pendingMessages.length} mensagens pendentes`);

                for (const msg of pendingMessages) {
                    try {
                        console.log(`[PendingMessagesResponder] 🤖 Processando: ${msg.contact_name} (aguardando há ${Math.round(msg.minutes_waiting as number)} min)`);

                        // 🔧 BUG FIX: Verificar se há uma execução de flow ativa para este contato.
                        // Se houver, o flow engine já está gerenciando a conversa via resume —
                        // não reprocessar para evitar re-disparo e mensagens duplicadas de sistema.
                        const { db: dbCheck } = await import('@/lib/db');
                        const { sql: sqlCheck } = await import('drizzle-orm');
                        const activeFlowCheck = await dbCheck.execute(sqlCheck`
                            SELECT id FROM automation_flow_executions
                            WHERE contact_id = (
                                SELECT contact_id FROM conversations WHERE id = ${msg.conversation_id as string} LIMIT 1
                            )
                            AND status = 'running'
                            LIMIT 1
                        `);
                        const hasActiveFlow = Array.isArray(activeFlowCheck)
                            ? activeFlowCheck.length > 0
                            : (activeFlowCheck as any)?.rows?.length > 0;

                        if (hasActiveFlow) {
                            console.log(`[PendingMessagesResponder] ⏭️ Pulando ${msg.contact_name} — flow de automação ativo/pausado detectado`);
                            continue;
                        }

                        await processIncomingMessageTrigger(msg.conversation_id as string, msg.message_id as string);

                        console.log(`[PendingMessagesResponder] ✅ IA disparada para ${msg.contact_name}`);

                        // Pequeno delay entre processamentos
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (error) {
                        console.error(`[PendingMessagesResponder] ❌ Erro ao processar ${msg.contact_name}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('[PendingMessagesResponder] Erro na verificação:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Busca mensagens de CONTACT que não foram respondidas
     */
    private async findPendingMessages(): Promise<any[]> {
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
                AND m.sender_type = 'CONTACT'
                AND m.sent_at >= NOW() - INTERVAL '24 hours'
                AND m.sent_at <= NOW() - INTERVAL '45 seconds'
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
            LIMIT 50
        `);

        return Array.isArray(result) ? result : (result as any)?.rows || [];
    }

    /**
     * Configura o intervalo de verificação
     */
    setCheckInterval(ms: number): void {
        this.checkIntervalMs = ms;
        if (this.intervalId) {
            this.stop();
            this.start();
        }
    }
}

// Exporta a instância singleton
export const pendingMessagesResponder = PendingMessagesResponder.getInstance();

// Para uso direto
export default pendingMessagesResponder;
