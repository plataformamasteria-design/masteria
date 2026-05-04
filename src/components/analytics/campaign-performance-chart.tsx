
'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { Campaign } from '@/lib/types';


const chartConfig = {
  enviadas: {
    label: 'Enviadas',
    color: 'hsl(var(--chart-1))',
  },
  lidas: {
    label: 'Lidas',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export function CampaignPerformanceChart(): JSX.Element {
  const [chartData, setChartData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      setLoading(true);
      try {
        const response = await fetch('/api/v1/campaigns');
        if (!response.ok) throw new Error('Falha ao buscar dados das campanhas.');
        
        const result = await response.json();
        const data: Campaign[] = result.data || [];
        
        const formattedData = data
            .filter(c => c.status === 'COMPLETED')
            .slice(0, 7) // Pega as últimas 7 campanhas completas
            .map((c) => ({
                name: c.name,
                enviadas: c.sent,
                lidas: c.read,
            }));

        setChartData(formattedData);
      } catch (error) {
        notify.error('Erro', (error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [notify]);


  if (loading) {
    return <Skeleton className="h-64 w-full" />
  }


  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => (typeof value === 'string' ? value.slice(0, 15) + (value.length > 15 ? '...' : '') : value)}
          />
          <YAxis />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            content={<ChartTooltipContent />}
          />
          <Legend />
          <Bar dataKey="enviadas" fill="var(--color-enviadas)" radius={4} />
          <Bar dataKey="lidas" fill="var(--color-lidas)" radius={4} />
        </BarChart>
    </ChartContainer>
  );
}
