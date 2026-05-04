
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { crmMappings, crmIntegrations } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';


const mappingSchema = z.object({
  boardId: z.string().uuid(),
  pipelineId: z.string(), // Kommo IDs can be numbers as strings
  stageMap: z.record(z.string()), // { kommoStageId: kanbanStageId }
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = mappingSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados de mapeamento inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        
        const { boardId, pipelineId, stageMap } = parsed.data;

        const [integration] = await db.select()
            .from(crmIntegrations)
            .where(and(eq(crmIntegrations.companyId, companyId), eq(crmIntegrations.provider, 'kommo')));
        
        if (!integration) {
            return NextResponse.json({ error: 'Integração Kommo não encontrada para esta empresa.' }, { status: 404 });
        }

        // Upsert logic
        await db.insert(crmMappings)
            .values({
                integrationId: integration.id,
                boardId,
                pipelineId,
                stageMap,
            })
            .onConflictDoUpdate({
                target: crmMappings.boardId, // Assuming one mapping per board for now
                set: {
                    pipelineId,
                    stageMap
                }
            });

        return NextResponse.json({ success: true, message: 'Mapeamento salvo com sucesso!' });

    } catch (error) {
        console.error('Erro ao salvar mapeamento da Kommo:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
