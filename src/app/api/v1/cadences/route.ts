import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cadenceDefinitions, cadenceSteps } from '@/lib/db/schema';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';
import { getCompanyIdFromSession } from '@/app/actions';

const createCadenceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  funnelId: z.string().optional(),
  stageId: z.string().optional(),
  triggerAfterDays: z.number().int().positive().default(21),
  isActive: z.boolean().default(true),
  steps: z.array(z.object({
    stepOrder: z.number().int().positive(),
    offsetDays: z.number().int().min(0),
    channel: z.string().default('whatsapp'),
    templateId: z.string().optional(),
    messageContent: z.string().optional(),
  })).min(1, 'At least one step is required'),
});

/**
 * GET /api/v1/cadences
 * Lista todas as cadências da empresa
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) {
      return authResult; // Retorna 401 se não autenticado
    }
    const { companyId } = authResult;

    const cacheKey = `cadences:${companyId}`;
    const cadences = await getCachedOrFetch(cacheKey, async () => {
      return await db.query.cadenceDefinitions.findMany({
        where: eq(cadenceDefinitions.companyId, companyId),
        orderBy: [desc(cadenceDefinitions.createdAt)],
        with: {
          funnel: {
            columns: {
              id: true,
              name: true,
            },
          },
          steps: {
            orderBy: (steps) => [steps.stepOrder],
          },
        },
      });
    }, CacheTTL.CONFIG_SEMI_STATIC);

    return NextResponse.json({ cadences });
  } catch (error) {
    // Se já é uma resposta NextResponse (401), retorna diretamente
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error fetching cadences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cadences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/cadences
 * Cria uma nova cadência
 */
export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();

    const body = await req.json();
    const validatedData = createCadenceSchema.parse(body);

    // Criar cadência
    const [cadence] = await db.insert(cadenceDefinitions)
      .values({
        companyId,
        name: validatedData.name,
        description: validatedData.description,
        funnelId: validatedData.funnelId || null,
        stageId: validatedData.stageId || null,
        triggerAfterDays: validatedData.triggerAfterDays,
        isActive: validatedData.isActive,
      })
      .returning();

    if (!cadence) {
      return NextResponse.json(
        { error: 'Failed to create cadence' },
        { status: 500 }
      );
    }

    // Criar steps
    const stepsToInsert = validatedData.steps.map(step => ({
      cadenceId: cadence.id,
      stepOrder: step.stepOrder,
      offsetDays: step.offsetDays,
      channel: step.channel,
      templateId: step.templateId || null,
      messageContent: step.messageContent || null,
    }));

    await db.insert(cadenceSteps).values(stepsToInsert);

    // Buscar cadência completa com steps
    const fullCadence = await db.query.cadenceDefinitions.findFirst({
      where: and(
        eq(cadenceDefinitions.id, cadence.id),
        eq(cadenceDefinitions.companyId, companyId)
      ),
      with: {
        steps: {
          orderBy: (steps) => [steps.stepOrder],
        },
      },
    });

    return NextResponse.json(
      { cadence: fullCadence },
      { status: 201 }
    );
  } catch (error) {
    // Se já é uma resposta NextResponse (401), retorna diretamente
    if (error instanceof NextResponse) {
      return error;
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating cadence:', error);
    return NextResponse.json(
      { error: 'Failed to create cadence' },
      { status: 500 }
    );
  }
}
