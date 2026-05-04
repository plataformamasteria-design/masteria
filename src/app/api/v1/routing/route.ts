
// src/app/api/v1/routing/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

const routingUpdateSchema = z.array(z.object({
    connectionId: z.string().uuid(),
    personaId: z.string().uuid().or(z.literal('manual')).nullable(),
}));


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = routingUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados de roteamento inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const updates = parsed.data;

        await db.transaction(async (tx) => {
            for (const update of updates) {
                await tx.update(connections)
                    .set({ assignedPersonaId: update.personaId === 'manual' ? null : update.personaId })
                    .where(and(
                        eq(connections.id, update.connectionId),
                        eq(connections.companyId, companyId)
                    ));
            }
        });

        return NextResponse.json({ success: true, message: 'Regras de roteamento salvas com sucesso.' });

    } catch (error) {
        console.error('Erro ao salvar roteamento:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

