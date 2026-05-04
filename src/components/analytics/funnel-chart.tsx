'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FunnelStage {
  stageId: string;
  stageName: string;
  count: number;
  value: number;
  conversionRate: number;
}

interface FunnelChartProps {
  title: string;
  data: FunnelStage[];
  loading?: boolean;
}

export function FunnelChart({ title, data, loading = false }: FunnelChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado disponível para o período selecionado
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((stage) => stage.count));
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

  const getStageColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-rose-500',
    ];
    return colors[index % colors.length];
  };

  return (
    <Card className="animate-in fade-in-50 duration-500">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((stage, index) => {
            const widthPercentage = (stage.count / maxCount) * 100;

            return (
              <div
                key={stage.stageId}
                className="group relative transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{stage.stageName}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(stage.count)} leads
                      </span>
                    </div>
                    <div className="relative h-10 overflow-hidden rounded-lg bg-muted">
                      <div
                        className={cn(
                          'h-full transition-all duration-500 ease-out',
                          getStageColor(index)
                        )}
                        style={{
                          width: `${widthPercentage}%`,
                          minWidth: '20%',
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-3">
                        <span className="text-xs font-medium text-white drop-shadow-md">
                          {stage.conversionRate.toFixed(1)}%
                        </span>
                        <span className="text-xs font-medium text-white drop-shadow-md">
                          {formatCurrency(stage.value)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {index < data.length - 1 && (
                  <div className="ml-4 mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-4 w-px bg-border" />
                    <span>
                      {((data[index + 1]?.count || 0 / stage.count) * 100 || 0).toFixed(1)}%
                      conversão para próxima etapa
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
