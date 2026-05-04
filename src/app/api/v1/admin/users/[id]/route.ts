import { NextRequest } from 'next/server';
import { requireSuperAdmin, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { users, adminAuditLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withRateLimit } from '@/lib/rate-limit';

async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    const userId = id;

    if (!userId) {
      return createErrorResponse('userId is required', 400);
    }

    if (userId === auth.data!.id) {
      return createErrorResponse('Cannot delete your own account', 400);
    }

    const deleted = await db.delete(users).where(eq(users.id, userId)).returning();

    if (deleted.length === 0) {
      return createErrorResponse('User not found', 404);
    }

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'delete_user',
      resource: 'users',
      resourceId: userId,
      metadata: { email: deleted[0]?.email || 'unknown' },
    });

    return createSuccessResponse({ success: true, id: userId });
  } catch (error: any) {
    return createErrorResponse(error.message || 'Error', 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  return withRateLimit(request, () => handleDelete(request, context), 50);
}
