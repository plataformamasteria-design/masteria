import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Send, CheckCircle, Target, AlertCircle } from 'lucide-react';
import type { Campaign } from '@/lib/types';

export function ReportStatsCards({ campaign }: { campaign: Campaign }) {

  const deliveryRate = campaign.sent > 0 ? (campaign.delivered / campaign.sent) * 100 : 0;
  const readRate = campaign.delivered > 0 ? (campaign.read / campaign.delivered) * 100 : 0;
  const failureRate = campaign.sent > 0 ? (campaign.failed / campaign.sent) * 100 : 0;

  const stats = [
    {
      title: 'Total Enviado',
      value: campaign.sent,
      icon: Send,
      description: 'Total de mensagens na fila de envio.',
    },
    {
      title: 'Taxa de Entrega',
      value: `${deliveryRate.toFixed(1)}%`,
      icon: CheckCircle,
      description: `${campaign.delivered.toLocaleString('pt-BR')} mensagens entregues.`,
    },
    {
      title: 'Taxa de Leitura',
      value: `${readRate.toFixed(1)}%`,
      icon: Target,
      description: `${campaign.read.toLocaleString('pt-BR')} mensagens lidas.`,
    },
    {
      title: 'Taxa de Falha',
      value: `${failureRate.toFixed(1)}%`,
      icon: AlertCircle,
      description: `${campaign.failed.toLocaleString('pt-BR')} falhas no envio.`,
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
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
