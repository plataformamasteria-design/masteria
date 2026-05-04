
'use client';

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { DateRange } from 'react-day-picker';


const chartConfig = {
  iniciados: {
    label: 'Iniciados',
    color: 'hsl(var(--chart-1))',
  },
  resolvidos: {
    label: 'Resolvidos',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

interface AttendanceTrendChartProps {
    dateRange?: DateRange;
}

export function AttendanceTrendChart({ dateRange }: AttendanceTrendChartProps): JSX.Element {
  const [chartData, setChartData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('type', 'attendance');
        if (dateRange?.from) params.set('startDate', dateRange.from.toISOString());
        if (dateRange?.to) params.set('endDate', dateRange.to.toISOString());

        const res = await fetch(`/api/v1/dashboard/charts?${params.toString()}`);
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falha ao carregar dados do gráfico.');
        }
        const data = await res.json();
        setChartData(data);
      } catch (error) {
        notify.error('Erro no Gráfico', (error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [dateRange, notify]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-64">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
          />
          <YAxis />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            content={<ChartTooltipContent />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line type="monotone" dataKey="iniciados" stroke="var(--color-iniciados)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="resolvidos" stroke="var(--color-resolvidos)" strokeWidth={2} dot={false} />
        </LineChart>
    </ChartContainer>
  );
}
