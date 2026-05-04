/**
 * ✅ FASE 2.2: Service Layer para Sessões WhatsApp
 * Centraliza lógica de negócio e casos de uso
 */

import { sessionRepository, SessionData } from '@/repositories/session.repository';
import { baileysBridge as sessionManager } from '@/lib/baileys-bridge-client';
// import { clearAuthState } removed - using bridge client directly
import { SessionCache } from '@/lib/cache/session-cache';
import { db } from '@/lib/db';
import { baileysAuthState, campaigns } from '@/lib/db/schema';
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
 * Service para gerenciar sessões WhatsApp
 */
export class SessionService {
  /**
   * Lista todas as sessões de uma empresa com dados de runtime
   */
  async listSessions(companyId: string): Promise<SessionWithRuntime[]> {
    // ✅ FASE 1.2: Usar cache Redis
    const sessionsWithRuntime = await SessionCache.getSessionsWithCache(
      companyId,
      async () => {
        // ✅ FASE 2.1: Usar Repository Pattern
        const sessions = await sessionRepository.findByCompany(companyId, 'baileys');

        // ✅ FASE 1.3: Batch operations
        const connectionIds = sessions.map(s => s.id);
        const runtimeStatuses = await sessionManager.getBatchSessionStatus(connectionIds);
        const filesystemAuth = await sessionManager.getBatchFilesystemAuth(connectionIds);

        return sessions.map((s) => {
          const runtimeStatus = (runtimeStatuses as any)?.[s.id] || (runtimeStatuses as any)?.get?.(s.id) || null;
          const hasAuth = filesystemAuth.get(s.id) ?? s.hasAuthInDB ?? false;

          let effectiveStatus = runtimeStatus || s.status || 'disconnected';

          if (s.status === 'connected' && !runtimeStatus) {
            if (!hasAuth) {
              effectiveStatus = 'disconnected';
              // Atualizar banco de dados em background
              this.updateSessionStatus(s.id, companyId, 'disconnected', false).catch(
                (err) => console.error(`[SessionService] Error updating session ${s.id} status:`, err)
              );
            } else {
              effectiveStatus = 'connecting';
              // ✅ v2: Auto-resume session in background instead of just marking as 'connecting'
              this.autoResumeSession(s.id, companyId).catch(
                (err) => console.error(`[SessionService] Error auto-resuming session ${s.id}:`, err)
              );
            }
          }

          return {
            ...s,
            runtimeStatus: (runtimeStatus || 'none') as SessionWithRuntime['runtimeStatus'],
            hasAuth,
            effectiveStatus,
          };
        });
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

    const statusData = await sessionManager.getSessionStatusAsync(sessionId);
    const runtimeStatus = statusData?.status || null;
    const hasAuth = await sessionManager.hasFilesystemAuth(sessionId);

    return {
      ...session,
      runtimeStatus: (runtimeStatus || 'none') as SessionWithRuntime['runtimeStatus'],
      hasAuth,
      effectiveStatus: runtimeStatus || session.status || 'disconnected',
    };
  }

  /**
   * Cria uma nova sessão
   */
  async createSession(companyId: string, name: string): Promise<CreateSessionResult> {
    try {
      // ✅ FASE 3.2: Usar Circuit Breaker para prevenir falhas em cascata
      const session = await sessionCreationBreaker.execute(async () => {
        // ✅ SIMPLIFICAÇÃO: Removido campo environment
        // Sessões Baileys agora funcionam independente de NODE_ENV
        // Isso resolve bugs de conflito quando ambiente muda (dev ↔ prod)

        // ✅ FASE 2.1: Usar Repository Pattern
        const newSession = await sessionRepository.create({
          companyId,
          name,
          connectionType: 'baileys',
          // REMOVIDO: environment: currentEnv - sessões são environment-agnostic
        });

        // Limpar estado de auth anterior usando o microservico
        await sessionManager.clearFilesystemAuth(newSession.id);

        // Criar sessão no Baileys
        await sessionManager.createSession(newSession.id, companyId);

        // ✅ FASE 1.2: Invalidar cache
        await SessionCache.invalidateOnChange(companyId, newSession.id);

        return newSession;
      });

      return {
        success: true,
        session,
      };
    } catch (error) {
      console.error('[SessionService] Error creating session:', error);

      // Verificar se foi bloqueado pelo circuit breaker
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
    // ✅ FASE 2.1: Verificar existência usando Repository
    const exists = await sessionRepository.exists(sessionId, companyId);
    if (!exists) {
      return {
        success: false,
        message: 'Session not found',
      };
    }

    try {
      // Deletar sessão do Baileys
      await sessionManager.deleteSession(sessionId);

      // Limpar auth state do banco
      await db.delete(baileysAuthState).where(eq(baileysAuthState.connectionId, sessionId));

      // Limpar referências em campanhas
      await db.update(campaigns)
        .set({ connectionId: null })
        .where(and(
          eq(campaigns.connectionId, sessionId),
          eq(campaigns.companyId, companyId)
        ));

      // ✅ FASE 2.1: Deletar usando Repository
      await sessionRepository.delete(sessionId, companyId);

      // ✅ FASE 1.2: Invalidar cache
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
      // Deletar sessão existente
      await sessionManager.deleteSession(sessionId);

      // Limpar auth do filesystem e do microserviço
      await sessionManager.clearFilesystemAuth(sessionId);

      // Criar nova sessão
      await sessionManager.createSession(sessionId, companyId);

      // ✅ FASE 1.2: Invalidar cache
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
   * Resume uma sessão usando credenciais existentes
   */
  async resumeSession(sessionId: string, companyId: string): Promise<CreateSessionResult> {
    const session = await sessionRepository.findById(sessionId, companyId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
      };
    }

    const hasAuth = await sessionManager.hasFilesystemAuth(sessionId);
    if (!hasAuth) {
      return {
        success: false,
        error: 'No saved credentials. Use reconnect action instead.',
      };
    }

    try {
      // Deletar sessão existente
      await sessionManager.deleteSession(sessionId);

      // Criar sessão com auth existente
      await sessionManager.createSession(sessionId, companyId);

      // ✅ FASE 1.2: Invalidar cache
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
   * Desconecta uma sessão (para o socket mas mantém configurações)
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
      // Deletar sessão da memória (isso desconecta o socket e atualiza status para disconnected)
      // Não deletamos do banco pois é apenas um disconnect
      await sessionManager.deleteSession(sessionId);

      // ✅ FASE 1.2: Invalidar cache
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

  /**
   * Atualiza status de uma sessão
   */
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

    // ✅ FASE 1.2: Invalidar cache
    await SessionCache.invalidateOnChange(companyId, sessionId);
  }
  /**
   * ✅ v2: Auto-resume a disconnected session (non-blocking, silent)
   */
  private async autoResumeSession(sessionId: string, companyId: string): Promise<void> {
    try {
      console.log(`[SessionService] 🔄 Auto-resuming session ${sessionId}...`);
      await sessionManager.ensureSession(sessionId, companyId);
      await SessionCache.invalidateOnChange(companyId, sessionId);
      console.log(`[SessionService] ✅ Session ${sessionId} auto-resume initiated`);
    } catch (err) {
      console.error(`[SessionService] ❌ Failed to auto-resume session ${sessionId}:`, err);
    }
  }
}

// Singleton instance
export const sessionService = new SessionService();
