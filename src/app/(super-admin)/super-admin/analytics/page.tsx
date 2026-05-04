'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Mail, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/v1/admin/analytics');
        if (!response.ok) throw new Error('Falha ao carregar analytics');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const metrics = [
    { title: 'Total de Usuários', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-600' },
    { title: 'Total de Empresas', value: stats?.totalCompanies || 0, icon: MessageSquare, color: 'text-green-600' },
    { title: 'Emails Enviados', value: stats?.emailsSent || 0, icon: Mail, color: 'text-orange-600' },
    { title: 'Taxa de Crescimento', value: '12.5%', icon: TrendingUp, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics Dashboard" description="Métricas e análises do sistema" />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metric.color}`}>
                {loading ? '—' : metric.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gráfico de Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground rounded-lg bg-gray-50">
            <p>Gráfico de tendências será exibido aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
