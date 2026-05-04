import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, not, and, isNull, or } from 'drizzle-orm';
import { baileysBridge as sessionManager } from '@/lib/baileys-bridge-client';
import pino from 'pino';

const logger = pino({ level: 'info' });

export class SessionMonitor {
  private static instance: SessionMonitor;
  private isRunning: boolean = false;

  private constructor() { }

  public static getInstance(): SessionMonitor {
    if (!SessionMonitor.instance) {
      SessionMonitor.instance = new SessionMonitor();
    }
    return SessionMonitor.instance;
  }

  /**
   * Verifica e recupera sessões desconectadas.
   * Deve ser chamado periodicamente (ex: via Cron Job ou intervalo).
   */
  public async checkAndRecoverSessions() {
    if (this.isRunning) {
      logger.info('[SessionMonitor] Monitoramento já em execução. Ignorando ciclo.');
      return;
    }

    this.isRunning = true;
    logger.info('[SessionMonitor] Iniciando ciclo de verificação de sessões...');

    try {
      // 1. Buscar sessões Baileys ativas que não estão conectadas
      // Critério: connectionType = 'baileys' AND isActive = true AND status != 'connected'

      const disconnectedSessions = await db.select()
        .from(connections)
        .where(and(
          eq(connections.connectionType, 'baileys'),
          eq(connections.isActive, true),
          or(
            not(eq(connections.status, 'connected')),
            isNull(connections.status)
          )
        ));

      logger.info(`[SessionMonitor] Encontradas ${disconnectedSessions.length} sessões ativas mas desconectadas.`);

      for (const session of disconnectedSessions) {
        await this.recoverSession(session);
      }

    } catch (error: any) {
      logger.error({ err: error }, '[SessionMonitor] Erro crítico no ciclo de monitoramento');
      // Não lançar erro para não matar o worker
    } finally {
      this.isRunning = false;
      logger.info('[SessionMonitor] Ciclo de verificação finalizado.');
    }
  }

  private async recoverSession(session: typeof connections.$inferSelect) {
    logger.info(`[SessionMonitor] Tentando recuperar sessão ${session.id} (${session.companyId})...`);

    try {
      // Check session status via microservice API
      const existingSession = await sessionManager.getSessionStatusAsync(session.id);

      if (existingSession && existingSession.status) {
        // If exists in microservice, check the status
        logger.info(`[SessionMonitor] Sessão ${session.id} encontrada no microserviço. Status atual: ${existingSession.status}`);

        if (existingSession.status === 'connected') {
          // If connected in microservice but disconnected in DB, sync the DB
          logger.info(`[SessionMonitor] Sessão ${session.id} está conectada no microserviço mas desconectada no DB. Atualizando DB...`);
          await db.update(connections)
            .set({ status: 'connected', lastConnected: new Date() })
            .where(eq(connections.id, session.id));
          return;
        }

        // ✅ v2: If session is in QR state, update DB to reflect this
        // This prevents the infinite "Conectando" loop — shows "Aguardando QR" instead
        if (existingSession.status === 'qr' || existingSession.status === 'needs_qr') {
          logger.info(`[SessionMonitor] Sessão ${session.id} precisa de QR code. Atualizando DB para 'qr'.`);
          await db.update(connections)
            .set({ status: 'qr' })
            .where(eq(connections.id, session.id));
          return; // Don't call ensureSession again — it's already in QR state
        }
      }

      // Se não existe em memória ou não está conectada, tentar recuperar
      // O método ensureSession tenta recuperar do disco se existirem credenciais
      const result = await sessionManager.ensureSession(session.id, session.companyId);

      if (result.success) {
        logger.info(`[SessionMonitor] Sessão ${session.id} recuperada com sucesso.`);
      } else {
        logger.warn(`[SessionMonitor] Falha ao recuperar sessão ${session.id}: ${result.message} (Status: ${result.status})`);

        // ✅ v2: Update DB status based on the result to prevent infinite loop
        if (result.status === 'needs_qr' || result.status === 'qr') {
          await db.update(connections)
            .set({ status: 'qr' })
            .where(eq(connections.id, session.id));
          logger.info(`[SessionMonitor] DB atualizado para 'qr' para sessão ${session.id}`);
        } else if (result.status === 'failed') {
          await db.update(connections)
            .set({ status: 'failed' })
            .where(eq(connections.id, session.id));
        }
      }

    } catch (error) {
      logger.error(error, `[SessionMonitor] Falha ao recuperar sessão ${session.id}:`);
    }
  }
}
