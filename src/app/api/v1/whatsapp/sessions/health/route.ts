/**
 * ✅ FASE 3.3: Health Check para Sessões WhatsApp
 * Endpoint de monitoramento e diagnóstico
 */

import { NextResponse } from 'next/server';
import { baileysBridge as sessionManager } from '@/lib/baileys-bridge-client';
import { getMediaUploadQueueStats } from '@/services/media-upload-queue.service';
import { sessionCreationBreaker, mediaUploadBreaker, databaseBreaker } from '@/utils/circuit-breaker';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const companyId = await getCompanyIdFromSession();
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      companyId,
      checks: {},
    };

    // ✅ FASE 3.3: Verificar saúde do banco de dados
    try {
      const startTime = Date.now();
      await db.select({ id: connections.id })
        .from(connections)
        .where(eq(connections.companyId, companyId))
        .limit(1);
      const dbLatency = Date.now() - startTime;

      health.checks.database = {
        status: 'healthy',
        latency: `${dbLatency}ms`,
      };
    } catch (error) {
      health.checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      health.status = 'degraded';
    }

    // ✅ FASE 3.3: Verificar Circuit Breakers
    health.checks.circuitBreakers = {
      sessionCreation: {
        state: sessionCreationBreaker.getState(),
        stats: sessionCreationBreaker.getStats(),
      },
      mediaUpload: {
        state: mediaUploadBreaker.getState(),
        stats: mediaUploadBreaker.getStats(),
      },
      database: {
        state: databaseBreaker.getState(),
        stats: databaseBreaker.getStats(),
      },
    };

    // Verificar se algum circuit breaker está aberto
    const openBreakers = Object.values(health.checks.circuitBreakers).filter(
      (cb: any) => cb.state === 'OPEN'
    );
    if (openBreakers.length > 0) {
      health.status = 'degraded';
    }

    // ✅ FASE 3.3: Verificar Queue de Upload de Mídia
    const queueStats = await getMediaUploadQueueStats();
    if (queueStats) {
      health.checks.mediaUploadQueue = {
        status: queueStats.active > 10 ? 'busy' : 'healthy',
        ...queueStats,
      };

      if (queueStats.failed > 100) {
        health.status = 'degraded';
      }
    } else {
      health.checks.mediaUploadQueue = {
        status: 'unavailable',
        message: 'Queue not initialized',
      };
    }

    // ✅ FASE 3.3: Verificar Sessões Ativas
    const activeSessions = sessionManager.getActiveSessionsCount?.() || 0;
    health.checks.sessions = {
      status: activeSessions > 0 ? 'healthy' : 'no_sessions',
      activeCount: activeSessions,
    };

    // Determinar status final
    const hasUnhealthy = Object.values(health.checks).some(
      (check: any) => check.status === 'unhealthy'
    );
    if (hasUnhealthy) {
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'unhealthy' ? 503 : health.status === 'degraded' ? 200 : 200;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
