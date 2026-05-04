'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, CheckCircle, Target, AlertCircle, TrendingUp } from 'lucide-react';
import type { Campaign } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface DashboardMetrics {
  totalCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  avgDeliveryRate: number;
  avgReadRate: number;
  activeCampaigns: number;
}

export function CampaignsDashboard(): JSX.Element {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalCampaigns: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalFailed: 0,
    avgDeliveryRate: 0,
    avgReadRate: 0,
    activeCampaigns: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast: _toast } = useToast();

  // Buscar campanhas e calcular métricas
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/campaigns?limit=100');
      if (!res.ok) throw new Error('Erro ao buscar campanhas');

      const campaigns: Campaign[] = await res.json();

      // Calcular métricas agregadas
      const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
      const totalDelivered = campaigns.reduce((sum, c) => sum + (c.delivered || 0), 0);
      const totalRead = campaigns.reduce((sum, c) => sum + (c.read || 0), 0);
      const totalFailed = campaigns.reduce((sum, c) => sum + (c.failed || 0), 0);

      const deliveryRates = campaigns
        .filter(c => (c.sent || 0) > 0)
        .map(c => (((c.delivered || 0) / (c.sent || 1)) * 100));

      const readRates = campaigns
        .filter(c => (c.delivered || 0) > 0)
        .map(c => (((c.read || 0) / (c.delivered || 1)) * 100));

      const avgDeliveryRate = deliveryRates.length > 0
        ? deliveryRates.reduce((a, b) => a + b, 0) / deliveryRates.length
        : 0;

      const avgReadRate = readRates.length > 0
        ? readRates.reduce((a, b) => a + b, 0) / readRates.length
        : 0;

      const activeCampaigns = campaigns.filter(c => c.status === 'SENDING' || c.status === 'SCHEDULED').length;

      setMetrics({
        totalCampaigns: campaigns.length,
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        avgDeliveryRate,
        avgReadRate,
        activeCampaigns,
      });
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Atualizar métricas a cada 5 segundos (polling leve para agregação)
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      title: 'Total de Campanhas',
      value: metrics.totalCampaigns,
      icon: TrendingUp,
      color: 'text-blue-500',
    },
    {
      title: 'Total Enviado',
      value: metrics.totalSent.toLocaleString('pt-BR'),
      icon: Send,
      color: 'text-green-500',
    },
    {
      title: 'Taxa de Entrega Média',
      value: `${metrics.avgDeliveryRate.toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-emerald-500',
    },
    {
      title: 'Taxa de Leitura Média',
      value: `${metrics.avgReadRate.toFixed(1)}%`,
      icon: Target,
      color: 'text-purple-500',
    },
    {
      title: 'Campanhas Ativas',
      value: metrics.activeCampaigns,
      icon: TrendingUp,
      color: 'text-orange-500',
    },
    {
      title: 'Taxa de Falha Média',
      value: `${((metrics.totalFailed / Math.max(metrics.totalSent, 1)) * 100).toFixed(1)}%`,
      icon: AlertCircle,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Campanhas</h2>
        <p className="text-muted-foreground mt-2">Métricas consolidadas em tempo real</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Carregando métricas...</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resumo de entrega */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Enviado</p>
              <p className="text-2xl font-bold text-blue-600">{metrics.totalSent.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entregue</p>
              <p className="text-2xl font-bold text-green-600">{metrics.totalDelivered.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Lido</p>
              <p className="text-2xl font-bold text-purple-600">{metrics.totalRead.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Falhado</p>
              <p className="text-2xl font-bold text-red-600">{metrics.totalFailed.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
