// src/app/api/v1/cache/metrics/route.ts
import { NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { CacheMetrics } from '@/lib/cache/metrics';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store',
};

/**
 * GET /api/v1/cache/metrics
 * Retorna métricas de performance do cache Redis
 */
export async function GET() {
  try {
    // Verifica se o usuário está autenticado
    const session = await getUserSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Acesso negado. Usuário não autenticado.' },
        { status: 401, headers: responseHeaders }
      );
    }

    // Busca todas as métricas de cache
    const [cacheStats, redisMemory, redisStats] = await Promise.all([
      CacheMetrics.getAllMetrics(),
      CacheMetrics.getRedisMemoryInfo(),
      CacheMetrics.getRedisStats(),
    ]);

    const response = {
      cache: cacheStats,
      redis: {
        memory: redisMemory,
        stats: redisStats,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { headers: responseHeaders });
  } catch (error) {
    console.error('[Cache Metrics API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500, headers: responseHeaders }
    );
  }
}

/**
 * DELETE /api/v1/cache/metrics
 * Reseta todas as métricas de cache
 */
export async function DELETE() {
  try {
    // Verifica se o usuário está autenticado
    const session = await getUserSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Acesso negado. Usuário não autenticado.' },
        { status: 401, headers: responseHeaders }
      );
    }

    // Reseta todas as métricas
    await CacheMetrics.resetAllMetrics();

    return NextResponse.json(
      { message: 'Métricas resetadas com sucesso' },
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error('[Cache Metrics API] Erro ao resetar métricas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500, headers: responseHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: { ...responseHeaders, Allow: 'GET, DELETE, OPTIONS' } });
}