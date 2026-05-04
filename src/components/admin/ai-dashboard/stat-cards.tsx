// src/components/admin/ai-dashboard/stat-cards.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, AlertCircle, Timer, DollarSign } from 'lucide-react';

export interface KpiData {
    requestsPerHour: string;
    errorRate: string;
    dailyCost: string;
    totalRequests: number;
}

interface AiStatCardsProps {
    kpis: KpiData | null;
}

export function AiStatCards({ kpis }: AiStatCardsProps) {
    const stats = [
        { title: 'Reqs / Hora', value: kpis?.requestsPerHour || '0.00', icon: Activity },
        { title: 'Taxa de Erro', value: `${kpis?.errorRate || '0.00'}%`, icon: AlertCircle },
        { title: 'Latência Média (p95)', value: 'N/A', icon: Timer },
        { title: 'Custo no Período', value: `R$ ${(parseFloat(kpis?.dailyCost || '0') * 5.2).toFixed(2)}`, icon: DollarSign },
    ];
    
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map(stat => (
                <Card key={stat.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        <stat.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        {stat.title === 'Custo no Período' && <p className="text-xs text-muted-foreground">Custo total no período selecionado</p>}
                        {stat.title === 'Latência Média (p95)' && <p className="text-xs text-muted-foreground">Não implementado</p>}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
