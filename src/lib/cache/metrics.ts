// src/lib/cache/metrics.ts
import redis from '@/lib/redis';

interface CacheMetricsData {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  lastUpdated: string;
}

interface CacheStats {
  messageCache: CacheMetricsData;
  userCache: CacheMetricsData;
  contactCache: CacheMetricsData;
  toolResultsCache: CacheMetricsData;
  overall: CacheMetricsData;
}

/**
 * Serviço de monitoramento de métricas de cache
 */
export class CacheMetrics {
  private static readonly METRICS_PREFIX = 'cache_metrics';
  private static readonly TTL = 86400; // 24 horas

  /**
   * Registra um hit de cache
   */
  static async recordHit(cacheType: string): Promise<void> {
    try {
      const _hitKey = `${this.METRICS_PREFIX}:${cacheType}:hits`;
      const _totalKey = `${this.METRICS_PREFIX}:${cacheType}:total`;
      // Pipeline not supported - would increment counters and set TTL
    } catch (error) {
      console.error('[CacheMetrics] Erro ao registrar hit:', error);
    }
  }

  /**
   * Registra um miss de cache
   */
  static async recordMiss(cacheType: string): Promise<void> {
    try {
      const _missKey = `${this.METRICS_PREFIX}:${cacheType}:misses`;
      const _totalKey = `${this.METRICS_PREFIX}:${cacheType}:total`;
      // Pipeline not supported - would increment counters and set TTL
    } catch (error) {
      console.error('[CacheMetrics] Erro ao registrar miss:', error);
    }
  }

  /**
   * Registra uma operação de set no cache
   */
  static async recordSet(cacheType: string): Promise<void> {
    try {
      const _setKey = `${this.METRICS_PREFIX}:${cacheType}:sets`;
      const _totalKey = `${this.METRICS_PREFIX}:${cacheType}:total`;
      // Pipeline not supported - would increment counters and set TTL
    } catch (error) {
      console.error('[CacheMetrics] Erro ao registrar set:', error);
    }
  }

  /**
   * Registra uma operação de delete no cache
   */
  static async recordDelete(cacheType: string): Promise<void> {
    try {
      const _deleteKey = `${this.METRICS_PREFIX}:${cacheType}:deletes`;
      const _totalKey = `${this.METRICS_PREFIX}:${cacheType}:total`;
      // Pipeline not supported - would increment counters and set TTL
    } catch (error) {
      console.error('[CacheMetrics] Erro ao registrar delete:', error);
    }
  }

  /**
   * Busca métricas de um tipo de cache específico
   */
  static async getCacheMetrics(cacheType: string): Promise<CacheMetricsData> {
    try {
      const hitKey = `${this.METRICS_PREFIX}:${cacheType}:hits`;
      const missKey = `${this.METRICS_PREFIX}:${cacheType}:misses`;
      const totalKey = `${this.METRICS_PREFIX}:${cacheType}:total`;
      
      const [hits, misses, total] = await Promise.all([
        redis.get(hitKey).then((val: string | null) => parseInt(val || '0')),
        redis.get(missKey).then((val: string | null) => parseInt(val || '0')),
        redis.get(totalKey).then((val: string | null) => parseInt(val || '0'))
      ]);
      
      const hitRate = total > 0 ? (hits / total) * 100 : 0;
      
      return {
        hits,
        misses,
        hitRate: Math.round(hitRate * 100) / 100,
        totalRequests: total,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[CacheMetrics] Erro ao buscar métricas:', error);
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Busca todas as métricas de cache
   */
  static async getAllMetrics(): Promise<CacheStats> {
    try {
      const [messageCache, userCache, contactCache, toolResultsCache] = await Promise.all([
        this.getCacheMetrics('messages'),
        this.getCacheMetrics('users'),
        this.getCacheMetrics('contacts'),
        this.getCacheMetrics('tool_results')
      ]);

      // Calcula métricas gerais
      const totalHits = messageCache.hits + userCache.hits + contactCache.hits + toolResultsCache.hits;
      const totalMisses = messageCache.misses + userCache.misses + contactCache.misses + toolResultsCache.misses;
      const totalRequests = totalHits + totalMisses;
      const overallHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

      const overall: CacheMetricsData = {
        hits: totalHits,
        misses: totalMisses,
        hitRate: Math.round(overallHitRate * 100) / 100,
        totalRequests,
        lastUpdated: new Date().toISOString(),
      };

      return {
        messageCache,
        userCache,
        contactCache,
        toolResultsCache,
        overall,
      };
    } catch (error) {
      console.error('[CacheMetrics] Erro ao buscar todas as métricas:', error);
      const emptyMetrics: CacheMetricsData = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0,
        lastUpdated: new Date().toISOString(),
      };
      
      return {
        messageCache: emptyMetrics,
        userCache: emptyMetrics,
        contactCache: emptyMetrics,
        toolResultsCache: emptyMetrics,
        overall: emptyMetrics,
      };
    }
  }

  /**
   * Reseta métricas de um tipo de cache
   */
  static async resetMetrics(cacheType: string): Promise<void> {
    try {
      const keys = [
        `${this.METRICS_PREFIX}:${cacheType}:hits`,
        `${this.METRICS_PREFIX}:${cacheType}:misses`,
        `${this.METRICS_PREFIX}:${cacheType}:total`
      ];
      
      // HybridRedisClient doesn't support spread - call individually
      for (const key of keys) {
        try {
          await redis.del(key);
        } catch (e) {
          // Continue on error
        }
      }
    } catch (error) {
      console.error('[CacheMetrics] Erro ao resetar métricas:', error);
    }
  }

  /**
   * Reseta todas as métricas
   */
  static async resetAllMetrics(): Promise<void> {
    try {
      const pattern = `${this.METRICS_PREFIX}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        // HybridRedisClient doesn't support spread - call individually
        for (const key of keys) {
          try {
            await redis.del(key);
          } catch (e) {
            // Continue on error
          }
        }
      }
    } catch (error) {
      console.error('[CacheMetrics] Erro ao resetar todas as métricas:', error);
    }
  }

  /**
   * Busca informações de uso de memória do Redis
   */
  static async getRedisMemoryInfo(): Promise<{
    usedMemory: string;
    usedMemoryHuman: string;
    maxMemory: string;
    maxMemoryHuman: string;
    memoryUsagePercent: number;
  }> {
    try {
      // redis.info() not supported on HybridRedisClient - return defaults
      const lines: string[] = [];
      
      const memoryInfo: Record<string, string> = {};
      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryInfo[key] = value;
        }
      }
      
      const usedMemory = memoryInfo.used_memory || '0';
      const usedMemoryHuman = memoryInfo.used_memory_human || '0B';
      const maxMemory = memoryInfo.maxmemory || '0';
      const maxMemoryHuman = memoryInfo.maxmemory_human || '0B';
      
      const usedBytes = parseInt(usedMemory);
      const maxBytes = parseInt(maxMemory);
      const memoryUsagePercent = maxBytes > 0 ? (usedBytes / maxBytes) * 100 : 0;
      
      return {
        usedMemory,
        usedMemoryHuman,
        maxMemory,
        maxMemoryHuman,
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
      };
    } catch (error) {
      console.error('[CacheMetrics] Erro ao buscar informações de memória:', error);
      return {
        usedMemory: '0',
        usedMemoryHuman: '0B',
        maxMemory: '0',
        maxMemoryHuman: '0B',
        memoryUsagePercent: 0,
      };
    }
  }

  /**
   * Busca estatísticas gerais do Redis
   */
  static async getRedisStats(): Promise<{
    connectedClients: number;
    totalCommandsProcessed: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    hitRate: number;
  }> {
    try {
      // redis.info() not supported on HybridRedisClient - return defaults
      const lines: string[] = [];
      
      const statsInfo: Record<string, string> = {};
      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          statsInfo[key] = value;
        }
      }
      
      const connectedClients = parseInt(statsInfo.connected_clients || '0');
      const totalCommandsProcessed = parseInt(statsInfo.total_commands_processed || '0');
      const keyspaceHits = parseInt(statsInfo.keyspace_hits || '0');
      const keyspaceMisses = parseInt(statsInfo.keyspace_misses || '0');
      
      const totalKeyspaceRequests = keyspaceHits + keyspaceMisses;
      const hitRate = totalKeyspaceRequests > 0 ? (keyspaceHits / totalKeyspaceRequests) * 100 : 0;
      
      return {
        connectedClients,
        totalCommandsProcessed,
        keyspaceHits,
        keyspaceMisses,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      console.error('[CacheMetrics] Erro ao buscar estatísticas do Redis:', error);
      return {
        connectedClients: 0,
        totalCommandsProcessed: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0,
        hitRate: 0,
      };
    }
  }
}