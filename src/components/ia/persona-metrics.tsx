'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  Activity,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PersonaMetricsProps {
  personaId: string;
}

interface MetricsData {
  persona: {
    id: string;
    name: string;
    model: string;
    provider: string;
  };
  metrics: {
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    recentMessages7Days: number;
    successRate: number;
    successCount: number;
    errorCount: number;
    totalAttempts: number;
  };
  dailyActivity: Array<{ date: string; count: number }>;
  recentActivity: Array<{
    id: string;
    level: string;
    message: string;
    createdAt: string;
  }>;
}

export function PersonaMetrics({ personaId }: PersonaMetricsProps) {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/v1/ia/personas/${personaId}/metrics`);
        
        if (!response.ok) {
          throw new Error('Falha ao carregar métricas do agente.');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Erro ao buscar métricas:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (personaId) {
      fetchMetrics();
    }
  }, [personaId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12 text-muted-foreground">
          <p>Não foi possível carregar as métricas do agente.</p>
        </CardContent>
      </Card>
    );
  }

  const { metrics, dailyActivity, recentActivity } = data;

  const chartData = dailyActivity.map((item) => ({
    date: format(new Date(item.date), 'dd/MM', { locale: ptBR }),
    messages: item.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.recentMessages7Days} nos últimos 7 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.successCount} sucesso / {metrics.errorCount} erros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeConversations}</div>
            <p className="text-xs text-muted-foreground">
              de {metrics.totalConversations} conversas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tentativas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAttempts}</div>
            <p className="text-xs text-muted-foreground">
              Últimos 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Atividade nos Últimos 7 Dias</CardTitle>
            <CardDescription>
              Número de mensagens enviadas pela IA por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="messages"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <p>Nenhuma atividade nos últimos 7 dias</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Últimas 10 execuções do agente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm border-b pb-2 last:border-0"
                  >
                    <div className="mt-0.5">
                      {activity.level === 'INFO' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : activity.level === 'ERROR' ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Activity className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-sm">{activity.message}</p>
                      <Badge
                        variant={activity.level === 'INFO' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {activity.level}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                  <p>Nenhuma atividade registrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
