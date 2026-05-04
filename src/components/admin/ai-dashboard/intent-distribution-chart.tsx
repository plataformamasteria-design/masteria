// src/components/admin/ai-dashboard/intent-distribution-chart.tsx
'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface IntentDistributionChartProps {
  intents: { agent: string; count: number }[];
}

const chartConfig = {
  count: {
    label: 'Requisições',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function IntentDistributionChart({ intents }: IntentDistributionChartProps) {
    if (!intents || intents.length === 0) {
        return <p className="text-center text-muted-foreground py-10">Nenhum dado de intenção para exibir.</p>;
    }

  return (
    <ChartContainer config={chartConfig} className="w-full h-80">
        <BarChart data={intents} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid horizontal={false} />
            <YAxis 
                dataKey="agent" 
                type="category" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10} 
                width={120}
            />
            <XAxis dataKey="count" type="number" hide />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
        </BarChart>
    </ChartContainer>
  );
}
