import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

// GET /api/v1/company/credentials?service=...
export async function GET(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { searchParams } = new URL(request.url);
        const service = searchParams.get('service');

        if (service) {
            return NextResponse.json({ error: 'Serviço não suportado.' }, { status: 400 });
        }

        const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

        if (!company) {
             return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
        }
        
        return NextResponse.json({ company });
    } catch (error) {
        console.error('Erro ao buscar credenciais da empresa:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
