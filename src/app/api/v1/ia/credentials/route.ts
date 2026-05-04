// src/app/api/v1/ai-credentials/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { aiCredentials } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';

const credentialSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  provider: z.enum(['OPENROUTER', 'GEMINI']),
  apiKey: z.string().min(1, 'A chave de API é obrigatória.'),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const credentials = await db
            .select({
                id: aiCredentials.id,
                name: aiCredentials.name,
                provider: aiCredentials.provider,
                apiKey: aiCredentials.apiKey, // Será mascarada no frontend
                createdAt: aiCredentials.createdAt,
            })
            .from(aiCredentials)
            .where(eq(aiCredentials.companyId, companyId))
            .orderBy(desc(aiCredentials.createdAt));

        return NextResponse.json(credentials);
    } catch (error) {
        console.error('Erro ao buscar credenciais de IA:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = credentialSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        
        const { name, provider, apiKey } = parsed.data;

        // Salva a chave em texto plano (sem encriptação)
        const [newCredential] = await db.insert(aiCredentials).values({
            companyId,
            name,
            provider,
            apiKey: encrypt(apiKey),
        }).returning();

        return NextResponse.json(newCredential, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar credencial de IA:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
