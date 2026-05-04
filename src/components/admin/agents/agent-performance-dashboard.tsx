// src/components/admin/agents/agent-performance-dashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: { status: string; responseTime?: number };
    redis: { status: string; responseTime?: number; memoryUsage?: string };
    agents: {
      status: string;
      successRate: number;
      averageResponseTime: number;
      fallbackUsageRate: number;
    };
    cache: {
      status: string;
      hitRate: number;
      totalHits: number;
      totalMisses: number;
    };
  };
  metrics: {
    realTime: any;
    performance: any;
  };
  alerts: string[];
}

interface AgentMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageResponseTime: number;
  fallbackUsageRate: number;
  cacheHitRate: number;
  averageConfidence: number;
  totalTokenUsage: number;
  totalCost: number;
  errorBreakdown: Record<string, number>;
}

const STATUS_COLORS = {
  healthy: 'text-green-600',
  degraded: 'text-yellow-600',
  unhealthy: 'text-red-600',
  operational: 'text-green-600',
  down: 'text-red-600'
};

const STATUS_ICONS = {
  healthy: CheckCircle,
  degraded: AlertTriangle,
  unhealthy: XCircle,
  operational: CheckCircle,
  down: XCircle
};

export function AgentPerformanceDashboard() {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, _setAutoRefresh] = useState(true);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/agents/health');
      const data = await response.json();
      setHealthData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Erro ao buscar dados de saúde:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 30000); // 30 segundos
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    const IconComponent = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || AlertTriangle;
    return <IconComponent className={`h-5 w-5 ${STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'text-gray-500'}`} />;
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'healthy' || status === 'operational' ? 'default' : 
                   status === 'degraded' ? 'secondary' : 'destructive';
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(value);
  };

  if (loading && !healthData) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!healthData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Não foi possível carregar os dados de performance dos agentes.
        </AlertDescription>
      </Alert>
    );
  }

  const agentMetrics: AgentMetrics = healthData.metrics.realTime?.overall || {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    successRate: 0,
    averageResponseTime: 0,
    fallbackUsageRate: 0,
    cacheHitRate: 0,
    averageConfidence: 0,
    totalTokenUsage: 0,
    totalCost: 0,
    errorBreakdown: {}
  };

  const agentBreakdown = healthData.metrics.realTime?.byAgent || {};
  const errorData = Object.entries(agentMetrics.errorBreakdown).map(([type, count]) => ({
    name: type,
    value: count
  }));

  const agentPerformanceData = Object.entries(agentBreakdown).map(([agent, metrics]: [string, any]) => ({
    name: agent,
    successRate: metrics.successRate || 0,
    responseTime: metrics.averageResponseTime || 0,
    executions: metrics.totalExecutions || 0
  }));

  return (
    <div className="space-y-6">
      {/* Header com Status Geral */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Performance dos Agentes</h1>
          {getStatusBadge(healthData.status)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Última atualização: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealthData}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {healthData.alerts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {healthData.alerts.map((alert, index) => (
                <div key={index}>• {alert}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Status dos Serviços */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banco de Dados</CardTitle>
            {getStatusIcon(healthData.services.database.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getStatusBadge(healthData.services.database.status)}</div>
            {healthData.services.database.responseTime && (
              <p className="text-xs text-muted-foreground">
                Tempo: {formatDuration(healthData.services.database.responseTime)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis</CardTitle>
            {getStatusIcon(healthData.services.redis.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getStatusBadge(healthData.services.redis.status)}</div>
            <div className="text-xs text-muted-foreground space-y-1">
              {healthData.services.redis.responseTime && (
                <p>Tempo: {formatDuration(healthData.services.redis.responseTime)}</p>
              )}
              {healthData.services.redis.memoryUsage && (
                <p>Memória: {healthData.services.redis.memoryUsage}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agentes</CardTitle>
            {getStatusIcon(healthData.services.agents.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthData.services.agents.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Taxa de Sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache</CardTitle>
            {getStatusIcon(healthData.services.cache.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthData.services.cache.hitRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Taxa de Hit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Detalhadas */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="agents">Por Agente</TabsTrigger>
          <TabsTrigger value="errors">Erros</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Execuções</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agentMetrics.totalExecutions.toLocaleString()}</div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Sucesso: {agentMetrics.successfulExecutions}</span>
                  <span>Falha: {agentMetrics.failedExecutions}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(agentMetrics.averageResponseTime)}</div>
                <Progress value={Math.min((agentMetrics.averageResponseTime / 5000) * 100, 100)} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uso de Fallbacks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agentMetrics.fallbackUsageRate.toFixed(1)}%</div>
                <Progress value={agentMetrics.fallbackUsageRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(agentMetrics.totalCost)}</div>
                <p className="text-xs text-muted-foreground">
                  {agentMetrics.totalTokenUsage.toLocaleString()} tokens
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance por Agente</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agentPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="successRate" fill="#8884d8" name="Taxa de Sucesso (%)" />
                  <Bar yAxisId="right" dataKey="responseTime" fill="#82ca9d" name="Tempo Resposta (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Erros</CardTitle>
              </CardHeader>
              <CardContent>
                {errorData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={errorData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {errorData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum erro registrado
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhes dos Erros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {errorData.length > 0 ? (
                    errorData.map((error, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="font-medium">{error.name}</span>
                        <Badge variant="destructive">{error.value}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Nenhum erro para exibir
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Confiança</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Confiança Média</span>
                      <span>{(agentMetrics.averageConfidence * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={agentMetrics.averageConfidence * 100} className="mt-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Taxa de Cache Hit</span>
                      <span>{agentMetrics.cacheHitRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={agentMetrics.cacheHitRate} className="mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estatísticas de Uso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Execuções Totais:</span>
                    <span className="font-medium">{agentMetrics.totalExecutions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tokens Utilizados:</span>
                    <span className="font-medium">{agentMetrics.totalTokenUsage.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Custo Acumulado:</span>
                    <span className="font-medium">{formatCurrency(agentMetrics.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Uso de Fallbacks:</span>
                    <span className="font-medium">{agentMetrics.fallbackUsageRate.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}