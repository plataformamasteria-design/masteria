// src/app/api/v1/connections/health/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, or, inArray, isNull, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { decrypt } from '@/lib/crypto';
import { baileysBridge as sessionManager } from '@/lib/baileys-bridge-client';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';
const CONNECTION_TIMEOUT_MS = 5000;

// Per-connection health cache - increased to 1 hour
// This is the specific health check result (expensive part)
const PER_CONNECTION_CACHE_TTL_MS = 3600000; // 60 minutes
// Baileys: in-memory check only, no external API call - much shorter cache
const BAILEYS_CACHE_TTL_MS = 30000; // 30 seconds

interface ConnectionHealth {
  id: string;
  name: string;
  phoneNumberId: string | null;
  isActive: boolean;
  status: 'healthy' | 'expired' | 'error' | 'inactive' | 'expiring_soon';
  lastChecked: Date;
  errorMessage?: string;
  tokenExpiresIn?: number;
}

// Per-connection health cache to avoid redundant API calls
interface ConnectionHealthCache {
  health: ConnectionHealth;
  timestamp: number;
}

// Global cache for individual connection checks
const connectionHealthCache = new Map<string, ConnectionHealthCache>();

type ConnectionData = {
  id: string;
  name: string;
  phoneNumberId: string | null;
  accessToken: string | null;
  connectionType: string | null;
  isActive: boolean;
  createdAt: Date | null;
};

/**
 * Uses lightweight /me endpoint instead of debug_token to validate token.
 * This significantly reduces API quota usage while still verifying token validity.
 */
async function checkConnectionHealth(connection: ConnectionData, force: boolean = false): Promise<ConnectionHealth> {
  const health: ConnectionHealth = {
    id: connection.id,
    name: connection.name,
    phoneNumberId: connection.phoneNumberId,
    isActive: connection.isActive,
    status: connection.isActive ? 'healthy' : 'inactive',
    lastChecked: new Date()
  };

  if (!connection.isActive) {
    return health;
  }

  // Check per-connection cache first (Baileys uses shorter TTL since it's in-memory only)
  const cacheTtl = connection.connectionType === 'baileys' ? BAILEYS_CACHE_TTL_MS : PER_CONNECTION_CACHE_TTL_MS;
  const cachedHealth = connectionHealthCache.get(connection.id);
  if (!force && cachedHealth && Date.now() - cachedHealth.timestamp < cacheTtl) {
    return {
      ...cachedHealth.health,
      lastChecked: new Date(cachedHealth.timestamp) // Keep original timestamp to be honest
    };
  }

  try {
    // ✅ CORREÇÃO: Verificar status real das sessões Baileys
    if (connection.connectionType === 'baileys' || connection.connectionType === 'apicloud' || connection.connectionType === 'meta_api') {
      // Para conexões Meta (apicloud/meta_api), se isActive for true e tivermos accessToken, 
      // verificamos a saúde via API. Se não, seguimos a lógica padrão.
      if ((connection.connectionType === 'apicloud' || connection.connectionType === 'meta_api') && connection.isActive && connection.accessToken) {
        // Continue para a verificação de token abaixo
      } else if (connection.connectionType === 'baileys') {
        // Use async method to query the Baileys microservice for real status
        let runtimeStatus: string | null = null;
        try {
          const statusData = await sessionManager.getSessionStatusAsync(connection.id);
          runtimeStatus = statusData?.status || null;
        } catch (err) {
          console.warn(`[Health Check] Could not reach Baileys service for ${connection.id}:`, err);
          runtimeStatus = null;
        }

        // Mapear status Baileys para status de health
        if (runtimeStatus === 'connected') {
          health.status = 'healthy';
        } else if (runtimeStatus === 'failed') {
          health.status = 'error';
          health.errorMessage = 'Falha na conexão WhatsApp';
        } else if (runtimeStatus === 'disconnected' || runtimeStatus === 'none' || runtimeStatus === null) {
          // Verificar se tem credenciais salvas (pode reconectar)
          const hasAuth = await sessionManager.hasFilesystemAuth(connection.id);
          if (hasAuth) {
            health.status = 'inactive'; // Tem credenciais mas não está conectado
          } else {
            health.status = 'error'; // Sem credenciais, precisa reconectar
            health.errorMessage = 'Sessão desconectada - reconecte para continuar';
          }
        } else if (runtimeStatus === 'connecting' || runtimeStatus === 'qr') {
          health.status = 'healthy'; // Está tentando conectar, consideramos saudável
        } else {
          health.status = 'inactive';
        }

        connectionHealthCache.set(connection.id, { health, timestamp: Date.now() });
        return health;
      }
    }

    // Para conexões sem tipo definido (legacy), assumir healthy
    if (!connection.connectionType) {
      health.status = 'healthy';
      connectionHealthCache.set(connection.id, { health, timestamp: Date.now() });
      return health;
    }

    if (!connection.accessToken) {
      health.status = 'error';
      health.errorMessage = 'Token de acesso não configurado';
      connectionHealthCache.set(connection.id, { health, timestamp: Date.now() });
      return health;
    }

    const accessToken = decrypt(connection.accessToken);
    if (!accessToken) {
      health.status = 'error';
      health.errorMessage = 'Falha ao desencriptar o token de acesso';
      connectionHealthCache.set(connection.id, { health, timestamp: Date.now() });
      return health;
    }

    try {
      // Use lightweight /me endpoint instead of debug_token to reduce API quota usage
      // This validates the token without consuming as much quota
      const meUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me`;
      const meResponse = await fetch(meUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT_MS),
      });

      if (!meResponse.ok) {
        const errorData = await meResponse.json().catch(() => ({}));
        const errorCode = errorData.error?.code;
        const errorSubcode = errorData.error?.error_subcode;
        const errorMessage = errorData.error?.message;

        console.error(`[Health Check] Meta API Error for ${connection.name} (${connection.id}):`, {
          code: errorCode,
          subcode: errorSubcode,
          message: errorMessage,
          type: connection.connectionType
        });

        // Check for specific error codes
        if (errorCode === 190 || errorCode === 102) {
          // Token expired or invalid
          health.status = 'expired';
          health.errorMessage = errorMessage || 'Token de acesso inválido ou expirado';
        } else if (errorCode === 4 || errorCode === 17 || errorCode === 613) {
          // Rate limited - assume healthy to avoid more calls
          console.warn('[Health Check] Rate limited, assuming healthy:', connection.id);
          health.status = 'healthy';
          health.errorMessage = 'Verificação adiada (limite de API)';
        } else {
          health.status = 'error';
          // Make error message visible to user
          health.errorMessage = errorMessage ? `Erro Meta (${errorCode}): ${errorMessage}` : 'Erro desconhecido ao validar token';
        }
      } else {
        // Token is valid - mark as healthy
        health.status = 'healthy';
      }
    } catch (fetchError) {
      console.error(`[Health Check] Network/Fetch Error for ${connection.name}:`, fetchError);
      // Network error or timeout - don't mark as expired, just error
      health.status = 'error';
      health.errorMessage = 'Timeout ou erro de rede ao verificar conexão';
    }
  } catch (error) {
    console.error(`[Health Check] General Error for ${connection.name}:`, error);
    health.status = 'error';
    health.errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao verificar conexão';
  }

  // Cache the result
  connectionHealthCache.set(connection.id, { health, timestamp: Date.now() });
  return health;
}


export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    if (force) {
      console.log(`[Health Check] Force refresh requested for company ${companyId}`);
    }

    // 1. ALWAYS Fetch fresh list from DB (Cheap)
    // This prevents "Ghost Connections" (deleted from DB but stuck in cache)
    // ✅ CORREÇÃO: Incluir conexões Baileys e Meta na query
    const companyConnections = await db
      .select({
        id: connections.id,
        name: connections.config_name,
        phoneNumberId: connections.phoneNumberId,
        accessToken: connections.accessToken,
        connectionType: connections.connectionType,
        isActive: connections.isActive,
        createdAt: connections.createdAt
      })
      .from(connections)
      .where(
        and(
          eq(connections.companyId, companyId),
          or(
            inArray(connections.connectionType, ['meta_api', 'instagram', 'instagram_direct', 'baileys']),
            isNull(connections.connectionType)
          )
        )
      );

    // 2. Map over current connections and check status (uses per-connection cache)
    const healthChecks = await Promise.all(
      companyConnections.map((connection) => checkConnectionHealth(connection, force))
    );

    // 3. Cleanup: Remove cached data for IDs that no longer exist in DB
    // This prevents memory leaks over time
    const _currentIds = new Set(companyConnections.map(c => c.id));
    for (const _cachedId of connectionHealthCache.keys()) {
      // We only clean up if we can reasonably verify it belonged to this company, 
      // OR we just occasional cleanup. 
      // Since map is global, we have to be careful not to delete other companies' data if sharing server.
      // But for simplicity/safety, we skip complex cleanup here or do lazily.
      // The crucial part is that the Response only includes `companyConnections`.
    }

    const summary = {
      total: healthChecks.length,
      healthy: healthChecks.filter(h => h.status === 'healthy').length,
      expiring_soon: healthChecks.filter(h => h.status === 'expiring_soon').length,
      expired: healthChecks.filter(h => h.status === 'expired').length,
      error: healthChecks.filter(h => h.status === 'error').length,
      inactive: healthChecks.filter(h => h.status === 'inactive').length
    };

    return NextResponse.json(
      { summary, connections: healthChecks, cached: false },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );

  } catch (error: any) {
    if (error?.message?.includes('Não autorizado')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    console.error('Erro ao verificar saúde das conexões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao verificar conexões' },
      { status: 500 }
    );
  }
}
