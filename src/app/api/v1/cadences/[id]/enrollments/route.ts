import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { cadenceDefinitions, cadenceEnrollments } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * GET /api/v1/cadences/[id]/enrollments
 * Lista enrollments de uma cadência
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();

    // Verificar se cadência pertence à empresa
    const cadence = await db.query.cadenceDefinitions.findFirst({
      where: and(
        eq(cadenceDefinitions.id, id),
        eq(cadenceDefinitions.companyId, companyId)
      ),
    });

    if (!cadence) {
      return NextResponse.json(
        { error: 'Cadence not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'active', 'completed', 'cancelled'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Query com filtros
    // SECURITY: Validar tenant - cadence já foi validado acima, garantindo que cadenceId pertence à empresa
    // cadenceEnrollments não tem companyId direto, mas está relacionado a cadenceDefinitions que tem
    const whereConditions = [eq(cadenceEnrollments.cadenceId, id)];
    if (status) {
      whereConditions.push(eq(cadenceEnrollments.status, status as any));
    }

    const enrollments = await db.query.cadenceEnrollments.findMany({
      where: and(...whereConditions),
      orderBy: [desc(cadenceEnrollments.enrolledAt)],
      limit,
      offset,
      with: {
        contact: {
          columns: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        lead: {
          columns: {
            id: true,
            title: true,
            stageId: true,
          },
        },
      },
    });

    // Total count
    // SECURITY: Validar tenant - cadence já foi validado acima
    const countResult = await db
      .select({ count: db.$count(cadenceEnrollments.id) })
      .from(cadenceEnrollments)
      .where(and(...whereConditions));
    
    const count = countResult[0]?.count ?? 0;

    return NextResponse.json({
      enrollments,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrollments' },
      { status: 500 }
    );
  }
}
