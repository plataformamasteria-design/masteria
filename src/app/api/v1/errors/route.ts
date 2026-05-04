// src/app/api/v1/errors/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getUserIdFromSession, getCompanyIdFromSession } from '@/app/actions';
import { ErrorMonitoringService } from '@/lib/monitoring/error-monitoring.service';

export const dynamic = 'force-dynamic';

// POST /api/v1/errors - Capture error
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, message, errorType, stack, severity, context } = body;

    // Validação básica
    if (!source || !message) {
      return NextResponse.json(
        { error: 'source and message are required' },
        { status: 400 }
      );
    }

    // Capturar contexto do usuário (opcional)
    let userId: string | undefined;
    let companyId: string | undefined;
    
    try {
      userId = await getUserIdFromSession();
      companyId = await getCompanyIdFromSession();
    } catch (e) {
      // Erro não autenticado, ok
    }

    const errorId = await ErrorMonitoringService.captureError({
      source,
      message,
      errorType,
      stack,
      severity,
      context: {
        ...context,
        userAgent: request.headers.get('user-agent') || undefined,
        url: request.url,
      },
      userId,
      companyId,
    });

    if (!errorId) {
      return NextResponse.json(
        { error: 'Failed to capture error' },
        { status: 500 }
      );
    }

    return NextResponse.json({ errorId, success: true });
  } catch (error) {
    console.error('Error in error capture API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/v1/errors - Get recent errors (admin only)
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    const { db } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const errors = user.role === 'superadmin'
      ? await ErrorMonitoringService.getRecentErrors(limit)
      : await ErrorMonitoringService.getRecentErrors(limit, user.companyId || undefined);

    return NextResponse.json({ errors });
  } catch (error) {
    console.error('Error fetching errors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
