/**
 * Cache em memória para Meta Ads API — MasterIA (multi-tenant).
 * Server-side only — nunca importar no cliente.
 *
 * TTLs por tipo de dado:
 *  - spend/métricas em tempo real: 5 minutos
 *  - estrutura de campanhas/conjuntos/anúncios: 30 minutos
 *  - metadados de anúncios (ads_metadata): 2 horas
 */

// ============================================
// TTL constants (milissegundos)
// ============================================
export const TTL_REALTIME = 5 * 60 * 1000;       // 5 min — spend, métricas
export const TTL_STRUCTURE = 30 * 60 * 1000;     // 30 min — campanhas, conjuntos, anúncios
export const TTL_METADATA = 2 * 60 * 60 * 1000;  // 2h — ads_metadata

// ============================================
// Cache em memória
// ============================================
interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry>();

function getCacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  return `meta:${endpoint}:${sorted.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

function getFromMemory<T>(key: string): { data: T; expired: boolean } | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  const expired = Date.now() - entry.cachedAt > entry.ttl;
  return { data: entry.data as T, expired };
}

export function clearMemoryCacheKey(cacheKeyPrefix: string): void {
  for (const k of memoryCache.keys()) {
    if (k.startsWith(cacheKeyPrefix)) {
      memoryCache.delete(k);
    }
  }
}

function setInMemory<T>(key: string, data: T, ttl: number): void {
  memoryCache.set(key, { data, cachedAt: Date.now(), ttl });
  // Limpar cache se ficar muito grande (max 500 entries)
  if (memoryCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of memoryCache) {
      if (now - v.cachedAt > v.ttl) memoryCache.delete(k);
    }
  }
}

// ============================================
// Função principal de cache
// ============================================
export interface CachedResult<T = unknown> {
  data: T;
  from_cache: boolean;
  rate_limited?: boolean;
}

/**
 * Busca dados da Meta API com cache em memória.
 * Se a API retornar 429 (rate limit), retorna último valor do cache.
 */
export async function getCachedMetaData<T = unknown>(
  endpoint: string,
  params: Record<string, string>,
  ttl: number,
  fetchFn: () => Promise<T>,
): Promise<CachedResult<T>> {
  const key = getCacheKey(endpoint, params);

  // 1. Verificar cache em memória
  const cached = getFromMemory<T>(key);
  if (cached && !cached.expired) {
    return { data: cached.data, from_cache: true };
  }

  // 2. Cache expirado ou inexistente — buscar da API
  try {
    const data = await fetchFn();

    // 3. Salvar em cache
    setInMemory(key, data, ttl);

    return { data, from_cache: false };
  } catch (error: unknown) {
    // 4. Se rate limited (429), retornar cache stale se disponível
    const isRateLimited =
      error instanceof Error && error.message.includes("429");

    if (isRateLimited && cached) {
      return { data: cached.data, from_cache: true, rate_limited: true };
    }

    // Se não tem cache stale, propagar o erro
    throw error;
  }
}

/**
 * Determinar TTL baseado no tipo de endpoint/dados.
 */
export function getTTLForEndpoint(endpoint: string): number {
  if (endpoint === "ads" || endpoint === "campaigns" || endpoint === "adsets") {
    return TTL_STRUCTURE;
  }
  if (endpoint.includes("metadata") || endpoint.includes("creative")) {
    return TTL_METADATA;
  }
  return TTL_REALTIME;
}

/**
 * Limpar todo o cache em memória (útil para forçar refresh).
 */
export function clearMetaCache(): void {
  memoryCache.clear();
}

/**
 * Estatísticas do cache para debug/monitoring.
 */
export function getMetaCacheStats(): { size: number; keys: string[] } {
  return {
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
  };
}
