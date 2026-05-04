// src/app/api/v1/team/users/[userId]/verify/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { userId: userIdToVerify } = await params;

        const [updatedUser] = await db.update(users)
            .set({ emailVerified: new Date() })
            .where(and(eq(users.id, userIdToVerify), eq(users.companyId, companyId)))
            .returning();
            
        if (!updatedUser) {
            return NextResponse.json({ error: 'Utilizador não encontrado ou não pertence à sua empresa.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: `Utilizador "${updatedUser.name}" marcado como verificado com sucesso.` });

    } catch (error) {
        console.error('Erro ao marcar utilizador como verificado:', error);
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido."
        return NextResponse.json({ error: 'Erro interno do servidor.', details: errorMessage }, { status: 500 });
    }
}
