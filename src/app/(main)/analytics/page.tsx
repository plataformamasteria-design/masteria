'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DateRange } from 'react-day-picker';
import { TrendingUp, Target, DollarSign, Clock, Send, CheckCircle2, XCircle, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KPICard } from '@/components/analytics/kpi-card';
import { DateRangeSelector } from '@/components/analytics/date-range-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';

// Lazy load heavy Recharts-based components (Recharts is ~200KB)
const TimeSeriesChart = dynamic(
  () => import('@/components/analytics/time-series-chart').then(mod => ({ default: mod.TimeSeriesChart })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-xl" /> }
);
const FunnelChart = dynamic(
  () => import('@/components/analytics/funnel-chart').then(mod => ({ default: mod.FunnelChart })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-xl" /> }
);

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch data');
  return response.json();
};

export default function AnalyticsPage() {
  const getDefaultDateRange = (): DateRange => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return { from: thirtyDaysAgo, to: today };
  };

  const [dateRange, setDateRange] = useState<DateRange | undefined>(getDefaultDateRange());

  const getQueryParams = () => {
    if (!dateRange?.from || !dateRange?.to) return '';
    return `?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`;
  };

  const { data: kpis, error: kpisError, isLoading: kpisLoading } = useSWR(
    dateRange?.from && dateRange?.to ? `/api/v1/analytics/kpis${getQueryParams()}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: timeseries, error: timeseriesError, isLoading: timeseriesLoading } = useSWR(
    dateRange?.from && dateRange?.to ? `/api/v1/analytics/timeseries${getQueryParams()}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: funnelData, error: funnelError, isLoading: funnelLoading } = useSWR(
    `/api/v1/analytics/funnel`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: campaigns, error: campaignsError, isLoading: campaignsLoading } = useSWR(
    dateRange?.from && dateRange?.to ? `/api/v1/analytics/campaigns${getQueryParams()}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Visualize métricas e performance da sua operação
        </p>
      </div>

      <DateRangeSelector value={dateRange} onChange={setDateRange} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total de Conversas"
          value={formatNumber(kpis?.totalConversations || 0)}
          icon={TrendingUp}
          loading={kpisLoading}
        />
        <KPICard
          title="Taxa de Conversão"
          value={`${kpis?.conversionRate?.toFixed(1) || 0}%`}
          icon={Target}
          loading={kpisLoading}
        />
        <KPICard
          title="Receita Total"
          value={formatCurrency(kpis?.totalRevenue || 0)}
          icon={DollarSign}
          loading={kpisLoading}
        />
        <KPICard
          title="Tempo Médio de Resposta"
          value={formatDuration(kpis?.avgResponseTime || 0)}
          icon={Clock}
          loading={kpisLoading}
        />
      </div>

      <TimeSeriesChart
        title="Conversas ao Longo do Tempo"
        data={timeseries || []}
        type="line"
        dataKeys={[
          { key: 'conversations', color: '#3b82f6', name: 'Conversas' },
        ]}
        loading={timeseriesLoading}
        height={300}
      />

      <TimeSeriesChart
        title="Volume de Mensagens"
        data={timeseries || []}
        type="area"
        dataKeys={[
          { key: 'messages', color: '#8b5cf6', name: 'Mensagens' },
        ]}
        loading={timeseriesLoading}
        height={300}
      />

      <TimeSeriesChart
        title="Leads vs Vendas"
        data={timeseries || []}
        type="bar"
        dataKeys={[
          { key: 'leads', color: '#10b981', name: 'Leads' },
          { key: 'sales', color: '#f59e0b', name: 'Vendas' },
        ]}
        loading={timeseriesLoading}
        height={300}
      />

      <FunnelChart
        title="Funil de Conversão"
        data={funnelData || []}
        loading={funnelLoading}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="animate-in fade-in-50 duration-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Campanhas WhatsApp
            </CardTitle>
            <CardDescription>Estatísticas de envio no período</CardDescription>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Enviadas</span>
                  <span className="text-2xl font-bold">{formatNumber(campaigns?.sent || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Entregues</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-lg font-semibold">{formatNumber(campaigns?.delivered || 0)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Falhas</span>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-lg font-semibold">{formatNumber(campaigns?.failed || 0)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Taxa de Entrega</span>
                    <Badge variant={campaigns?.deliveryRate > 90 ? 'default' : 'destructive'}>
                      {campaigns?.deliveryRate?.toFixed(1) || 0}%
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-in fade-in-50 duration-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>Performance de notificações</CardDescription>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Enviadas</span>
                  <span className="text-2xl font-bold">{formatNumber(kpis?.totalMessages || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Campanhas Ativas</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span className="text-lg font-semibold">{formatNumber(kpis?.campaignsActive || 0)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Taxa de Sucesso</span>
                    <Badge variant="default">
                      {((campaigns?.delivered / campaigns?.sent) * 100 || 0).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(kpisError || timeseriesError || funnelError || campaignsError) && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Erro ao carregar alguns dados. Por favor, tente novamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
