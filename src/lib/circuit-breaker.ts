// src/lib/circuit-breaker.ts

export type Provider = 'openai' | 'google' | 'meta' | 'sms_witi' | 'sms_seven' | 'sms_mkom' | 'hume';

type State = {
  openUntil?: number; // epoch ms
  failureCount?: number; // Contador de falhas consecutivas
};

const state: Record<Provider, State> = {
  openai: {},
  google: {},
  meta: {},
  sms_witi: {},
  sms_seven: {},
  sms_mkom: {},
  hume: {},
};

// Janela padrão de meia-vida do breaker (pode ajustar via env)
const DEFAULT_COOLDOWN_MS = Number(process.env.AI_BREAKER_COOLDOWN_MS ?? 30_000);

export function isOpen(provider: Provider): boolean {
  const now = Date.now();
  const providerState = state[provider];
  if (!providerState) {
    console.warn(`[Circuit Breaker] Provider '${provider}' não encontrado no estado.`);
    return false;
  }
  const openUntil = providerState.openUntil ?? 0;
  return openUntil > now;
}

export function trip(provider: Provider, cooldownMs: number = DEFAULT_COOLDOWN_MS): void {
  const providerState = state[provider];
  if (!providerState) {
    console.warn(`[Circuit Breaker] Provider '${provider}' não encontrado no estado. Inicializando...`);
    state[provider] = {};
  }
  state[provider].openUntil = Date.now() + cooldownMs;
}

export function reset(provider: Provider): void {
  const providerState = state[provider];
  if (!providerState) {
    console.warn(`[Circuit Breaker] Provider '${provider}' não encontrado no estado. Inicializando...`);
    state[provider] = {};
  }
  state[provider].openUntil = 0;
  state[provider].failureCount = 0;
}

/**
 * Incrementa contador de falhas e abre o circuit se atingir threshold
 * @param provider - Provider externo
 * @param threshold - Número de falhas consecutivas para abrir (padrão: 5)
 * @param cooldownMs - Tempo de cooldown em ms (padrão: 60s)
 * @returns true se o circuit foi aberto agora
 */
export function recordFailure(
  provider: Provider,
  threshold: number = 5,
  cooldownMs: number = DEFAULT_COOLDOWN_MS
): boolean {
  const providerState = state[provider];
  if (!providerState) {
    console.warn(`[Circuit Breaker] Provider '${provider}' não encontrado no estado. Inicializando...`);
    state[provider] = { failureCount: 0 };
  }

  const currentCount = (state[provider].failureCount || 0) + 1;
  state[provider].failureCount = currentCount;

  console.log(`[Circuit Breaker] ${provider} falhou ${currentCount}/${threshold} vezes consecutivas`);

  if (currentCount >= threshold) {
    trip(provider, cooldownMs);
    console.warn(`[Circuit Breaker] ${provider} ABERTO após ${threshold} falhas consecutivas. Cooldown: ${cooldownMs}ms`);
    return true;
  }

  return false;
}

/**
 * Registra sucesso e reseta contador de falhas (circuit fecha automaticamente)
 */
export function recordSuccess(provider: Provider): void {
  const providerState = state[provider];
  if (!providerState) {
    state[provider] = { failureCount: 0 };
  } else {
    state[provider].failureCount = 0;
  }
}

/**
 * Retorna estatísticas do circuit breaker
 */
export function getStats(provider: Provider): { isOpen: boolean; failureCount: number; openUntil: number | null } {
  const providerState = state[provider];
  if (!providerState) {
    return { isOpen: false, failureCount: 0, openUntil: null };
  }

  return {
    isOpen: isOpen(provider),
    failureCount: providerState.failureCount || 0,
    openUntil: providerState.openUntil || null,
  };
}
