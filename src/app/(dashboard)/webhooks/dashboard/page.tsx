'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/contexts/session-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface WebhookEvent {
  id: string;
  source: string;
  event_type: string;
  signature_valid: boolean;
  created_at: string;
  processed_at?: string;
  payload?: any;
}

interface WebhookMetrics {
  stats: Array<{
    total_events: number;
    signed_events: number;
    processed_events: number;
    source: string;
    event_type: string;
  }>;
  recentEvents: WebhookEvent[];
  failedEvents: WebhookEvent[];
}

interface AlertStatus {
  status: string;
  alerts: Array<{
    type: string;
    level: string;
    message: string;
    metrics: any;
  }>;
  metrics: {
    totalEvents: number;
    processedEvents: number;
    failedEvents: number;
    failureRate: number;
    threshold: number;
    timeWindow: string;
  };
}

interface AnalyticsData {
  timeRange: { hours: number; startTime: string; endTime: string };
  hourlyData: Array<{
    hour: string;
    total_events: number;
    success_events: number;
    failed_events: number;
    success_rate: number;
  }>;
  eventTypeStats: Array<{
    event_type: string;
    total: number;
    success: number;
    failed: number;
    success_rate: number;
  }>;
  overallStats: {
    totalEvents: number;
    successEvents: number;
    failedEvents: number;
    signedEvents: number;
    overallSuccessRate: number;
    avgProcessingTimeSeconds: number;
  };
}

export default function WebhookDashboard() {
  const { session } = useSession();
  const [metrics, setMetrics] = useState<WebhookMetrics | null>(null);
  const [alertStatus, setAlertStatus] = useState<AlertStatus | null>(null);
  const [replayEvents, setReplayEvents] = useState<WebhookEvent[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [analyticsHours, _setAnalyticsHours] = useState(24);

  const companyId = session?.empresaId;

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [metricsRes, alertsRes, replayRes, analyticsRes] = await Promise.all([
          fetch(`/api/v1/webhooks/metrics?companyId=${companyId}`),
          fetch(`/api/v1/webhooks/alerts?companyId=${companyId}`),
          fetch(`/api/v1/webhooks/replay?companyId=${companyId}&limit=20`),
          fetch(`/api/v1/webhooks/analytics?companyId=${companyId}&hours=${analyticsHours}`),
        ]);

        const metricsData = await metricsRes.json();
        const alertsData = await alertsRes.json();
        const replayData = await replayRes.json();
        const analyticsData = await analyticsRes.json();

        setMetrics(metricsData);
        setAlertStatus(alertsData);
        setReplayEvents(replayData.events || []);
        setAnalytics(analyticsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, companyId, analyticsHours]);

  const handleRetry = async (eventId: string) => {
    try {
      const res = await fetch('/api/v1/webhooks/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, companyId }),
      });
      if (res.ok) {
        alert('Evento marcado para reprocessamento');
      }
    } catch (error) {
      console.error('Failed to retry:', error);
    }
  };

  const handleReplay = async (eventId: string) => {
    setReplayingId(eventId);
    try {
      const res = await fetch('/api/v1/webhooks/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, companyId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Evento reprocessado com sucesso! Novo ID: ${data.replay?.replayEventId}`);
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to replay:', error);
      alert('Erro ao reprocessar evento');
    } finally {
      setReplayingId(null);
    }
  };

  if (loading) {
    return <div className="p-4">Carregando dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Webhook Dashboard</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'default' : 'outline'}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
        </div>
      </div>

      {alertStatus?.status === 'alert' && (
        <Card className="border-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">Alerta Ativo</CardTitle>
          </CardHeader>
          <CardContent>
            {alertStatus.alerts.map((alert, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Badge variant="destructive">{alert.level.toUpperCase()}</Badge>
                <span>{alert.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="replay">Event Replay</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Eventos (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {metrics?.stats.reduce((sum, s) => sum + parseInt(String(s.total_events)), 0) || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Processados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {metrics?.stats.reduce((sum, s) => sum + parseInt(String(s.processed_events)), 0) || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Assinados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {metrics?.stats.reduce((sum, s) => sum + parseInt(String(s.signed_events)), 0) || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Taxa Falha</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${alertStatus?.metrics?.failureRate && alertStatus.metrics.failureRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {alertStatus?.metrics?.failureRate?.toFixed(1) || 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metrics?.stats.map((stat) => (
              <Card key={`${stat.source}-${stat.event_type}`}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge>{stat.source}</Badge>
                    <span>{stat.event_type}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total:</span>
                    <span className="font-bold">{stat.total_events}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Processados:</span>
                    <span className="font-bold text-green-600">{stat.processed_events}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sucesso Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{analytics?.overallStats?.overallSuccessRate?.toFixed(1) || 0}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Eventos Processados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{analytics?.overallStats?.successEvents || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Eventos Falhados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{analytics?.overallStats?.failedEvents || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tempo Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{analytics?.overallStats?.avgProcessingTimeSeconds?.toFixed(2) || 0}s</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Taxa de Sucesso por Hora</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics?.hourlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" angle={-45} textAnchor="end" height={80} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="success_rate" stroke="#22c55e" name="Taxa Sucesso %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Eventos por Hora</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics?.hourlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="success_events" stackId="a" fill="#22c55e" name="Sucesso" />
                    <Bar dataKey="failed_events" stackId="a" fill="#ef4444" name="Falha" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Taxa de Sucesso por Tipo de Evento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics?.eventTypeStats?.map((stat) => (
                  <div key={stat.event_type} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{stat.event_type}</p>
                      <p className="text-sm text-gray-500">Total: {stat.total} | Sucesso: {stat.success} | Falha: {stat.failed}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${stat.success_rate >= 90 ? 'text-green-600' : stat.success_rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {stat.success_rate?.toFixed(1) || 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eventos Recentes</CardTitle>
              <CardDescription>Ultimos 20 eventos na ultima hora</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics?.recentEvents.map((event) => (
                  <div key={event.id} className="flex justify-between items-center p-3 border rounded">
                    <div className="flex-1">
                      <div className="flex gap-2 items-center">
                        <Badge variant="outline">{event.source}</Badge>
                        <Badge>{event.event_type}</Badge>
                        {event.signature_valid && <Badge className="bg-green-100 text-green-800">Assinado</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{event.id}</p>
                      <p className="text-xs text-gray-400">{event.created_at}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{event.processed_at ? 'Processado' : 'Aguardando'}</span>
                      <Button size="sm" variant="outline" onClick={() => handleReplay(event.id)}>
                        Replay
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {metrics?.failedEvents && metrics.failedEvents.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Eventos Falhados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.failedEvents.map((event) => (
                    <div key={event.id} className="flex justify-between items-center p-3 border rounded bg-red-50">
                      <div>
                        <div className="flex gap-2">
                          <Badge variant="destructive">{event.source}</Badge>
                          <Badge>{event.event_type}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{event.created_at}</p>
                      </div>
                      <Button size="sm" onClick={() => handleRetry(event.id)}>
                        Reprocessar
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="replay" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Replay</CardTitle>
              <CardDescription>Reprocessar eventos historicos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {replayEvents.map((event) => (
                  <div key={event.id} className="flex justify-between items-center p-3 border rounded">
                    <div className="flex-1">
                      <div className="flex gap-2 items-center">
                        <Badge variant="outline">{event.source}</Badge>
                        <Badge>{event.event_type}</Badge>
                        {event.payload?._replay?.isReplay && (
                          <Badge className="bg-purple-100 text-purple-800">REPLAY</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{event.id}</p>
                      <p className="text-xs text-gray-400">{event.created_at}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleReplay(event.id)}
                      disabled={replayingId === event.id}
                    >
                      {replayingId === event.id ? 'Replaying...' : 'Replay Event'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status de Alertas</CardTitle>
              <CardDescription>Monitoramento de taxa de falha</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`p-4 rounded-lg ${alertStatus?.status === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{alertStatus?.status === 'healthy' ? 'Sistema Saudavel' : 'Alerta Ativo'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Eventos</p>
                  <p className="text-xl font-bold">{alertStatus?.metrics?.totalEvents || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Eventos Falhados</p>
                  <p className="text-xl font-bold text-red-600">{alertStatus?.metrics?.failedEvents || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Taxa de Falha</p>
                  <p className="text-xl font-bold">{alertStatus?.metrics?.failureRate?.toFixed(2) || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Threshold</p>
                  <p className="text-xl font-bold">{alertStatus?.metrics?.threshold || 5}%</p>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                Janela de tempo: {alertStatus?.metrics?.timeWindow || '15 minutes'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
