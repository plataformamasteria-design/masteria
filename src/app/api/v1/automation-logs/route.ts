// src/app/api/v1/automation-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { automationLogs, automationRules } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, ilike } from 'drizzle-orm';

// Pagination limit constants
const MAX_LIMIT = 50; // Maximum records per request to prevent performance issues
const DEFAULT_LIMIT = 50;

interface AutomationLogFilters {
  level?: 'INFO' | 'WARN' | 'ERROR';
  ruleId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// GET /api/v1/automation-logs

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Enforce maximum limit to prevent performance issues
    const requestedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT));
    const safeLimit = Math.min(requestedLimit, MAX_LIMIT);
    
    const filters: AutomationLogFilters = {
      level: searchParams.get('level') as 'INFO' | 'WARN' | 'ERROR' | undefined,
      ruleId: searchParams.get('ruleId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: safeLimit,
    };

    // Construir condições de filtro
    const conditions = [eq(automationLogs.companyId, session.user.companyId)];

    if (filters.level) {
      conditions.push(eq(automationLogs.level, filters.level));
    }

    if (filters.ruleId) {
      conditions.push(eq(automationLogs.ruleId, filters.ruleId));
    }

    if (filters.startDate) {
      conditions.push(gte(automationLogs.createdAt, new Date(filters.startDate)));
    }

    if (filters.endDate) {
      conditions.push(lte(automationLogs.createdAt, new Date(filters.endDate)));
    }

    if (filters.search) {
      conditions.push(ilike(automationLogs.message, `%${filters.search}%`));
    }

    // Calcular offset para paginação
    const offset = ((filters.page || 1) - 1) * (filters.limit || 50);

    // Buscar logs com join para obter nome da regra
    const logs = await db
      .select({
        id: automationLogs.id,
        level: automationLogs.level,
        message: automationLogs.message,
        details: automationLogs.details,
        conversationId: automationLogs.conversationId,
        ruleId: automationLogs.ruleId,
        ruleName: automationRules.name,
        createdAt: automationLogs.createdAt,
      })
      .from(automationLogs)
      .leftJoin(automationRules, eq(automationLogs.ruleId, automationRules.id))
      .where(and(...conditions))
      .orderBy(desc(automationLogs.createdAt))
      .limit(filters.limit || 50)
      .offset(offset);

    // Contar total de registros para paginação
    const totalResult = await db
      .select({ count: automationLogs.id })
      .from(automationLogs)
      .where(and(...conditions));
    
    const total = totalResult.length;
    const totalPages = Math.ceil(total / (filters.limit || 50));

    return NextResponse.json({
      logs,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 50,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar logs de automação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}