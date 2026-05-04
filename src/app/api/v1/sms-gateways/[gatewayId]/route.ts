
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { smsGateways } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto';


const gatewayUpdateSchema = z.object({
    name: z.string().min(1, 'Nome da configuração é obrigatório.').optional(),
    credentials: z.record(z.any()).optional(),
    isActive: z.boolean().optional(),
});


// PUT /api/v1/sms-gateways/[gatewayId]

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ gatewayId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { gatewayId } = await params;
        const body = await request.json();
        const parsed = gatewayUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { name, credentials, isActive } = parsed.data;

        const updateData: Partial<typeof smsGateways.$inferInsert> = {};

        if (name) {
            updateData.name = name;
        }

        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }
        
        // Encrypt credential values that are being updated
        if (credentials) {
            const encryptedCredentials = Object.fromEntries(
                Object.entries(credentials).map(([key, value]) => [key, encrypt(value as string)])
            );
            updateData.credentials = encryptedCredentials;
        }
        
        const [updatedGateway] = await db.update(smsGateways)
            .set(updateData)
            .where(and(eq(smsGateways.id, gatewayId), eq(smsGateways.companyId, companyId)))
            .returning();
            
        if (!updatedGateway) {
            return NextResponse.json({ error: 'Gateway não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }
        
        return NextResponse.json(updatedGateway);

    } catch (error) {
        console.error('Erro ao atualizar gateway de SMS:', error);
        return NextResponse.json({ error: (error as Error).message, details: (error as Error).stack }, { status: 500 });
    }
}


// DELETE /api/v1/sms-gateways/[gatewayId]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ gatewayId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { gatewayId } = await params;

        const result = await db.delete(smsGateways)
            .where(and(eq(smsGateways.id, gatewayId), eq(smsGateways.companyId, companyId)))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Gateway não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }
        
        return new NextResponse(null, { status: 204 });

    } catch (error) {
        console.error('Erro ao excluir gateway de SMS:', error);
        return NextResponse.json({ error: (error as Error).message, details: (error as Error).stack }, { status: 500 });
    }
}
