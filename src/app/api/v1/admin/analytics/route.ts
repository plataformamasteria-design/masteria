import { NextRequest } from 'next/server';
import { requireSuperAdmin, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { users, companies, emailEvents, adminAuditLogs, companyFeatureAccess, features } from '@/lib/db/schema';
import { count, eq, gte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    // SECURITY NOTE: Esta rota é protegida por requireSuperAdmin e faz queries globais
    // intencionalmente para fornecer estatísticas agregadas do sistema inteiro.
    // Apenas superadmins têm acesso a esta rota.

    // Get total users
    const totalUsersResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersResult[0]?.count || 0;

    // Get total companies
    const totalCompaniesResult = await db.select({ count: count() }).from(companies);
    const totalCompanies = totalCompaniesResult[0]?.count || 0;

    // Get total email events
    const totalEmailsResult = await db.select({ count: count() }).from(emailEvents);
    const totalEmails = totalEmailsResult[0]?.count || 0;

    // Get email events by status (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const emailEventsByType = await db.select({
      eventType: emailEvents.eventType,
      count: count(),
    }).from(emailEvents)
      .where(gte(emailEvents.createdAt, thirtyDaysAgo))
      .groupBy(emailEvents.eventType);

    // Get most used features
    const mostUsedFeatures = await db.select({
      featureName: features.name,
      count: count(),
    }).from(companyFeatureAccess)
      .leftJoin(features, eq(companyFeatureAccess.featureId, features.id))
      .where(eq(companyFeatureAccess.isActive, true))
      .groupBy(features.name);

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'get_analytics',
      resource: 'analytics',
    });

    return createSuccessResponse({
      stats: {
        totalUsers,
        totalCompanies,
        totalEmails,
        emailEventsByType,
        mostUsedFeatures,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    return createErrorResponse(error.message, 500);
  }
}
