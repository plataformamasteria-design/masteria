

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { webhooks } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';


const webhookSchema = z.object({
    name: z.string().min(1, 'Nome do webhook é obrigatório'),
    url: z.string().url('URL inválida'),
    eventTriggers: z.array(z.string()).min(1, 'Pelo menos um evento gatilho é necessário'),
});


// GET /api/v1/settings/webhooks - List webhooks

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const companyWebhooks = await db
            .select()
            .from(webhooks)
            .where(eq(webhooks.companyId, companyId))
            .orderBy(desc(webhooks.createdAt));
        
        return NextResponse.json(companyWebhooks);
    } catch (error) {
        console.error('Erro ao buscar webhooks:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// POST /api/v1/settings/webhooks - Create a new webhook
export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsedData = webhookSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { name, url, eventTriggers } = parsedData.data;

        const [newWebhook] = await db.insert(webhooks).values({
            companyId,
            name,
            url,
            eventTriggers,
            isActive: true,
        }).returning();

        return NextResponse.json(newWebhook, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar webhook:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

