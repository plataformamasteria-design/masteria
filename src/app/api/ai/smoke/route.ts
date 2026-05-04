// src/app/api/ai/smoke/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { runSmokeTests } from '@/ai/orchestrator';

export const dynamic = 'force-dynamic';

async function handler(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Endpoint de teste não disponível em produção.' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const dryRun = searchParams.get('dryRun') !== 'false';
        const companyId = searchParams.get('companyId') || 'smoke-tests';

        const results = await runSmokeTests({ debug: true, dryRun, companyId });
        return NextResponse.json(results, { status: results.ok ? 200 : 500 });
        
    } catch (error) {
        console.error("[Smoke Test API] Erro crítico durante os testes:", error);
        return NextResponse.json(
            { 
                ok: false,
                error: "Um erro crítico ocorreu durante a execução dos testes.",
                details: (error as Error).message 
            }, 
            { status: 500 }
        );
    }
}

// Aceita tanto GET quanto POST para o smoke test.
export { handler as GET, handler as POST };
