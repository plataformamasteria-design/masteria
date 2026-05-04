'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Phone, PhoneOff, Activity } from 'lucide-react';
import { VoiceAgent, VoiceAnalytics } from '@/hooks/useVoiceAgents';
import { Skeleton } from '@/components/ui/skeleton';

interface VoiceAgentKPIsProps {
  agents: VoiceAgent[];
  analytics: VoiceAnalytics | null;
  loading: boolean;
}

export function VoiceAgentKPIs({ agents, analytics, loading }: VoiceAgentKPIsProps) {
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const totalAgents = agents.length;
  const inboundAgents = agents.filter(a => a.type === 'inbound').length;
  const outboundAgents = agents.filter(a => a.type === 'outbound').length;

  const kpis = [
    {
      title: 'Agentes Ativos',
      value: loading ? null : activeAgents,
      subtitle: `de ${totalAgents} total`,
      icon: Bot,
      color: 'text-green-500',
    },
    {
      title: 'Total de Chamadas',
      value: loading ? null : analytics?.totalCalls ?? 0,
      subtitle: analytics?.callsByStatus?.ended ? `${analytics.callsByStatus.ended} finalizadas` : 'Nenhuma finalizada',
      icon: Phone,
      color: 'text-blue-500',
    },
    {
      title: 'Agentes Receptivos',
      value: loading ? null : inboundAgents,
      subtitle: 'Recebem ligações',
      icon: PhoneOff,
      color: 'text-purple-500',
    },
    {
      title: 'Agentes Ativos',
      value: loading ? null : outboundAgents,
      subtitle: 'Fazem ligações',
      icon: Activity,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{kpi.value}</div>
            )}
            <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
