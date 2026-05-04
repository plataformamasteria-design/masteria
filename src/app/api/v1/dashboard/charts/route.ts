// src/app/api/v1/dashboard/charts/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCompanyIdFromSession } from '@/app/actions';
import { and, eq, gte, lte } from 'drizzle-orm';
import { conversations } from '@/lib/db/schema';
import { subDays, format, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        
        const { searchParams } = new URL(request.url);
        const chartType = searchParams.get('type');
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        // Define o período padrão para os últimos 7 dias se não for fornecido
        const endDate = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(new Date());
        const startDate = startDateParam ? startOfDay(new Date(startDateParam)) : startOfDay(subDays(endDate, 6));

        if (chartType === 'attendance') {
            const relevantConversations = await db
                .select({
                    createdAt: conversations.createdAt,
                    updatedAt: conversations.updatedAt,
                    status: conversations.status,
                })
                .from(conversations)
                .where(and(
                    eq(conversations.companyId, companyId),
                    gte(conversations.createdAt, startDate),
                    lte(conversations.createdAt, endDate) 
                ));

            // Garante que todos os dias no intervalo existam no mapa
            const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
            const dailyData: Record<string, { iniciados: number; resolvidos: number }> = {};
            dateInterval.forEach(day => {
                const dateKey = format(day, 'dd/MM');
                dailyData[dateKey] = { iniciados: 0, resolvidos: 0 };
            });

            for (const convo of relevantConversations) {
                const createdDateStr = format(new Date(convo.createdAt), 'dd/MM');
                if (dailyData[createdDateStr]) {
                    dailyData[createdDateStr].iniciados++;
                }

                if (convo.status === 'RESOLVED' && convo.updatedAt) {
                    const resolvedDate = new Date(convo.updatedAt);
                    if (resolvedDate >= startDate && resolvedDate <= endDate) {
                       const resolvedDateStr = format(resolvedDate, 'dd/MM');
                        if (dailyData[resolvedDateStr]) {
                            dailyData[resolvedDateStr].resolvidos++;
                        }
                    }
                }
            }
            
            const chartData = Object.entries(dailyData)
                .map(([date, values]) => ({ date, ...values }))
                .sort((a,b) => {
                    const [dayA, monthA] = a.date.split('/');
                    const [dayB, monthB] = b.date.split('/');
                    return new Date(2000, Number(monthA) - 1, Number(dayA)).getTime() - new Date(2000, Number(monthB) - 1, Number(dayB)).getTime();
                });

            return NextResponse.json(chartData);
        }

        return NextResponse.json({ error: 'Tipo de gráfico inválido.' }, { status: 400 });

    } catch (error) {
        console.error("Erro ao buscar dados dos gráficos do dashboard:", error);
        return NextResponse.json({ error: (error as Error).message, details: (error as Error).stack }, { status: 500 });
    }
}
