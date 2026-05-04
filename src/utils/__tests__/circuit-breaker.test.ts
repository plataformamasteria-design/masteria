/**
 * ✅ FASE 4.1: Testes Unitários - Circuit Breaker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000, // 1 segundo para testes
      successThreshold: 2,
      timeout: 500,
    });
  });

  it('should start in CLOSED state', () => {
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should execute successful operation', async () => {
    const result = await breaker.execute(async () => {
      return 'success';
    });

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should open after threshold failures', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    // Primeiras 3 falhas devem passar (threshold = 3)
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation);
      } catch (error) {
        // Esperado
      }
    }

    // Após 3 falhas, deve estar OPEN
    expect(breaker.getState()).toBe('OPEN');
  });

  it('should block operations when OPEN', async () => {
    // Forçar estado OPEN
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation);
      } catch (error) {
        // Esperado
      }
    }

    // Tentar executar quando OPEN deve lançar erro
    await expect(breaker.execute(async () => 'should not execute')).rejects.toThrow(
      'Circuit breaker is OPEN'
    );
  });

  it('should transition to HALF_OPEN after resetTimeout', async () => {
    // Forçar estado OPEN
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation);
      } catch (error) {
        // Esperado
      }
    }

    expect(breaker.getState()).toBe('OPEN');

    // Aguardar resetTimeout
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Primeira execução bem-sucedida deve transicionar para HALF_OPEN (mas não fechar ainda)
    await breaker.execute(async () => 'success-on-half-open');
    expect(breaker.getState()).toBe('HALF_OPEN');
  });

  it('should close after successThreshold successes in HALF_OPEN', async () => {
    // Forçar estado OPEN e depois HALF_OPEN
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation);
      } catch (error) {
        // Esperado
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Executar sucessos suficientes (successThreshold = 2)
    await breaker.execute(async () => 'success1');
    await breaker.execute(async () => 'success2');

    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should timeout operations after timeout period', async () => {
    const slowOperation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Mais que timeout de 500ms
      return 'should not return';
    };

    await expect(breaker.execute(slowOperation)).rejects.toThrow('Operation timeout');
  });

  it('should reset manually', async () => {
    // Forçar estado OPEN
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation);
      } catch (error) {
        // Esperado
      }
    }

    breaker.reset();

    expect(breaker.getState()).toBe('CLOSED');
    const stats = breaker.getStats();
    expect(stats.failures).toBe(0);
    expect(stats.successes).toBe(0);
  });
});
