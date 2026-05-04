
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { smsGateways } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto';

const gatewaySchema = z.object({
    provider: z.enum(['witi', 'seven', 'mkom']),
    name: z.string().min(1, 'Nome da configuração é obrigatório.'),
    credentials: z.record(z.any()),
});



// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const gateways = await db.select({
            id: smsGateways.id,
            provider: smsGateways.provider,
            name: smsGateways.name,
            isActive: smsGateways.isActive,
            createdAt: smsGateways.createdAt,
        }).from(smsGateways).where(eq(smsGateways.companyId, companyId)).orderBy(desc(smsGateways.createdAt));

        return NextResponse.json(gateways);

    } catch (error) {
        console.error('Erro ao buscar gateways de SMS:', error);
        return NextResponse.json({ error: (error as Error).message, details: (error as Error).stack }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = gatewaySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        const { provider, name, credentials } = parsed.data;

        if (provider === 'mkom') {
            const costCentreId = credentials.cost_centre_id;
            if (!costCentreId || String(costCentreId).trim() === '' || String(costCentreId) === '0') {
                return NextResponse.json({ 
                    error: 'Centro de Custo (cost_centre_id) é obrigatório para o gateway MKOM.' 
                }, { status: 400 });
            }
        }

        // Encrypt all credential values
        const encryptedCredentials = Object.fromEntries(
            Object.entries(credentials).map(([key, value]) => [key, encrypt(value as string)])
        );

        const [newGateway] = await db.insert(smsGateways).values({
            companyId,
            provider,
            name,
            credentials: encryptedCredentials,
            isActive: true, // Activate by default
        }).returning();

        return NextResponse.json(newGateway, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar gateway de SMS:', error);
        return NextResponse.json({ error: (error as Error).message, details: (error as Error).stack }, { status: 500 });
    }
}
