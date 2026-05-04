'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Bot,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface AIMetricsData {
  summary: {
    totalPersonas: number;
    totalAIMessages: number;
    recentAIMessages7Days: number;
    activeAIConversations: number;
    successRate: number;
    successCount: number;
    errorCount: number;
    totalAttempts: number;
  };
  dailyActivity: Array<{ date: string; count: number }>;
  topPersonas: Array<{
    personaId: string;
    personaName: string;
    model: string;
    messageCount: number;
  }>;
}

export function AIPerformanceSection() {
  const [data, setData] = useState<AIMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const _notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetchMetrics = async () => {
    const controller = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/v1/ia/metrics', { 
        signal: controller.signal 
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao carregar métricas de IA.');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const errorMessage = err.message || 'Erro ao buscar métricas de IA.';
        setError(errorMessage);
        console.error('Erro ao buscar métricas de IA:', err);
      }
    } finally {
      setLoading(false);
    }
    
    return () => controller.abort();
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Erro ao Carregar Métricas de IA</h3>
            <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          </div>
          <Button onClick={() => fetchMetrics()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { summary, dailyActivity, topPersonas } = data;

  const chartData = dailyActivity.map((item) => ({
    date: format(new Date(item.date), 'dd/MM', { locale: ptBR }),
    messages: item.count,
  }));

  // Se não há dados de IA, não mostra a seção
  if (summary.totalPersonas === 0 && summary.totalAIMessages === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold tracking-tight">Agentes de IA</h3>
        <Link href="/agentes-ia">
          <Button variant="outline" size="sm">
            Ver Todos os Agentes
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agentes Ativos</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalPersonas}</div>
            <p className="text-xs text-muted-foreground">
              Total de agentes criados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens da IA</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAIMessages}</div>
            <p className="text-xs text-muted-foreground">
              {summary.recentAIMessages7Days} nos últimos 7 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {summary.successCount} sucesso / {summary.errorCount} erros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas com IA</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeAIConversations}</div>
            <p className="text-xs text-muted-foreground">
              Atualmente ativas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Atividade da IA nos Últimos 7 Dias</CardTitle>
            <CardDescription>
              Total de mensagens enviadas pelos agentes de IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
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
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                <p>Nenhuma atividade nos últimos 7 dias</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Agentes por Performance</CardTitle>
            <CardDescription>
              Agentes com maior número de mensagens enviadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPersonas.length > 0 ? (
                topPersonas.map((persona, index) => (
                  <Link
                    key={persona.personaId}
                    href={`/agentes-ia/${persona.personaId}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{persona.personaName}</p>
                        <p className="text-xs text-muted-foreground">
                          {persona.model}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-auto">
                      {persona.messageCount} msgs
                    </Badge>
                  </Link>
                ))
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  <p>Nenhum agente com atividade ainda</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
