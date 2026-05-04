
// src/components/analytics/message-status-chart.tsx
'use client';

import { Pie, PieChart, Tooltip, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '../ui/skeleton';
import type { Campaign } from '@/lib/types';


const chartConfig = {
  delivered: {
    label: 'Entregues (não lidas)',
    color: 'hsl(var(--chart-1))',
  },
  read: {
    label: 'Lidas',
    color: 'hsl(var(--chart-2))',
  },
  failed: {
    label: 'Falhas',
    color: 'hsl(var(--destructive))',
  },
} satisfies ChartConfig;

export function MessageStatusChart(): JSX.Element {
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
        
        // CORREÇÃO: A API retorna um objeto de paginação. Os dados estão em 'result.data'.
        const result = await response.json();
        const data: Campaign[] = result.data?.data ?? result.data ?? [];
        
        const totalDelivered = data.reduce((acc, c) => acc + (c.delivered || 0), 0);
        const totalRead = data.reduce((acc, c) => acc + (c.read || 0), 0);
        const totalFailed = data.reduce((acc, c) => acc + (c.failed || 0), 0);
        
        const formattedData = [
          { name: 'Entregues (não lidas)', value: totalDelivered - totalRead, color: 'hsl(var(--chart-1))' },
          { name: 'Lidas', value: totalRead, color: 'hsl(var(--chart-2))' },
          { name: 'Falhas', value: totalFailed, color: 'hsl(var(--destructive))' },
        ].filter(item => item.value > 0);
        
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
    return <Skeleton className="h-[250px] w-full" />
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[250px]"
    >
        <PieChart>
          <Tooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            strokeWidth={5}
          >
            {chartData.map((entry) => (
              <Cell key={`cell-${(entry as {name: string}).name}`} fill={(entry as {color: string}).color} />
            ))}
          </Pie>
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
          />
        </PieChart>
    </ChartContainer>
  );
}
