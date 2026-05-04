import { NextRequest } from 'next/server';
import { requireSuperAdmin, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { companies, adminAuditLogs } from '@/lib/db/schema';
import { eq, ilike, isNull, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createCompanySchema = z.object({
  name: z.string().min(3),
  website: z.string().url().optional(),
  addressCity: z.string().optional(),
});

const updateCompanySchema = z.object({
  name: z.string().min(3).optional(),
  website: z.string().url().optional(),
  addressCity: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';

    const allCompanies = search 
      ? await db.select().from(companies).where(and(ilike(companies.name, `%${search}%`), isNull(companies.deletedAt)))
      : await db.select().from(companies).where(isNull(companies.deletedAt));
    
    const paginatedCompanies = allCompanies.slice(offset, offset + limit);

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'get_companies',
      resource: 'companies',
      resourceId: null,
    });

    return createSuccessResponse({
      companies: paginatedCompanies,
      total: allCompanies.length,
    });
  } catch (error: any) {
    return createErrorResponse(error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    const body = await request.json();
    const data = createCompanySchema.parse(body);

    const existing = await db.select().from(companies).where(eq(companies.name, data.name));
    if (existing.length > 0) {
      return createErrorResponse('Company already exists', 400);
    }

    const newCompany = await db.insert(companies).values(data).returning();

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'create_company',
      resource: 'companies',
      resourceId: newCompany[0]?.id || '',
      metadata: data,
    });

    return createSuccessResponse(newCompany[0] || {}, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(JSON.stringify(error.errors), 400);
    }
    return createErrorResponse(error.message, 500);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    const body = await request.json();
    const { companyId, ...updateData } = body;
    
    if (!companyId) return createErrorResponse('companyId is required', 400);

    const validated = updateCompanySchema.parse(updateData);
    const updated = await db.update(companies).set(validated).where(eq(companies.id, companyId)).returning();

    if (updated.length === 0) {
      return createErrorResponse('Company not found', 404);
    }

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'update_company',
      resource: 'companies',
      resourceId: companyId,
      metadata: validated,
    });

    return createSuccessResponse(updated[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(JSON.stringify(error.errors), 400);
    }
    return createErrorResponse(error.message, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('id');

    if (!companyId) return createErrorResponse('companyId is required', 400);

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
    return createErrorResponse(error.message, 500);
  }
}
