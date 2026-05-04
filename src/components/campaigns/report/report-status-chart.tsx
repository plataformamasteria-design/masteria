
'use client';

import { Pie, PieChart, Tooltip, Cell } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { Campaign } from '@/lib/types';


export function ReportStatusChart({ campaign }: { campaign: Campaign }) {
    const chartData = [
        { name: 'Lidas', value: campaign.read, color: 'hsl(var(--chart-2))' },
        { name: 'Entregues (não lidas)', value: campaign.delivered - campaign.read, color: 'hsl(var(--chart-1))' },
        { name: 'Falhas', value: campaign.failed, color: 'hsl(var(--destructive))' },
      ].filter(item => item.value > 0);
      
      const chartConfig = {
        read: {
          label: 'Lidas',
          color: 'hsl(var(--chart-2))',
        },
        delivered: {
          label: 'Entregues (não lidas)',
          color: 'hsl(var(--chart-1))',
        },
        failed: {
          label: 'Falhas',
          color: 'hsl(var(--destructive))',
        },
      } satisfies ChartConfig;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>Desempenho da Campanha</CardTitle>
        <CardDescription>
          Distribuição visual do status das mensagens enviadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-full max-h-[300px]"
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
                <Cell key={`cell-${entry.name}`} fill={entry.color} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
