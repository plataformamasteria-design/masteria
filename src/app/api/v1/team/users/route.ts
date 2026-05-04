import { NextResponse, type NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        
        const teamUsers = await db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                emailVerified: users.emailVerified,
            })
            .from(users)
            .where(eq(users.companyId, companyId))
            .orderBy(desc(users.createdAt));
            
        return NextResponse.json(teamUsers);

    } catch (error) {
        console.error('Erro ao buscar utilizadores da equipa:', error);
        if (error instanceof Error && error.message.includes('Não autorizado')) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
    }
}
