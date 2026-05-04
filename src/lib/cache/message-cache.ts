// src/lib/cache/message-cache.ts
import redis from '@/lib/redis';
import { db } from '@/lib/db';
import { aiChatMessages } from '@/lib/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { CacheMetrics } from './metrics';

interface CachedMessage {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
}

interface MessageCacheOptions {
  chatId: string;
  limit?: number;
  fromDate?: string;
}

/**
 * Cache de histórico de mensagens de chat
 * TTL: 5 minutos para histórico recente
 */
export class MessageCache {
  private static readonly CACHE_PREFIX = 'chat_history';
  private static readonly TTL = 300; // 5 minutos

  /**
   * Gera chave de cache baseada nos parâmetros
   */
  private static getCacheKey(options: MessageCacheOptions): string {
    const { chatId, limit = 100, fromDate } = options;
    const dateKey = fromDate ? `:${fromDate}` : '';
    return `${this.CACHE_PREFIX}:${chatId}:${limit}${dateKey}`;
  }

  /**
   * Busca mensagens do cache
   */
  static async getMessages(options: MessageCacheOptions): Promise<CachedMessage[] | null> {
    try {
      const cacheKey = this.getCacheKey(options);
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        await CacheMetrics.recordHit('messages');
        return JSON.parse(cached) as CachedMessage[];
      }
      
      await CacheMetrics.recordMiss('messages');
      return null;
    } catch (error) {
      console.error('[MessageCache] Erro ao buscar do cache:', error);
      return null;
    }
  }

  /**
   * Busca mensagens do banco e armazena no cache
   */
  static async getMessagesWithCache(options: MessageCacheOptions): Promise<CachedMessage[]> {
    // Tenta buscar do cache primeiro
    const cached = await this.getMessages(options);
    if (cached) {
      return cached;
    }

    // Se não encontrou no cache, busca do banco
    const { chatId, limit = 100, fromDate } = options;
    
    const whereClauses = [eq(aiChatMessages.chatId, chatId)];
    if (fromDate) {
      whereClauses.push(gte(aiChatMessages.createdAt, new Date(fromDate)));
    }

    const messagesFromDb = await db.query.aiChatMessages.findMany({
      where: and(...whereClauses),
      orderBy: [desc(aiChatMessages.createdAt)],
      limit,
    });

    const messages: CachedMessage[] = messagesFromDb.reverse().map(m => ({
      id: m.id,
      sender: m.role,
      content: m.content,
      createdAt: m.createdAt?.toISOString() || new Date().toISOString(),
    }));

    // Armazena no cache
    await this.setMessages(options, messages);
    
    return messages;
  }

  /**
   * Armazena mensagens no cache
   */
  static async setMessages(options: MessageCacheOptions, messages: CachedMessage[]): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(options);
      await redis.set(cacheKey, JSON.stringify(messages), 'EX', this.TTL);
    } catch (error) {
      console.error('[MessageCache] Erro ao armazenar no cache:', error);
    }
  }

  /**
   * Invalida cache de um chat específico
   */
  static async invalidateChat(chatId: string): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}:${chatId}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        // HybridRedisClient doesn't support spread - call individually
        for (const key of keys) {
          try {
            await redis.del(key);
          } catch (e) {
            // Continue on delete errors
          }
        }
      }
    } catch (error) {
      console.error('[MessageCache] Erro ao invalidar cache:', error);
    }
  }

  /**
   * Limpa todo o cache de mensagens
   */
  static async clearAll(): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        // HybridRedisClient doesn't support spread - call individually
        for (const key of keys) {
          try {
            await redis.del(key);
          } catch (e) {
            // Continue on delete errors
          }
        }
      }
    } catch (error) {
      console.error('[MessageCache] Erro ao limpar cache:', error);
    }
  }
}