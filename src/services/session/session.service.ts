/**
 * ✅ FASE 2.2: Service Layer para Sessões WhatsApp (Refatorado para Evolution API)
 * Centraliza lógica de negócio e casos de uso
 */

import { sessionRepository, SessionData } from '@/repositories/session.repository';
import { evolutionApiService } from '@/services/evolution-api.service';
import { SessionCache } from '@/lib/cache/session-cache';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sessionCreationBreaker } from '@/utils/circuit-breaker';

export interface SessionWithRuntime extends SessionData {
  runtimeStatus: 'connecting' | 'connected' | 'disconnected' | 'qr' | 'failed' | 'none';
  hasAuth: boolean;
  effectiveStatus: string;
}

export interface CreateSessionResult {
  success: boolean;
  session?: SessionData;
  error?: string;
}

export interface DeleteSessionResult {
  success: boolean;
  message: string;
}

/**
 * Service para gerenciar sessões WhatsApp via Evolution API
 */
export class SessionService {
  /**
   * Lista todas as sessões de uma empresa com dados de runtime
   */
  async listSessions(companyId: string): Promise<SessionWithRuntime[]> {
    const sessionsWithRuntime = await SessionCache.getSessionsWithCache(
      companyId,
      async () => {
        // Find by company using 'evolution' or 'baileys' (legacy compatibility)
        const allSessions = await sessionRepository.findByCompany(companyId, 'baileys');
        const evolutionSessions = await sessionRepository.findByCompany(companyId, 'evolution');
        const sessions = [...allSessions, ...evolutionSessions];

        const results = await Promise.all(sessions.map(async (s) => {
          let runtimeStatus: string | null = null;
          let hasAuth = false;
          let effectiveStatus = s.status || 'disconnected';

          try {
            const stateData = await evolutionApiService.getConnectionState(s.id);
            const state = stateData?.instance?.state;
            
            if (state === 'open') {
              runtimeStatus = 'connected';
              effectiveStatus = 'connected';
              hasAuth = true;
            } else if (state === 'connecting') {
              runtimeStatus = 'connecting';
              effectiveStatus = 'connecting';
            } else if (state === 'close') {
              runtimeStatus = 'disconnected';
              effectiveStatus = 'disconnected';
            } else {
               runtimeStatus = 'qr';
               effectiveStatus = 'disconnected';
            }
          } catch (e) {
             console.warn(`[SessionService] Failed to get state for ${s.id}`, e);
             runtimeStatus = 'none';
             effectiveStatus = 'disconnected';
          }

          return {
            ...s,
            runtimeStatus: (runtimeStatus || 'none') as SessionWithRuntime['runtimeStatus'],
            hasAuth,
            effectiveStatus,
          };
        }));

        return results;
      }
    );

    return sessionsWithRuntime;
  }

  /**
   * Busca uma sessão específica com dados de runtime
   */
  async getSession(sessionId: string, companyId: string): Promise<SessionWithRuntime | null> {
    const session = await sessionRepository.findById(sessionId, companyId);

    if (!session) {
      return null;
    }

    let runtimeStatus: string | null = null;
    let hasAuth = false;
    let effectiveStatus = session.status || 'disconnected';

    try {
        const stateData = await evolutionApiService.getConnectionState(sessionId);
        const state = stateData?.instance?.state;
        
        if (state === 'open') {
          runtimeStatus = 'connected';
          effectiveStatus = 'connected';
          hasAuth = true;
        } else if (state === 'connecting') {
          runtimeStatus = 'connecting';
          effectiveStatus = 'connecting';
        } else if (state === 'close') {
          runtimeStatus = 'disconnected';
          effectiveStatus = 'disconnected';
        } else {
           runtimeStatus = 'qr';
           effectiveStatus = 'disconnected';
        }
    } catch(e) {
        runtimeStatus = 'none';
    }

    return {
      ...session,
      runtimeStatus: (runtimeStatus || 'none') as SessionWithRuntime['runtimeStatus'],
      hasAuth,
      effectiveStatus,
    };
  }

  /**
   * Cria uma nova sessão
   */
  async createSession(companyId: string, name: string): Promise<CreateSessionResult> {
    try {
      const session = await sessionCreationBreaker.execute(async () => {
        // Criar no banco local (marca como evolution)
        const newSession = await sessionRepository.create({
          companyId,
          name,
          connectionType: 'evolution',
        });

        // Apaga do evolution se ja existisse lixo
        await evolutionApiService.deleteInstance(newSession.id).catch(() => {});

        // Criar na Evolution API
        await evolutionApiService.createInstance(newSession.id);

        // Configurar webhook
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
        const webhookUrl = `${appUrl}/api/v1/webhooks/evolution`;
        await evolutionApiService.setWebhook(newSession.id, webhookUrl);

        await SessionCache.invalidateOnChange(companyId, newSession.id);

        return newSession;
      });

      return {
        success: true,
        session,
      };
    } catch (error) {
      console.error('[SessionService] Error creating session:', error);

      if (error instanceof Error && error.message.includes('Circuit breaker is OPEN')) {
        return {
          success: false,
          error: 'Service temporarily unavailable. Please try again in a moment.',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
      };
    }
  }

  /**
   * Deleta uma sessão
   */
  async deleteSession(sessionId: string, companyId: string): Promise<DeleteSessionResult> {
    const exists = await sessionRepository.exists(sessionId, companyId);
    if (!exists) {
      return {
        success: false,
        message: 'Session not found',
      };
    }

    try {
      // Deletar sessão da Evolution API (Ignora falhas para permitir deletar conexões fantasmas do banco)
      await evolutionApiService.deleteInstance(sessionId).catch(error => {
          console.warn('[SessionService] Could not delete from Evolution API, proceeding with local deletion:', error);
      });

      // Limpar referências em campanhas
      await db.update(campaigns)
        .set({ connectionId: null })
        .where(and(
          eq(campaigns.connectionId, sessionId),
          eq(campaigns.companyId, companyId)
        ));

      await sessionRepository.delete(sessionId, companyId);
      await SessionCache.invalidateOnChange(companyId, sessionId);

      return {
        success: true,
        message: 'Session deleted successfully',
      };
    } catch (error) {
      console.error('[SessionService] Error deleting session:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete session',
      };
    }
  }

  /**
   * Reconecta uma sessão (força novo QR Code)
   */
  async reconnectSession(sessionId: string, companyId: string): Promise<CreateSessionResult> {
    const session = await sessionRepository.findById(sessionId, companyId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
      };
    }

    try {
      // Força logout na Evolution para desconectar o socket e pedir novo QR
      await evolutionApiService.logoutInstance(sessionId);

      await SessionCache.invalidateOnChange(companyId, sessionId);

      return {
        success: true,
        session,
      };
    } catch (error) {
      console.error('[SessionService] Error reconnecting session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reconnect session',
      };
    }
  }

  /**
   * Resume uma sessão
   */
  async resumeSession(sessionId: string, companyId: string): Promise<CreateSessionResult> {
    const session = await sessionRepository.findById(sessionId, companyId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
      };
    }

    // A Evolution API reconecta automaticamente, não há o que fazer além de resetar o cache/status
    try {
      await SessionCache.invalidateOnChange(companyId, sessionId);
      return {
        success: true,
        session,
      };
    } catch (error) {
      console.error('[SessionService] Error resuming session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume session',
      };
    }
  }

  /**
   * Desconecta uma sessão
   */
  async disconnectSession(sessionId: string, companyId: string): Promise<CreateSessionResult> {
    const session = await sessionRepository.findById(sessionId, companyId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
      };
    }

    try {
      await evolutionApiService.logoutInstance(sessionId);
      await SessionCache.invalidateOnChange(companyId, sessionId);

      return {
        success: true,
        session,
      };
    } catch (error) {
      console.error('[SessionService] Error disconnecting session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect session',
      };
    }
  }

  private async updateSessionStatus(
    sessionId: string,
    companyId: string,
    status: string,
    isActive: boolean
  ): Promise<void> {
    await sessionRepository.update(sessionId, companyId, {
      status,
      isActive,
    });

    await SessionCache.invalidateOnChange(companyId, sessionId);
  }
}

// Singleton instance
export const sessionService = new SessionService();
