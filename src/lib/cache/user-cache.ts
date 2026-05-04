// src/lib/cache/user-cache.ts
import redis from '@/lib/redis';
import { db } from '@/lib/db';
import { companies, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { CacheMetrics } from './metrics';

interface CachedCompany {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface CachedUser {
  id: string;
  email: string;
  name: string;
  companyId: string | null;
  role: string;
  createdAt: string;
}

/**
 * Cache para dados de empresa e usuário
 * TTL: 30 minutos para dados de empresa/usuário
 */
export class UserCache {
  private static readonly COMPANY_PREFIX = 'company';
  private static readonly USER_PREFIX = 'user';
  private static readonly TTL = 1800; // 30 minutos

  /**
   * Busca empresa do cache
   */
  static async getCompany(companyId: string): Promise<CachedCompany | null> {
    try {
      const cacheKey = `${this.COMPANY_PREFIX}:${companyId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        await CacheMetrics.recordHit('users');
        return JSON.parse(cached) as CachedCompany;
      }
      
      await CacheMetrics.recordMiss('users');
      return null;
    } catch (error) {
      console.error('[UserCache] Erro ao buscar empresa do cache:', error);
      return null;
    }
  }

  /**
   * Busca empresa do banco e armazena no cache
   */
  static async getCompanyWithCache(companyId: string): Promise<CachedCompany | null> {
    // Tenta buscar do cache primeiro
    const cached = await this.getCompany(companyId);
    if (cached) {
      return cached;
    }

    // Se não encontrou no cache, busca do banco
    const companyFromDb = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    });

    if (!companyFromDb) {
      return null;
    }

    const company: CachedCompany = {
      id: companyFromDb.id,
      name: companyFromDb.name,
      createdAt: companyFromDb.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: companyFromDb.updatedAt?.toISOString() || new Date().toISOString(),
    };

    // Armazena no cache
    await this.setCompany(companyId, company);
    
    return company;
  }

  /**
   * Armazena empresa no cache
   */
  static async setCompany(companyId: string, company: CachedCompany): Promise<void> {
    try {
      const cacheKey = `${this.COMPANY_PREFIX}:${companyId}`;
      await redis.set(cacheKey, JSON.stringify(company), 'EX', this.TTL);
    } catch (error) {
      console.error('[UserCache] Erro ao armazenar empresa no cache:', error);
    }
  }

  /**
   * Busca usuário do cache
   */
  static async getUser(userId: string): Promise<CachedUser | null> {
    try {
      const cacheKey = `${this.USER_PREFIX}:${userId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        await CacheMetrics.recordHit('users');
        return JSON.parse(cached) as CachedUser;
      }
      
      await CacheMetrics.recordMiss('users');
      return null;
    } catch (error) {
      console.error('[UserCache] Erro ao buscar usuário do cache:', error);
      return null;
    }
  }

  /**
   * Busca usuário do banco e armazena no cache
   */
  static async getUserWithCache(userId: string): Promise<CachedUser | null> {
    // Tenta buscar do cache primeiro
    const cached = await this.getUser(userId);
    if (cached) {
      return cached;
    }

    // Se não encontrou no cache, busca do banco
    const userFromDb = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userFromDb) {
      return null;
    }

    const user: CachedUser = {
      id: userFromDb.id,
      email: userFromDb.email,
      name: userFromDb.name || '',
      companyId: userFromDb.companyId,
      role: userFromDb.role,
      createdAt: userFromDb.createdAt?.toISOString() || new Date().toISOString(),
    };

    // Armazena no cache
    await this.setUser(userId, user);
    
    return user;
  }

  /**
   * Armazena usuário no cache
   */
  static async setUser(userId: string, user: CachedUser): Promise<void> {
    try {
      const cacheKey = `${this.USER_PREFIX}:${userId}`;
      await redis.set(cacheKey, JSON.stringify(user), 'EX', this.TTL);
    } catch (error) {
      console.error('[UserCache] Erro ao armazenar usuário no cache:', error);
    }
  }

  /**
   * Invalida cache de empresa
   */
  static async invalidateCompany(companyId: string): Promise<void> {
    try {
      const cacheKey = `${this.COMPANY_PREFIX}:${companyId}`;
      await redis.del(cacheKey);
    } catch (error) {
      console.error('[UserCache] Erro ao invalidar cache de empresa:', error);
    }
  }

  /**
   * Invalida cache de usuário
   */
  static async invalidateUser(userId: string): Promise<void> {
    try {
      const cacheKey = `${this.USER_PREFIX}:${userId}`;
      await redis.del(cacheKey);
    } catch (error) {
      console.error('[UserCache] Erro ao invalidar cache de usuário:', error);
    }
  }

  /**
   * Limpa todo o cache de usuários e empresas
   */
  static async clearAll(): Promise<void> {
    try {
      const companyKeys = await redis.keys(`${this.COMPANY_PREFIX}:*`);
      const userKeys = await redis.keys(`${this.USER_PREFIX}:*`);
      const allKeys = [...companyKeys, ...userKeys];
      
      if (allKeys.length > 0) {
        // HybridRedisClient doesn't support spread - call individually
        for (const key of allKeys) {
          try {
            await redis.del(key);
          } catch (e) {
            // Continue on delete errors
          }
        }
      }
    } catch (error) {
      console.error('[UserCache] Erro ao limpar cache:', error);
    }
  }
}