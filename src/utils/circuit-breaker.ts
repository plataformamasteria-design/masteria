/**
 * ✅ FASE 3.2: Circuit Breaker para Operações Críticas
 * Previne falhas em cascata quando serviço está sobrecarregado
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number; // Número de falhas antes de abrir
  resetTimeout: number; // Tempo em ms antes de tentar novamente (half-open)
  successThreshold: number; // Número de sucessos para fechar novamente
  timeout: number; // Timeout para operações em ms
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minuto
  successThreshold: 2,
  timeout: 30000, // 30 segundos
};

/**
 * Circuit Breaker para operações críticas
 */
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private state: CircuitState = 'CLOSED';
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Executa uma operação com circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Verificar se deve tentar novamente (half-open)
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
        console.log('[CircuitBreaker] State changed to HALF_OPEN - attempting recovery');
      } else {
        throw new Error('Circuit breaker is OPEN - operation blocked');
      }
    }

    try {
      // Executar operação com timeout
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), this.options.timeout)
        ),
      ]);

      // Sucesso
      this.onSuccess();
      return result;
    } catch (error) {
      // Falha
      this.onFailure();
      throw error;
    }
  }

  /**
   * Registra sucesso
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        console.log('[CircuitBreaker] State changed to CLOSED - service recovered');
      }
    }
  }

  /**
   * Registra falha
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.state === 'HALF_OPEN') {
      // Falhou durante half-open, voltar para open
      this.state = 'OPEN';
      console.log('[CircuitBreaker] State changed to OPEN - recovery failed');
    } else if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      console.log(`[CircuitBreaker] State changed to OPEN - ${this.failures} failures reached`);
    }
  }

  /**
   * Obtém estado atual
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: Date.now() - this.lastFailureTime,
    };
  }

  /**
   * Reseta o circuit breaker manualmente
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    console.log('[CircuitBreaker] Manually reset');
  }
}

/**
 * Circuit breakers específicos para diferentes operações
 */
export const sessionCreationBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000, // 30 segundos
  successThreshold: 1,
  timeout: 20000, // 20 segundos
});

export const mediaUploadBreaker = new CircuitBreaker({
  failureThreshold: 10,
  resetTimeout: 60000, // 1 minuto
  successThreshold: 3,
  timeout: 30000, // 30 segundos
});

export const databaseBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000, // 30 segundos
  successThreshold: 2,
  timeout: 10000, // 10 segundos
});
