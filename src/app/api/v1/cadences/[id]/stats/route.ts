import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { CadenceService } from '@/lib/cadence-service';
import { db } from '@/lib/db';
import { cadenceDefinitions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/v1/cadences/[id]/stats
 * Obtém estatísticas de uma cadência
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

    const stats = await CadenceService.getCadenceStats(id, companyId);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching cadence stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cadence stats' },
      { status: 500 }
    );
  }
}
