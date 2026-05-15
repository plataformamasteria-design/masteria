/**
 * Helper para chamadas paginadas à Meta Marketing API.
 * Server-side only — nunca importar no cliente.
 *
 * Usa getCachedMetaData para cache em memória com TTL por tipo de dado.
 * Registra chamadas em sistema_rate_limit_log automaticamente.
 */

import { getCachedMetaData, getTTLForEndpoint } from "@/lib/meta-cache";

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const ACCOUNT = () => process.env.META_ADS_ACCOUNT_ID || "";
const BASE = "https://graph.facebook.com/v21.0";

interface MetaFetchOptions {
  endpoint: string; // ex: "insights", "ads"
  fields: string;
  account?: string;
  params?: Record<string, string>;
  datePreset?: string;
  since?: string;
  until?: string;
  /** Filtrar por status: "ACTIVE", "PAUSED", ou undefined para todos */
  statusFilter?: string;
  /** Forçar bypass do cache */
  skipCache?: boolean;
}

interface MetaResponse<T> {
  data: T[];
  error?: string;
  from_cache?: boolean;
  rate_limited?: boolean;
}

/**
 * Verifica se o erro da Meta API é de rate limit ou excesso de dados.
 */
function isMetaRateLimitError(errText: string): boolean {
  try {
    const parsed = JSON.parse(errText);
    const code = parsed?.error?.code;
    const msg = parsed?.error?.message || "";
    return code === 80000 || msg.toLowerCase().includes("reduce the amount");
  } catch {
    return errText.toLowerCase().includes("reduce the amount");
  }
}

/**
 * Fetch com retry e backoff exponencial para erros de rate limit.
 * Tenta até 3 vezes com delays de 1s, 2s, 4s.
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;

    const errText = await res.text();
    if (isMetaRateLimitError(errText) && attempt < maxRetries - 1) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`[meta-fetch] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    // Se não é rate limit ou esgotou retries, lança o erro
    let errMsg = `Meta API retornou ${res.status}`;
    try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
    throw new Error(errMsg);
  }
  throw new Error("Meta API: máximo de retries atingido");
}

async function rawMetaFetch<T>(options: MetaFetchOptions): Promise<T[]> {
  const token = TOKEN();
  const account = options.account || ACCOUNT();

  const queryParams = new URLSearchParams({
    access_token: token,
    fields: options.fields,
    limit: "25",
    ...options.params,
  });

  if (options.since && options.until) {
    queryParams.set("time_range", JSON.stringify({ since: options.since, until: options.until }));
  } else if (options.datePreset) {
    queryParams.set("date_preset", options.datePreset);
  }

  if (options.statusFilter && options.statusFilter !== "ALL") {
    queryParams.set("filtering", JSON.stringify([{ field: "ad.effective_status", operator: "IN", value: [options.statusFilter] }]));
  }

  const url = `${BASE}/${account}/${options.endpoint}?${queryParams.toString()}`;
  const allData: T[] = [];

  const firstRes = await fetchWithRetry(url);
  const firstBody = await firstRes.json();
  allData.push(...((firstBody.data || []) as T[]));

  let nextUrl: string | undefined = firstBody.paging?.next;
  while (nextUrl) {
    try {
      const pageRes = await fetchWithRetry(nextUrl);
      const pageBody = await pageRes.json();
      allData.push(...((pageBody.data || []) as T[]));
      nextUrl = pageBody.paging?.next;
    } catch (err) {
      console.warn("[meta-fetch] Pagination stopped due to error:", err instanceof Error ? err.message : err);
      break;
    }
  }

  return allData;
}

/**
 * Busca dados paginados da Meta Marketing API com cache.
 * Itera por todas as páginas até não haver "next" no cursor.
 * Retorna { data, error, from_cache, rate_limited }.
 */
export async function metaFetchPaginated<T = Record<string, unknown>>(options: MetaFetchOptions): Promise<MetaResponse<T>> {
  const token = TOKEN();
  const account = options.account || ACCOUNT();

  if (!token || !account) {
    return { data: [], error: "META_ADS_ACCESS_TOKEN ou META_ADS_ACCOUNT_ID não configurados" };
  }

  // Construir params de cache key
  const cacheParams: Record<string, string> = {
    account_id: account,
    fields: options.fields,
    ...(options.params || {}),
    ...(options.since ? { since: options.since } : {}),
    ...(options.until ? { until: options.until } : {}),
    ...(options.datePreset ? { datePreset: options.datePreset } : {}),
    ...(options.statusFilter ? { statusFilter: options.statusFilter } : {}),
  };

  const ttl = getTTLForEndpoint(options.endpoint);

  if (options.skipCache) {
    try {
      const data = await rawMetaFetch<T>(options);
      return { data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[meta-fetch] Erro em ${options.endpoint}: ${msg}`);
      return { data: [], error: msg };
    }
  }

  try {
    const result = await getCachedMetaData<T[]>(
      options.endpoint,
      cacheParams,
      ttl,
      () => rawMetaFetch<T>(options),
    );
    return {
      data: result.data,
      from_cache: result.from_cache,
      rate_limited: result.rate_limited,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[meta-fetch] Exceção em ${options.endpoint}: ${msg}`);
    return { data: [], error: msg };
  }
}
