/**
 * Tenant Guard - Helper Centralizado para Validação Multi-Tenant
 * 
 * Este módulo fornece funções utilitárias para garantir que todas as operações
 * de banco de dados sejam isoladas por tenant (companyId), prevenindo vazamentos
 * de dados entre empresas.
 * 
 * @module tenant-guard
 */

import { db } from './index';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq, and, SQL, inArray } from 'drizzle-orm';

/**
 * Erro customizado para recursos não encontrados ou sem acesso
 */
export class TenantAccessError extends Error {
  constructor(
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly companyId: string
  ) {
    super(
      `Acesso negado: ${resourceType} com ID '${resourceId}' não pertence à empresa '${companyId}' ou não existe.`
    );
    this.name = 'TenantAccessError';
  }
}

/**
 * Erro para quando o companyId não pode ser obtido da sessão
 */
export class SessionError extends Error {
  constructor(message: string = 'Não autorizado: ID da empresa não pôde ser obtido da sessão.') {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * Obtém o companyId da sessão ou lança erro
 * 
 * @returns ID da empresa
 * @throws SessionError se não conseguir obter da sessão
 */
export async function requireCompanyId(): Promise<string> {
  try {
    return await getCompanyIdFromSession();
  } catch (error) {
    throw new SessionError(
      error instanceof Error ? error.message : 'Não autorizado: ID da empresa não pôde ser obtido da sessão.'
    );
  }
}

/**
 * Valida se um recurso pertence à empresa do usuário logado
 * 
 * Esta função deve ser usada ANTES de qualquer operação (read/update/delete)
 * em um recurso para garantir isolamento multi-tenant.
 * 
 * @param resourceId - ID do recurso a validar
 * @param table - Tabela do Drizzle ORM (ex: connections, contacts, campaigns)
 * @param companyId - ID da empresa (opcional, será obtido da sessão se não fornecido)
 * @returns O recurso encontrado ou lança TenantAccessError
 * 
 * @example
 * ```typescript
 * // Antes de atualizar uma conexão
 * const connection = await ensureTenantAccess(
 *   connectionId,
 *   connections
 * );
 * 
 * // Com companyId explícito (útil em webhooks)
 * const connection = await ensureTenantAccess(
 *   connectionId,
 *   connections,
 *   companyId
 * );
 * ```
 */
export async function ensureTenantAccess<T extends { id: string; companyId: string }>(
  resourceId: string,
  table: { id: any; companyId: any },
  companyId?: string
): Promise<T> {
  const tenantId = companyId || await requireCompanyId();
  
  const [resource] = await db
    .select()
    .from(table as any)
    .where(
      and(
        eq(table.id, resourceId),
        eq(table.companyId, tenantId)
      )
    )
    .limit(1);

  if (!resource) {
    const tableName = (table as any)._?.name || 'Resource';
    throw new TenantAccessError(tableName, resourceId, tenantId);
  }

  return resource as T;
}

/**
 * Valida se múltiplos recursos pertencem à empresa do usuário logado
 * 
 * @param resourceIds - Array de IDs dos recursos
 * @param table - Tabela do Drizzle ORM
 * @param companyId - ID da empresa (opcional)
 * @returns Array de recursos encontrados
 */
export async function ensureTenantAccessMultiple<T extends { id: string; companyId: string }>(
  resourceIds: string[],
  table: { id: any; companyId: any },
  companyId?: string
): Promise<T[]> {
  if (resourceIds.length === 0) return [];

  const tenantId = companyId || await requireCompanyId();
  
  const resources = await db
    .select()
    .from(table as any)
    .where(
      and(
        inArray(table.id, resourceIds),
        eq(table.companyId, tenantId)
      )
    );

  // Valida que todos os IDs foram encontrados
  const foundIds = new Set(resources.map((r: any) => r.id));
  const missingIds = resourceIds.filter(id => !foundIds.has(id));
  
  if (missingIds.length > 0) {
    const tableName = (table as any)._?.name || 'Resources';
    throw new TenantAccessError(
      tableName,
      missingIds.join(', '),
      tenantId
    );
  }

  return resources as T[];
}

/**
 * Cria uma condição WHERE scoped por tenant para usar em queries
 * 
 * @param table - Tabela do Drizzle ORM
 * @param companyId - ID da empresa (opcional)
 * @param additionalConditions - Condições adicionais a combinar
 * @returns Condição SQL combinada
 * 
 * @example
 * ```typescript
 * const companyId = await requireCompanyId();
 * const whereClause = await scopedWhere(contacts, companyId, [
 *   eq(contacts.status, 'ACTIVE')
 * ]);
 * 
 * const results = await db.select()
 *   .from(contacts)
 *   .where(whereClause);
 * ```
 */
export async function scopedWhere(
  table: { companyId: any },
  companyId?: string,
  additionalConditions: SQL[] = []
): Promise<SQL> {
  const tenantId = companyId || await requireCompanyId();
  
  const conditions: SQL[] = [
    eq(table.companyId, tenantId),
    ...additionalConditions
  ];

  return and(...conditions)!;
}

/**
 * Helper para validar que um recurso existe e pertence ao tenant antes de update
 * 
 * @param resourceId - ID do recurso
 * @param table - Tabela do Drizzle ORM
 * @param companyId - ID da empresa (opcional)
 * @returns O recurso validado
 */
export async function validateBeforeUpdate<T extends { id: string; companyId: string }>(
  resourceId: string,
  table: { id: any; companyId: any },
  companyId?: string
): Promise<T> {
  return await ensureTenantAccess(resourceId, table, companyId);
}

/**
 * Helper para validar que um recurso existe e pertence ao tenant antes de delete
 * 
 * @param resourceId - ID do recurso
 * @param table - Tabela do Drizzle ORM
 * @param companyId - ID da empresa (opcional)
 * @returns O recurso validado
 */
export async function validateBeforeDelete<T extends { id: string; companyId: string }>(
  resourceId: string,
  table: { id: any; companyId: any },
  companyId?: string
): Promise<T> {
  return await ensureTenantAccess(resourceId, table, companyId);
}

/**
 * Valida que um recurso relacionado (via FK) pertence ao mesmo tenant
 * 
 * Útil para validar recursos relacionados antes de criar associações.
 * 
 * @param resourceId - ID do recurso relacionado
 * @param table - Tabela do recurso relacionado
 * @param expectedCompanyId - ID da empresa esperado
 * @returns O recurso relacionado validado
 */
export async function ensureRelatedResourceAccess<T extends { id: string; companyId: string }>(
  resourceId: string,
  table: { id: any; companyId: any },
  expectedCompanyId: string
): Promise<T> {
  const [resource] = await db
    .select()
    .from(table as any)
    .where(
      and(
        eq(table.id, resourceId),
        eq(table.companyId, expectedCompanyId)
      )
    )
    .limit(1);

  if (!resource) {
    const tableName = (table as any)._?.name || 'RelatedResource';
    throw new TenantAccessError(tableName, resourceId, expectedCompanyId);
  }

  return resource as T;
}
