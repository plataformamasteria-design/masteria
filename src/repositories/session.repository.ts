/**
 * ✅ FASE 2.1: Repository Pattern para Sessões WhatsApp
 * Centraliza acesso a dados e facilita testes e migração de banco
 */

import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface SessionData {
  id: string;
  name: string;
  status: string;
  phone?: string | null;
  lastConnected?: Date | null;
  isActive: boolean;
  createdAt?: Date | null;
  hasAuthInDB?: boolean;
}

export interface CreateSessionData {
  companyId: string;
  name: string;
  connectionType: 'baileys' | 'meta_api' | 'evolution';
  // ✅ SIMPLIFICAÇÃO: environment é opcional e não mais usado para sessões Baileys
  // Mantido para compatibilidade com Meta API se necessário
  environment?: 'production' | 'development';
}

export interface UpdateSessionData {
  status?: string;
  phone?: string | null;
  lastConnected?: Date | null;
  isActive?: boolean;
  qrCode?: string | null;
}

/**
 * Repository para operações de sessões WhatsApp
 */
export class SessionRepository {
  /**
   * Busca todas as sessões de uma empresa
   */
  async findByCompany(
    companyId: string,
    connectionType: 'baileys' | 'meta_api' | 'evolution' = 'baileys'
  ): Promise<SessionData[]> {
    const sessions = await db
      .select({
        id: connections.id,
        name: connections.config_name,
        status: connections.status,
        phone: connections.phone,
        lastConnected: connections.lastConnected,
        isActive: connections.isActive,
        createdAt: connections.createdAt,
        // Legacy auth checks removed
        hasAuthInDB: sql<boolean>`false`,
      })
      .from(connections)
      .where(and(
        eq(connections.companyId, companyId),
        eq(connections.connectionType, connectionType)
      ));

    return sessions.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status || 'disconnected',
      phone: s.phone,
      lastConnected: s.lastConnected,
      isActive: s.isActive,
      createdAt: s.createdAt,
      hasAuthInDB: s.hasAuthInDB,
    }));
  }

  /**
   * Busca uma sessão específica por ID
   */
  async findById(sessionId: string, companyId: string): Promise<SessionData | null> {
    const [session] = await db
      .select({
        id: connections.id,
        name: connections.config_name,
        status: connections.status,
        phone: connections.phone,
        lastConnected: connections.lastConnected,
        isActive: connections.isActive,
        createdAt: connections.createdAt,
        hasAuthInDB: sql<boolean>`false`,
      })
      .from(connections)
      .where(and(
        eq(connections.id, sessionId),
        eq(connections.companyId, companyId)
      ))
      .limit(1);

    if (!session) return null;

    return {
      id: session.id,
      name: session.name,
      status: session.status || 'disconnected',
      phone: session.phone,
      lastConnected: session.lastConnected,
      isActive: session.isActive,
      createdAt: session.createdAt,
      hasAuthInDB: session.hasAuthInDB,
    };
  }

  /**
   * Cria uma nova sessão
   * ✅ SIMPLIFICAÇÃO: environment não é mais usado para sessões Baileys
   */
  async create(data: CreateSessionData): Promise<SessionData> {
    const [session] = await db
      .insert(connections)
      .values({
        companyId: data.companyId,
        config_name: data.name,
        connectionType: data.connectionType,
        status: 'connecting',
        isActive: true,
        // ✅ SIMPLIFICAÇÃO: Usar 'production' como padrão (campo mantido para compatibilidade DB)
        // Mas não é mais usado para filtrar sessões Baileys
        environment: data.environment || 'production',
      })
      .returning({
        id: connections.id,
        name: connections.config_name,
        status: connections.status,
        phone: connections.phone,
        lastConnected: connections.lastConnected,
        isActive: connections.isActive,
        createdAt: connections.createdAt,
      });

    if (!session) {
      throw new Error('Failed to create session');
    }

    return {
      id: session.id,
      name: session.name,
      status: session.status || 'disconnected',
      phone: session.phone,
      lastConnected: session.lastConnected,
      isActive: session.isActive,
      createdAt: session.createdAt,
      hasAuthInDB: false,
    };
  }

  /**
   * Atualiza uma sessão
   */
  async update(
    sessionId: string,
    companyId: string,
    data: UpdateSessionData
  ): Promise<SessionData | null> {
    const [updated] = await db
      .update(connections)
      .set({
        ...(data.status !== undefined && { status: data.status }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.lastConnected !== undefined && { lastConnected: data.lastConnected }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.qrCode !== undefined && { qrCode: data.qrCode }),
      })
      .where(and(
        eq(connections.id, sessionId),
        eq(connections.companyId, companyId)
      ))
      .returning({
        id: connections.id,
        name: connections.config_name,
        status: connections.status,
        phone: connections.phone,
        lastConnected: connections.lastConnected,
        isActive: connections.isActive,
        createdAt: connections.createdAt,
      });

    if (!updated) {
      return null;
    }

    return {
      id: updated.id,
      name: updated.name,
      status: updated.status || 'disconnected',
      phone: updated.phone,
      lastConnected: updated.lastConnected,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      hasAuthInDB: false, // Será verificado se necessário
    };
  }

  /**
   * Deleta uma sessão
   */
  async delete(sessionId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(connections)
      .where(and(
        eq(connections.id, sessionId),
        eq(connections.companyId, companyId)
      ));

    return result.length > 0;
  }

  /**
   * Verifica se uma sessão existe e pertence à empresa
   */
  async exists(sessionId: string, companyId: string): Promise<boolean> {
    const [session] = await db
      .select({ id: connections.id })
      .from(connections)
      .where(and(
        eq(connections.id, sessionId),
        eq(connections.companyId, companyId)
      ))
      .limit(1);

    return !!session;
  }
}

// Singleton instance
export const sessionRepository = new SessionRepository();
