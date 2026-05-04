// src/lib/api-cache.ts
// Sistema de cache em memória simples para API routes
// Reduz drasticamente a carga no banco de dados para dados frequentemente acessados

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;

  constructor(maxSize = 500) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  invalidatePattern(pattern: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

export const apiCache = new SimpleCache(500);

const pendingFetches: Map<string, Promise<any>> = new Map();

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 30000 // 30 segundos padrão
): Promise<T> {
  const startTime = Date.now();
  const cached = apiCache.get<T>(key);
  
  if (cached !== null) {
    const fetchTime = Date.now() - startTime;
    console.log(`📊 [API CACHE HIT] Key: ${key} - Fetch time: ${fetchTime}ms`);
    return cached;
  }

  const existingFetch = pendingFetches.get(key);
  if (existingFetch) {
    console.log(`📊 [API CACHE COALESCE] Key: ${key} - Waiting for existing fetch...`);
    return existingFetch as Promise<T>;
  }

  console.log(`📊 [API CACHE MISS] Key: ${key} - Fetching from source...`);
  
  const fetchPromise = (async () => {
    try {
      const data = await fetcher();
      apiCache.set(key, data, ttl);
      
      const totalTime = Date.now() - startTime;
      console.log(`📊 [API CACHE SET] Key: ${key} - TTL: ${ttl}ms - Total time: ${totalTime}ms`);
      
      return data;
    } finally {
      pendingFetches.delete(key);
    }
  })();

  pendingFetches.set(key, fetchPromise);
  
  return fetchPromise;
}

// TTLs recomendados por tipo de dados (Estratégia Tiered Cache Expansion)
export const CacheTTL = {
  STATUS_POLLING: 2500,    // 2.5s - otimizado para polling de 5s (garante cache hit)
  REAL_TIME: 5000,         // 5s - dados em tempo real (conversas ativas)
  SHORT: 30000,            // 30s - dados frequentes (lista de conversas, leads kanban)
  MEDIUM: 60000,           // 1min - dados semi-estáticos (contatos, campanhas)
  LONG: 300000,            // 5min - dados estáticos (configurações, stats)
  VERY_LONG: 900000,       // 15min - dados raramente alterados (listas, tags)
  
  // Analytics Tier (Current vs Historical Data)
  ANALYTICS_CURRENT: 60000,          // 1min - analytics de dados atuais/hoje
  ANALYTICS_TIMESERIES_CURRENT: 120000,   // 2min - séries temporais atuais
  ANALYTICS_HISTORICAL: 600000,      // 10min - analytics de dados históricos
  ANALYTICS_TIMESERIES_HISTORICAL: 900000, // 15min - séries temporais históricas
  
  // Configuration Tier (Semi-Static Data)
  CONFIG_SEMI_STATIC: 300000,        // 5min - listas, conexões, cadências
  CONFIG_STATIC: 900000,             // 15min - templates, personas (raramente mudam)
} as const;
