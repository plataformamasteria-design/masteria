import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cadenceDefinitions } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateCadenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  funnelId: z.string().optional(),
  stageId: z.string().optional(),
  triggerAfterDays: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/v1/cadences/[id]
 * Obtém uma cadência específica
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

    const cadence = await db.query.cadenceDefinitions.findFirst({
      where: and(
        eq(cadenceDefinitions.id, id),
        eq(cadenceDefinitions.companyId, companyId)
      ),
      with: {
        funnel: true,
        steps: {
          orderBy: (steps) => [steps.stepOrder],
        },
      },
    });

    if (!cadence) {
      return NextResponse.json(
        { error: 'Cadence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ cadence });
  } catch (error) {
    console.error('Error fetching cadence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cadence' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/cadences/[id]
 * Atualiza uma cadência
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();

    // Verificar se cadência pertence à empresa
    const existingCadence = await db.query.cadenceDefinitions.findFirst({
      where: and(
        eq(cadenceDefinitions.id, id),
        eq(cadenceDefinitions.companyId, companyId)
      ),
    });

    if (!existingCadence) {
      return NextResponse.json(
        { error: 'Cadence not found or access denied' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = updateCadenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.funnelId !== undefined) updateData.funnelId = parsed.data.funnelId || null;
    if (parsed.data.stageId !== undefined) updateData.stageId = parsed.data.stageId || null;
    if (parsed.data.triggerAfterDays !== undefined) updateData.triggerAfterDays = parsed.data.triggerAfterDays;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updateData.updatedAt = new Date();

    const [updatedCadence] = await db
      .update(cadenceDefinitions)
      .set(updateData)
      .where(and(
        eq(cadenceDefinitions.id, id),
        eq(cadenceDefinitions.companyId, companyId)
      ))
      .returning();

    if (!updatedCadence) {
      return NextResponse.json(
        { error: 'Failed to update cadence' },
        { status: 500 }
      );
    }

    // Buscar cadência completa
    const fullCadence = await db.query.cadenceDefinitions.findFirst({
      where: and(
        eq(cadenceDefinitions.id, id),
        eq(cadenceDefinitions.companyId, companyId)
      ),
      with: {
        steps: {
          orderBy: (steps) => [steps.stepOrder],
        },
      },
    });

    return NextResponse.json({ cadence: fullCadence });
  } catch (error) {
    console.error('Error updating cadence:', error);
    return NextResponse.json(
      { error: 'Failed to update cadence' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/cadences/[id]
 * Deleta uma cadência
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();

    // Verificar se cadência pertence à empresa
    const existingCadence = await db.query.cadenceDefinitions.findFirst({
      where: and(
        eq(cadenceDefinitions.id, id),
        eq(cadenceDefinitions.companyId, companyId)
      ),
    });

    if (!existingCadence) {
      return NextResponse.json(
        { error: 'Cadence not found or access denied' },
        { status: 404 }
      );
    }

    // Deletar cadência (cascade deletará steps e enrollments automaticamente)
    await db
      .delete(cadenceDefinitions)
      .where(and(
        eq(cadenceDefinitions.id, id),
        eq(cadenceDefinitions.companyId, companyId)
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cadence:', error);
    return NextResponse.json(
      { error: 'Failed to delete cadence' },
      { status: 500 }
    );
  }
}
