// src/app/api/v1/agents/health/route.ts
import { NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import AgentPerformanceMetrics from '@/ai/utils/agent-performance-metrics';
// import { cache } from '@/ai/utils/agent-cache'; // Não utilizado
import { getChatPerformanceMetrics } from '@/ai/integration-example';
import redis from '@/lib/redis';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'operational' | 'degraded' | 'down';
      responseTime?: number;
    };
    redis: {
      status: 'operational' | 'degraded' | 'down';
      responseTime?: number;
      memoryUsage?: string;
    };
    agents: {
      status: 'operational' | 'degraded' | 'down';
      successRate: number;
      averageResponseTime: number;
      fallbackUsageRate: number;
    };
    cache: {
      status: 'operational' | 'degraded' | 'down';
      hitRate: number;
      totalHits: number;
      totalMisses: number;
    };
  };
  metrics: {
    realTime: any;
    performance: any;
  };
  alerts: string[];
}

/**
 * GET /api/v1/agents/health
 * Endpoint de health check específico para agentes de IA
 */
export async function GET() {
  try {
    // Verificar autenticação (opcional para health check)
    const session = await getUserSession();
    const _isAuthenticated = !!session?.user?.id;

    const startTime = Date.now();
    const alerts: string[] = [];

    // Testar serviços em paralelo
    const [dbHealth, redisHealth, agentMetrics, cacheMetrics] = await Promise.allSettled([
      testDatabaseHealth(),
      testRedisHealth(),
      AgentPerformanceMetrics.getRealTimeMetrics(),
      getChatPerformanceMetrics()
    ]);

    // Processar resultados dos testes
    const dbResult = dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'down' as const, responseTime: 0 };
    const redisResult = redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'down' as const, responseTime: 0 };
    const agentResult = agentMetrics.status === 'fulfilled' ? agentMetrics.value : null;
    const cacheResult = cacheMetrics.status === 'fulfilled' ? cacheMetrics.value : null;

    // Calcular status dos agentes
    const agentStatus = calculateAgentStatus(agentResult, alerts);
    const cacheStatus = calculateCacheStatus(cacheResult, alerts);

    // Determinar status geral
    const overallStatus = determineOverallStatus([
      dbResult.status,
      redisResult.status,
      agentStatus.status,
      cacheStatus.status
    ]);

    const healthResponse: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbResult,
        redis: redisResult,
        agents: agentStatus,
        cache: cacheStatus
      },
      metrics: {
        realTime: agentResult,
        performance: cacheResult
      },
      alerts
    };

    // Log para monitoramento
    console.log(`[Agents Health Check] Status: ${overallStatus}, Alerts: ${alerts.length}`);

    // Retornar resposta com status HTTP apropriado
    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 206 : 503;
    
    return NextResponse.json(healthResponse, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store',
        'X-Health-Check-Duration': `${Date.now() - startTime}ms`
      }
    });

  } catch (error) {
    console.error('[Agents Health Check] Erro crítico:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: {
        database: { status: 'down' },
        redis: { status: 'down' },
        agents: { status: 'down', successRate: 0, averageResponseTime: 0, fallbackUsageRate: 0 },
        cache: { status: 'down', hitRate: 0, totalHits: 0, totalMisses: 0 }
      },
      alerts: ['Health check system failure']
    }, { status: 503 });
  }
}

/**
 * Testa a saúde do banco de dados
 */
async function testDatabaseHealth(): Promise<{ status: 'operational' | 'degraded' | 'down'; responseTime: number }> {
  const startTime = Date.now();
  
  try {
    // Teste simples de conectividade
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;
    
    return {
      status: responseTime < 1000 ? 'operational' : 'degraded',
      responseTime
    };
  } catch (error) {
    console.error('[Health Check] Database error:', error);
    return {
      status: 'down',
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * Testa a saúde do Redis
 */
async function testRedisHealth(): Promise<{ 
  status: 'operational' | 'degraded' | 'down'; 
  responseTime: number;
  memoryUsage?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Teste de ping
    const pingResult = await redis.ping();
    const responseTime = Date.now() - startTime;
    
    if (pingResult !== 'PONG') {
      return { status: 'down', responseTime };
    }
    
    // Check Redis memory usage  
    const memoryUsage = 'N/A'; // redis.info not available on HybridRedisClient
    
    return {
      status: responseTime < 500 ? 'operational' : 'degraded',
      responseTime,
      memoryUsage
    };
  } catch (error) {
    console.error('[Health Check] Redis error:', error);
    return {
      status: 'down',
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * Calcula o status dos agentes baseado nas métricas
 */
function calculateAgentStatus(
  metrics: any,
  alerts: string[]
): {
  status: 'operational' | 'degraded' | 'down';
  successRate: number;
  averageResponseTime: number;
  fallbackUsageRate: number;
} {
  if (!metrics || !metrics.overall) {
    alerts.push('Métricas de agentes indisponíveis');
    return {
      status: 'down',
      successRate: 0,
      averageResponseTime: 0,
      fallbackUsageRate: 0
    };
  }

  const { overall } = metrics;
  const successRate = overall.successRate || 0;
  const averageResponseTime = overall.averageResponseTime || 0;
  const fallbackUsageRate = overall.fallbackUsageRate || 0;

  // Critérios de saúde
  let status: 'operational' | 'degraded' | 'down' = 'operational';

  if (successRate < 50) {
    status = 'down';
    alerts.push(`Taxa de sucesso crítica: ${successRate.toFixed(1)}%`);
  } else if (successRate < 80) {
    status = 'degraded';
    alerts.push(`Taxa de sucesso baixa: ${successRate.toFixed(1)}%`);
  }

  if (averageResponseTime > 5000) {
    status = status === 'down' ? 'down' : 'degraded';
    alerts.push(`Tempo de resposta alto: ${averageResponseTime.toFixed(0)}ms`);
  }

  if (fallbackUsageRate > 50) {
    alerts.push(`Alto uso de fallbacks: ${fallbackUsageRate.toFixed(1)}%`);
  }

  return {
    status,
    successRate,
    averageResponseTime,
    fallbackUsageRate
  };
}

/**
 * Calcula o status do cache baseado nas métricas
 */
function calculateCacheStatus(
  metrics: any,
  alerts: string[]
): {
  status: 'operational' | 'degraded' | 'down';
  hitRate: number;
  totalHits: number;
  totalMisses: number;
} {
  if (!metrics || !metrics.overall) {
    alerts.push('Métricas de cache indisponíveis');
    return {
      status: 'down',
      hitRate: 0,
      totalHits: 0,
      totalMisses: 0
    };
  }

  const { overall } = metrics;
  const hitRate = (overall.averageHitRate || 0) * 100;
  const totalHits = overall.totalCacheHits || 0;
  const totalMisses = overall.totalCacheMisses || 0;

  let status: 'operational' | 'degraded' | 'down' = 'operational';

  if (hitRate < 30) {
    status = 'degraded';
    alerts.push(`Taxa de cache hit baixa: ${hitRate.toFixed(1)}%`);
  }

  if (totalHits + totalMisses === 0) {
    alerts.push('Cache não está sendo utilizado');
  }

  return {
    status,
    hitRate,
    totalHits,
    totalMisses
  };
}

/**
 * Determina o status geral baseado nos status individuais
 */
function determineOverallStatus(
  statuses: ('operational' | 'degraded' | 'down')[]
): 'healthy' | 'degraded' | 'unhealthy' {
  if (statuses.includes('down')) {
    return 'unhealthy';
  }
  
  if (statuses.includes('degraded')) {
    return 'degraded';
  }
  
  return 'healthy';
}

// Importar sql do drizzle
import { sql } from 'drizzle-orm';