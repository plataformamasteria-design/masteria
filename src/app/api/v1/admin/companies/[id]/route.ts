import { NextRequest } from 'next/server';
import { requireSuperAdmin, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { companies, adminAuditLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withRateLimit } from '@/lib/rate-limit';

async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    const companyId = id;

    if (!companyId) {
      return createErrorResponse('companyId is required', 400);
    }

    const deleted = await db.delete(companies).where(eq(companies.id, companyId)).returning();

    if (deleted.length === 0) {
      return createErrorResponse('Company not found', 404);
    }

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'delete_company',
      resource: 'companies',
      resourceId: companyId,
      metadata: { name: deleted[0]?.name || 'unknown' },
    });

    return createSuccessResponse({ success: true, id: companyId });
  } catch (error: any) {
    return createErrorResponse(error.message || 'Error', 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  return withRateLimit(request, () => handleDelete(request, context), 50);
}
