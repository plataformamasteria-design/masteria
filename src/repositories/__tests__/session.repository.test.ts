/**
 * ✅ FASE 4.1: Testes Unitários - Session Repository
 * 
 * Nota: Estes são testes básicos de estrutura.
 * Testes completos requerem mock do banco de dados.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionRepository } from '../session.repository';

// Mock do módulo de banco de dados
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      connections: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/db/schema', () => ({
  connections: {
    id: 'id',
    config_name: 'config_name',
    status: 'status',
    phone: 'phone',
    lastConnected: 'lastConnected',
    isActive: 'isActive',
    createdAt: 'createdAt',
  },
  baileysAuthState: {
    connectionId: 'connectionId',
  },
}));

describe('SessionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have findByCompany method', () => {
    expect(sessionRepository.findByCompany).toBeDefined();
    expect(typeof sessionRepository.findByCompany).toBe('function');
  });

  it('should have findById method', () => {
    expect(sessionRepository.findById).toBeDefined();
    expect(typeof sessionRepository.findById).toBe('function');
  });

  it('should have create method', () => {
    expect(sessionRepository.create).toBeDefined();
    expect(typeof sessionRepository.create).toBe('function');
  });

  it('should have update method', () => {
    expect(sessionRepository.update).toBeDefined();
    expect(typeof sessionRepository.update).toBe('function');
  });

  it('should have delete method', () => {
    expect(sessionRepository.delete).toBeDefined();
    expect(typeof sessionRepository.delete).toBe('function');
  });

  it('should have exists method', () => {
    expect(sessionRepository.exists).toBeDefined();
    expect(typeof sessionRepository.exists).toBe('function');
  });
});
