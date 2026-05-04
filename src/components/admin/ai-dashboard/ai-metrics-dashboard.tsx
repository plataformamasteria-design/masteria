// src/components/admin/ai-dashboard/ai-metrics-dashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { AiStatCards, type KpiData } from './stat-cards';
import { IntentDistributionChart } from './intent-distribution-chart';
import { RecentErrorsTable } from './recent-errors-table';

interface CompanyFilter {
    id: string;
    name: string;
}

interface MetricsData {
    kpis: KpiData;
    topIntents: { agent: string; count: number }[];
    recentErrors: any[];
    filters: {
        companies: CompanyFilter[];
    }
}

export function AiMetricsDashboard() {
    const [data, setData] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [selectedCompany, setSelectedCompany] = useState('all');

    useEffect(() => {
        const fetchMetrics = async () => {
            setLoading(true);
            const params = new URLSearchParams();
            if (dateRange?.from) params.set('startDate', dateRange.from.toISOString());
            if (dateRange?.to) params.set('endDate', dateRange.to.toISOString());
            if (selectedCompany !== 'all') params.set('companyId', selectedCompany);
            
            try {
                const response = await fetch(`/api/v1/admin/ai-metrics?${params.toString()}`);
                if (!response.ok) throw new Error('Falha ao carregar métricas.');
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error("Erro no dashboard:", error);
                setData(null); // Reset data on error
            } finally {
                setLoading(false);
            }
        }
        fetchMetrics();
    }, [dateRange, selectedCompany]);
    
    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                    <div className="w-full md:w-auto">
                        <Label>Período</Label>
                        <DateRangePicker onDateChange={setDateRange} initialDate={dateRange} />
                    </div>
                    <div className="w-full md:w-auto">
                        <Label>Empresa</Label>
                        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Empresas</SelectItem>
                                {data?.filters.companies.map(company => (
                                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                </div>
            ) : !data ? (
                <Card className="text-center py-16 text-muted-foreground">
                    <p>Não foi possível carregar os dados.</p>
                </Card>
            ) : (
                <>
                    <AiStatCards kpis={data.kpis} />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2">
                             <CardHeader>
                                <CardTitle>Intenções Mais Comuns (Agentes)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <IntentDistributionChart intents={data.topIntents} />
                            </CardContent>
                        </Card>
                         <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle>Erros Recentes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RecentErrorsTable errors={data.recentErrors} />
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
