/**
 * Cache para Sessões WhatsApp (Baileys)
 * Reduz queries ao banco de dados em até 80%
 * TTL: 30 segundos (dados mudam frequentemente)
 */

import { redis } from '@/lib/redis';
import { CacheMetrics } from './metrics';

export interface CachedSession {
  id: string;
  name: string;
  status: string;
  phone?: string | null;
  lastConnected?: Date | null;
  isActive: boolean;
  createdAt?: Date | null;
  hasAuth?: boolean;
  runtimeStatus?: string;
}

/**
 * Cache para sessões WhatsApp
 */
export class SessionCache {
  private static readonly SESSIONS_PREFIX = 'whatsapp:sessions';
  private static readonly SESSION_PREFIX = 'whatsapp:session';
  private static readonly TTL = 30; // 30 segundos - dados mudam frequentemente

  /**
   * Busca todas as sessões de uma empresa do cache
   */
  static async getSessions(companyId: string): Promise<CachedSession[] | null> {
    try {
      if (!redis) return null;
      const cacheKey = `${this.SESSIONS_PREFIX}:${companyId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        await CacheMetrics.recordHit('sessions');
        return JSON.parse(cached) as CachedSession[];
      }
      
      await CacheMetrics.recordMiss('sessions');
      return null;
    } catch (error) {
      console.error('[SessionCache] Erro ao buscar sessões do cache:', error);
      return null;
    }
  }

  /**
   * Busca sessões do banco e armazena no cache
   */
  static async getSessionsWithCache<T extends CachedSession>(
    companyId: string,
    fetcher: () => Promise<T[]>
  ): Promise<T[]> {
    try {
      // Tentar buscar do cache primeiro
      const cached = await this.getSessions(companyId);
      if (cached) {
        return cached as T[];
      }

      // Se não estiver no cache, buscar do banco
      const sessions = await fetcher();

      // Armazenar no cache
      await this.setSessions(companyId, sessions);

      return sessions;
    } catch (error) {
      console.error('[SessionCache] Erro ao buscar sessões com cache:', error);
      // Em caso de erro, tentar buscar diretamente do banco
      return await fetcher();
    }
  }

  /**
   * Armazena sessões no cache
   */
  static async setSessions<T extends CachedSession>(companyId: string, sessions: T[]): Promise<void> {
    try {
      if (!redis) return;
      const cacheKey = `${this.SESSIONS_PREFIX}:${companyId}`;
      await redis.setex(cacheKey, this.TTL, JSON.stringify(sessions));
      await CacheMetrics.recordSet('sessions');
    } catch (error) {
      console.error('[SessionCache] Erro ao armazenar sessões no cache:', error);
    }
  }

  /**
   * Busca uma sessão específica do cache
   */
  static async getSession(companyId: string, sessionId: string): Promise<CachedSession | null> {
    try {
      if (!redis) return null;
      const cacheKey = `${this.SESSION_PREFIX}:${companyId}:${sessionId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        await CacheMetrics.recordHit('sessions');
        return JSON.parse(cached) as CachedSession;
      }
      
      await CacheMetrics.recordMiss('sessions');
      return null;
    } catch (error) {
      console.error('[SessionCache] Erro ao buscar sessão do cache:', error);
      return null;
    }
  }

  /**
   * Armazena uma sessão específica no cache
   */
  static async setSession(companyId: string, session: CachedSession): Promise<void> {
    try {
      if (!redis) return;
      const cacheKey = `${this.SESSION_PREFIX}:${companyId}:${session.id}`;
      await redis.setex(cacheKey, this.TTL, JSON.stringify(session));
      await CacheMetrics.recordSet('sessions');
    } catch (error) {
      console.error('[SessionCache] Erro ao armazenar sessão no cache:', error);
    }
  }

  /**
   * Atualiza uma sessão no cache (atualiza tanto na lista quanto individualmente)
   */
  static async updateSession(companyId: string, session: CachedSession): Promise<void> {
    try {
      // Atualizar sessão individual
      await this.setSession(companyId, session);

      // Atualizar na lista de sessões
      const sessions = await this.getSessions(companyId);
      if (sessions) {
        const updated = sessions.map((s) =>
          s.id === session.id ? session : s
        );
        await this.setSessions(companyId, updated);
      }
    } catch (error) {
      console.error('[SessionCache] Erro ao atualizar sessão no cache:', error);
    }
  }

  /**
   * Adiciona uma nova sessão ao cache
   */
  static async addSession(companyId: string, session: CachedSession): Promise<void> {
    try {
      // Adicionar sessão individual
      await this.setSession(companyId, session);

      // Adicionar na lista de sessões
      const sessions = await this.getSessions(companyId);
      if (sessions) {
        sessions.push(session);
        await this.setSessions(companyId, sessions);
      }
    } catch (error) {
      console.error('[SessionCache] Erro ao adicionar sessão no cache:', error);
    }
  }

  /**
   * Remove uma sessão do cache
   */
  static async removeSession(companyId: string, sessionId: string): Promise<void> {
    try {
      if (!redis) return;
      // Remover sessão individual
      const sessionKey = `${this.SESSION_PREFIX}:${companyId}:${sessionId}`;
      await redis.del(sessionKey);

      // Remover da lista de sessões
      const sessions = await this.getSessions(companyId);
      if (sessions) {
        const filtered = sessions.filter((s) => s.id !== sessionId);
        await this.setSessions(companyId, filtered);
      }
    } catch (error) {
      console.error('[SessionCache] Erro ao remover sessão do cache:', error);
    }
  }

  /**
   * Invalida todo o cache de sessões de uma empresa
   */
  static async invalidate(companyId: string): Promise<void> {
    try {
      if (!redis) return;
      const sessionsKey = `${this.SESSIONS_PREFIX}:${companyId}`;
      await redis.del(sessionsKey);

      // Também invalidar sessões individuais (usando padrão)
      const _pattern = `${this.SESSION_PREFIX}:${companyId}:*`;
      // Nota: Redis não suporta DEL com padrão diretamente, precisaríamos usar SCAN
      // Por enquanto, apenas invalidamos a lista - sessões individuais expirarão naturalmente
      
      await CacheMetrics.recordDelete('sessions');
    } catch (error) {
      console.error('[SessionCache] Erro ao invalidar cache:', error);
    }
  }

  /**
   * Invalida cache quando sessão é criada/atualizada/deletada
   * Chamado automaticamente pelos eventos WebSocket
   */
  static async invalidateOnChange(companyId: string, sessionId?: string): Promise<void> {
    try {
      if (!redis) return;
      // Invalidar lista completa
      await this.invalidate(companyId);

      // Se sessionId fornecido, também invalidar sessão individual
      if (sessionId) {
        const sessionKey = `${this.SESSION_PREFIX}:${companyId}:${sessionId}`;
        await redis.del(sessionKey);
      }
    } catch (error) {
      console.error('[SessionCache] Erro ao invalidar cache em mudança:', error);
    }
  }
}
