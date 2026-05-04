// src/app/api/v1/api-keys/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { getCompanyIdFromSession } from '@/app/actions';

const apiKeySchema = z.object({
    name: z.string().min(1, 'Nome da chave é obrigatório'),
});

// GET /api/v1/api-keys - List API keys

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const companyApiKeys = await db
            .select({
                id: apiKeys.id,
                name: apiKeys.name,
                key: apiKeys.key, 
                createdAt: apiKeys.createdAt,
            })
            .from(apiKeys)
            .where(eq(apiKeys.companyId, companyId))
            .orderBy(desc(apiKeys.createdAt));
        
        const safeKeys = companyApiKeys.map(k => ({...k, key: `${k.key.substring(0, 8)}...`}));

        return NextResponse.json(safeKeys);
    } catch (error) {
        console.error('Erro ao buscar chaves de API:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// POST /api/v1/api-keys - Create a new API key
export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsedData = apiKeySchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { name } = parsedData.data;

        const rawKey = `zap_sk_${randomBytes(24).toString('hex')}`;
        
        const [newKey] = await db.insert(apiKeys).values({
            companyId,
            name,
            key: rawKey,
        }).returning();

        return NextResponse.json({ ...newKey, key: rawKey }, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar chave de API:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
