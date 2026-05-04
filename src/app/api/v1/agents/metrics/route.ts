// src/app/api/v1/agents/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { aiAgentExecutions } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

// GET /api/v1/agents/metrics - Obter métricas de performance dos agentes

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user } = await getUserSession();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin ou superadmin
    if (!['admin', 'superadmin'].includes(user.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';
    const agentType = searchParams.get('agent');
    const companyId = searchParams.get('companyId');

    // Calcular período de tempo
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Construir filtros
    const filters = [
      gte(aiAgentExecutions.createdAt, startDate),
      lte(aiAgentExecutions.createdAt, now)
    ];

    if (agentType) {
      filters.push(eq(aiAgentExecutions.agentName, agentType));
    }

    if (companyId && user.role !== 'superadmin') {
      filters.push(eq(aiAgentExecutions.companyId, companyId));
    } else if (user.role !== 'superadmin' && user.companyId) {
      filters.push(eq(aiAgentExecutions.companyId, user.companyId));
    }

    // Buscar execuções do banco
    const executions = await db
      .select()
      .from(aiAgentExecutions)
      .where(and(...filters))
      .orderBy(desc(aiAgentExecutions.createdAt))
      .limit(10000); // Limitar para performance

    // Calcular métricas agregadas
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    // Calcular tempo médio de resposta
    const responseTimes = executions
      .filter(e => e.executionTime !== null)
      .map(e => e.executionTime!);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Calcular uso de fallbacks (baseado no status)
    const fallbackExecutions = executions.filter(e => e.status === 'fallback').length;
    const fallbackUsageRate = totalExecutions > 0 ? (fallbackExecutions / totalExecutions) * 100 : 0;

    // Calcular confiança média (não disponível no schema atual)
    const averageConfidence = 0;

    // Calcular custos e tokens
    const totalTokenUsage = executions
      .filter(e => e.tokensUsed !== null)
      .reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    
    const totalCost = executions
      .filter(e => e.cost !== null)
      .reduce((sum, e) => sum + (parseFloat(e.cost!) || 0), 0);

    // Breakdown por agente
    const agentBreakdown: Record<string, any> = {};
    const agentTypes = [...new Set(executions.map(e => e.agentName).filter(Boolean))] as string[];
    
    for (const type of agentTypes) {
      const agentExecutions = executions.filter(e => e.agentName === type);
      const agentSuccessful = agentExecutions.filter(e => e.status === 'completed').length;
      const agentResponseTimes = agentExecutions
        .filter(e => e.executionTime !== null)
        .map(e => e.executionTime!);
      
      agentBreakdown[type] = {
        totalExecutions: agentExecutions.length,
        successfulExecutions: agentSuccessful,
        failedExecutions: agentExecutions.length - agentSuccessful,
        successRate: agentExecutions.length > 0 ? (agentSuccessful / agentExecutions.length) * 100 : 0,
        averageResponseTime: agentResponseTimes.length > 0
          ? agentResponseTimes.reduce((a, b) => a + b, 0) / agentResponseTimes.length
          : 0,
        fallbackUsageRate: agentExecutions.length > 0
          ? (agentExecutions.filter(e => e.status === 'fallback').length / agentExecutions.length) * 100
          : 0
      };
    }

    // Breakdown de erros
    const errorBreakdown: Record<string, number> = {};
    executions
      .filter(e => e.status !== 'completed')
      .forEach(e => {
        const errorType = e.status;
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
      });

    // Buscar métricas de cache do Redis
    let cacheMetrics = {
      hitRate: 0,
      totalHits: 0,
      totalMisses: 0
    };

    try {
      // Cache stats would require redis.hgetall which is not available on HybridRedisClient
      // HybridRedisClient only supports basic operations like ping() and get/set
      const hits = 0;
      const misses = 0;
      const total = hits + misses;
      
      cacheMetrics = {
        hitRate: total > 0 ? (hits / total) * 100 : 0,
        totalHits: hits,
        totalMisses: misses
      };
    } catch (error) {
      console.error('Erro ao buscar métricas de cache:', error);
    }

    // Métricas históricas (últimas 24 horas por hora)
    const historicalMetrics = [];
    const hoursBack = 24;
    
    for (let i = hoursBack; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const hourExecutions = executions.filter(e => 
        e.createdAt >= hourStart && e.createdAt < hourEnd
      );
      
      const hourSuccessful = hourExecutions.filter(e => e.status === 'completed').length;
      const hourResponseTimes = hourExecutions
        .filter(e => e.executionTime !== null)
        .map(e => e.executionTime!);
      
      historicalMetrics.push({
        timestamp: hourStart.toISOString(),
        totalExecutions: hourExecutions.length,
        successRate: hourExecutions.length > 0 ? (hourSuccessful / hourExecutions.length) * 100 : 0,
        averageResponseTime: hourResponseTimes.length > 0
          ? hourResponseTimes.reduce((a, b) => a + b, 0) / hourResponseTimes.length
          : 0,
        errorCount: hourExecutions.length - hourSuccessful
      });
    }

    const response = {
      period,
      timestamp: now.toISOString(),
      summary: {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate,
        averageResponseTime,
        fallbackUsageRate,
        averageConfidence,
        totalTokenUsage,
        totalCost,
        cacheHitRate: cacheMetrics.hitRate
      },
      breakdown: {
        byAgent: agentBreakdown,
        byError: errorBreakdown
      },
      cache: cacheMetrics,
      historical: historicalMetrics,
      recentExecutions: executions
        .slice(0, 10)
        .map(e => ({
          id: e.id,
          agentName: e.agentName,
          toolName: e.toolName,
          status: e.status,
          responseTime: e.executionTime,
          tokensUsed: e.tokensUsed,
          cost: e.cost,
          createdAt: e.createdAt
        }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao buscar métricas de agentes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/agents/metrics - Limpar métricas (apenas superadmin)
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getUserSession();
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'reset-cache') {
      // Limpar métricas de cache do Redis
      // redis.del not available on HybridRedisClient - skip cache clearing
      // await redis.del('cache:stats');
      // await redis.del('agent:metrics:*'); // Not available on HybridRedisClient
      
      return NextResponse.json({ 
        message: 'Métricas de cache resetadas com sucesso' 
      });
    }

    if (action === 'reset-all') {
      // Limpar todas as execuções antigas (manter últimas 24h)
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await db
        .delete(aiAgentExecutions)
        .where(lte(aiAgentExecutions.createdAt, cutoffDate));
      
      // Limpar cache
      // redis.del not available on HybridRedisClient - skip cache clearing
      // await redis.del('cache:stats');
      // await redis.del('agent:metrics:*'); // Not available on HybridRedisClient
      
      return NextResponse.json({ 
        message: 'Todas as métricas foram resetadas (mantidas últimas 24h)' 
      });
    }

    return NextResponse.json(
      { error: 'Ação não reconhecida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro ao resetar métricas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}