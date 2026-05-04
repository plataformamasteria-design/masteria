import { NextRequest } from 'next/server';
import { requireSuperAdmin, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { emailEvents, adminAuditLogs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    // SECURITY NOTE: Esta rota é protegida por requireSuperAdmin e permite queries globais
    // intencionalmente para superadmins visualizarem eventos de email de todas as empresas.
    // O filtro opcional por companyId permite focar em uma empresa específica.

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const companyId = searchParams.get('companyId');
    const eventType = searchParams.get('eventType');

    const query = db.select().from(emailEvents);
    
    const conditions = [];
    if (companyId) conditions.push(eq(emailEvents.companyId, companyId));
    if (eventType) conditions.push(eq(emailEvents.eventType, eventType as any));

    const allEvents = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;

    const paginatedEvents = allEvents.slice(offset, offset + limit);

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'get_email_events',
      resource: 'email_events',
      metadata: { limit, offset, companyId, eventType },
    });

    return createSuccessResponse({
      events: paginatedEvents,
      total: allEvents.length,
    });
  } catch (error: any) {
    return createErrorResponse(error.message, 500);
  }
}
