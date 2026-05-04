// src/app/api/v1/api-keys/[keyId]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

// DELETE /api/v1/api-keys/[keyId] - Revoke (delete) an API key
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ keyId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { keyId } = await params;
        
        const result = await db.delete(apiKeys)
            .where(and(eq(apiKeys.id, keyId), eq(apiKeys.companyId, companyId)))
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ error: 'Chave de API não encontrada ou não pertence à sua empresa.' }, { status: 404 });
        }
        
        return new NextResponse(null, { status: 204 }); // No Content

    } catch (error) {
        console.error('Erro ao revogar chave de API:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
