import { NextRequest } from 'next/server';
import { requireSuperAdmin, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { companies, adminAuditLogs, users, contacts, connections as dbConnections } from '@/lib/db/schema';
import { eq, ilike, isNull, and, sql, desc, asc } from 'drizzle-orm';
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
  isStarred: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return createErrorResponse(auth.error, auth.status);

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'name'; // name, users, leads, connections

    let baseQuery = db.select({
      ...companies,
      usersCount: sql<number>`CAST((SELECT count(*) FROM ${users} WHERE ${users.companyId} = ${companies.id}) AS INTEGER)`.as('usersCount'),
      leadsCount: sql<number>`CAST((SELECT count(*) FROM ${contacts} WHERE ${contacts.companyId} = ${companies.id}) AS INTEGER)`.as('leadsCount'),
      connectionsCount: sql<number>`CAST((SELECT count(*) FROM ${dbConnections} WHERE ${dbConnections.companyId} = ${companies.id}) AS INTEGER)`.as('connectionsCount'),
    }).from(companies);

    const conditions = [isNull(companies.deletedAt)];
    if (search) {
      conditions.push(ilike(companies.name, `%${search}%`));
    }

    baseQuery = baseQuery.where(and(...conditions));

    let sortOrder;
    if (sortBy === 'users') {
      sortOrder = desc(sql`"usersCount"`);
    } else if (sortBy === 'leads') {
      sortOrder = desc(sql`"leadsCount"`);
    } else if (sortBy === 'connections') {
      sortOrder = desc(sql`"connectionsCount"`);
    } else {
      sortOrder = asc(companies.name);
    }

    // Sempre ordena primeiro por estrelados
    baseQuery = baseQuery.orderBy(desc(companies.isStarred), sortOrder);

    const paginatedCompanies = await baseQuery.limit(limit).offset(offset);

    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(companies).where(and(...conditions));
    const total = Number(totalResult[0]?.count || 0);

    await db.insert(adminAuditLogs).values({
      userId: auth.data!.id,
      action: 'get_companies',
      resource: 'companies',
      resourceId: null,
    });

    return createSuccessResponse({
      companies: paginatedCompanies,
      total: total,
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
