
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { webhooks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';


const webhookUpdateSchema = z.object({
  name: z.string().min(1, 'Nome do webhook é obrigatório').optional(),
  url: z.string().url('URL inválida').optional(),
  eventTriggers: z.array(z.string()).min(1, 'Pelo menos um evento gatilho é necessário').optional(),
  isActive: z.boolean().optional(),
});


// PUT /api/v1/settings/webhooks/[webhookId] - Update a webhook

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { webhookId } = await params;
        const body = await request.json();
        const parsedData = webhookUpdateSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }

        const [result] = await db.select({ companyId: webhooks.companyId }).from(webhooks).where(eq(webhooks.id, webhookId)).limit(1);
        if (!result || result.companyId !== companyId) {
             return NextResponse.json({ error: 'Webhook não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        // SECURITY: Validar tenant ao atualizar webhook (já validado acima, mas garantindo segurança)
        const [updatedWebhook] = await db.update(webhooks)
            .set(parsedData.data)
            .where(and(
                eq(webhooks.id, webhookId),
                eq(webhooks.companyId, companyId)
            ))
            .returning();
            
        return NextResponse.json(updatedWebhook);
    } catch (error) {
        console.error('Erro ao atualizar webhook:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// DELETE /api/v1/settings/webhooks/[webhookId] - Delete a webhook
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { webhookId } = await params;
        
        const result = await db.delete(webhooks)
            .where(and(eq(webhooks.id, webhookId), eq(webhooks.companyId, companyId)))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Webhook não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        return new NextResponse(null, { status: 204 }); // No Content

    } catch (error) {
        console.error('Erro ao excluir webhook:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
