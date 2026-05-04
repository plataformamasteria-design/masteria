
// src/app/api/v1/admin/ai-metrics/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { aiUsageDaily, companies } from '@/lib/db/schema';
import { getUserSession } from '@/app/actions';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {

        // Segurança: Apenas super admins podem aceder
        const session = await getUserSession();
        if (session.user?.role !== 'superadmin') {
             return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const companyIdFilter = searchParams.get('companyId');
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        const endDate = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(new Date());
        const startDate = startDateParam ? startOfDay(new Date(startDateParam)) : startOfDay(subDays(endDate, 6));
        


        // Cláusulas WHERE reutilizáveis
        // const whereClausesExecutions = [
        //     gte(aiAgentExecutions.createdAt, startDate),
        //     lte(aiAgentExecutions.createdAt, endDate),
        // ];
        // if (companyIdFilter && companyIdFilter !== 'all') {
        //     whereClausesExecutions.push(eq(aiAgentExecutions.companyId, companyIdFilter));
        // }
        
        const whereClausesUsage = [
            gte(aiUsageDaily.date, startDate.toISOString().slice(0, 10)),
            lte(aiUsageDaily.date, endDate.toISOString().slice(0, 10)),
        ];
        if (companyIdFilter && companyIdFilter !== 'all') {
            whereClausesUsage.push(eq(aiUsageDaily.companyId, companyIdFilter));
        }

        // Executar todas as queries em paralelo
        
        // SECURITY NOTE: Esta rota é protegida por verificação de superadmin (linha 17)
        // e faz queries globais intencionalmente para fornecer métricas agregadas do sistema.
        // A query de companies lista todas as empresas para filtro, o que é apropriado para superadmin.

        const [
            // totalRequestsResult,
            // errorCountResult,
            totalCostResult,
            // topIntents,
            // recentErrors,
            companyList
        ] = await Promise.all([
            // db.select({ value: count() }).from(aiAgentExecutions).where(and(...whereClausesExecutions)),
            // db.select({ value: count() }).from(aiAgentExecutions).where(and(...whereClausesExecutions, ne(aiAgentExecutions.toolName, 'CircuitBreaker'), sql`${aiAgentExecutions.response} ILIKE '%erro%'`)),
            db.select({ value: sql<number>`sum(${aiUsageDaily.cost})`}).from(aiUsageDaily).where(and(...whereClausesUsage)),
            // db.select({ agent: aiAgentExecutions.agentName, count: count() }).from(aiAgentExecutions).where(and(...whereClausesExecutions, isNotNull(aiAgentExecutions.agentName))).groupBy(aiAgentExecutions.agentName).orderBy(desc(count())).limit(5),
            // db.select().from(aiAgentExecutions).where(and(...whereClausesExecutions, ne(aiAgentExecutions.toolName, 'CircuitBreaker'), sql`${aiAgentExecutions.response} ILIKE '%erro%'`)).orderBy(desc(aiAgentExecutions.createdAt)).limit(5),
            db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(companies.name),
        ]);

        // const totalRequests = totalRequestsResult[0]?.value ?? 0;
        // const errorCount = errorCountResult[0]?.value ?? 0;
        const totalCost = parseFloat(totalCostResult[0]?.value?.toString() || '0');
        
        // const hours = differenceInHours(endDate, startDate) || 1;
        // const requestsPerHour = totalRequests / hours;
        // const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
        
        const response = {
            kpis: {
                requestsPerHour: '0', // requestsPerHour.toFixed(2),
                errorRate: '0', // errorRate.toFixed(2),
                dailyCost: totalCost.toFixed(2),
                totalRequests: 0, // totalRequests,
            },
            topIntents: [], // topIntents || [],
            recentErrors: [], // recentErrors || [],
            filters: {
                companies: companyList || [],
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error("Erro ao buscar métricas de IA:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
