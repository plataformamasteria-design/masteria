import { NextRequest } from 'next/server';
import { requireSuperAdmin, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { features, companyFeatureAccess, adminAuditLogs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    // SECURITY NOTE: Esta rota é protegida por requireSuperAdmin e faz query global
    // intencionalmente para listar todas as features disponíveis no sistema.
    // Features são recursos globais, não scoped por companyId.

    const allFeatures = await db.select().from(features);

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'get_features',
      resource: 'features',
    });

    return createSuccessResponse({ features: allFeatures });
  } catch (error: any) {
    return createErrorResponse(error.message, 500);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    const body = await request.json();
    const { companyId, featureId, isActive, accessLevel } = body;

    if (!companyId || !featureId) {
      return createErrorResponse('companyId and featureId are required', 400);
    }

    const existing = await db.select()
      .from(companyFeatureAccess)
      .where(and(eq(companyFeatureAccess.companyId, companyId), eq(companyFeatureAccess.featureId, featureId)));

    let result;
    if (existing.length > 0) {
      result = await db.update(companyFeatureAccess)
        .set({ isActive: isActive ?? true, accessLevel: accessLevel || 'full' })
        .where(and(eq(companyFeatureAccess.companyId, companyId), eq(companyFeatureAccess.featureId, featureId)))
        .returning();
    } else {
      result = await db.insert(companyFeatureAccess)
        .values({ companyId, featureId, isActive: isActive ?? true, accessLevel: accessLevel || 'full' })
        .returning();
    }

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'update_company_feature_access',
      resource: 'company_feature_access',
      resourceId: result[0]?.id || '',
      metadata: { companyId, featureId, isActive },
    });

    return createSuccessResponse(result[0] || {});
  } catch (error: any) {
    return createErrorResponse(error.message, 500);
  }
}
