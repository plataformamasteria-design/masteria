
// src/components/campaigns/report/report-stats-cards.tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Send, CheckCircle, Target, AlertCircle } from 'lucide-react';
import type { Campaign } from '@/lib/types';

export function ReportStatsCards({ campaign }: { campaign: Campaign }): JSX.Element {

  const sentCount = campaign.sent || 0;
  const deliveredCount = campaign.delivered || 0;
  const readCount = campaign.read || 0;
  const failedCount = campaign.failed || 0;

  const deliveryRate = sentCount > 0 ? (deliveredCount / sentCount) * 100 : 0;
  const readRate = deliveredCount > 0 ? (readCount / deliveredCount) * 100 : 0;
  const failureRate = sentCount > 0 ? (failedCount / sentCount) * 100 : 0;

  const stats = [
    {
      title: 'Total Enviado',
      value: sentCount,
      icon: Send,
      description: 'Total de mensagens enviadas para a Meta.',
    },
    {
      title: 'Taxa de Entrega',
      value: `${deliveryRate.toFixed(1)}%`,
      icon: CheckCircle,
      description: `${deliveredCount.toLocaleString('pt-BR')} mensagens entregues.`,
    },
    {
      title: 'Taxa de Leitura',
      value: `${readRate.toFixed(1)}%`,
      icon: Target,
      description: `${readCount.toLocaleString('pt-BR')} mensagens lidas.`,
    },
    {
      title: 'Taxa de Falha',
      value: `${failureRate.toFixed(1)}%`,
      icon: AlertCircle,
      description: `${failedCount.toLocaleString('pt-BR')} falhas no envio.`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typeof stat.value === 'number' ? stat.value.toLocaleString('pt-BR') : stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
