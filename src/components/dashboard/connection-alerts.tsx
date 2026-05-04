'use client';

import { useState, useEffect, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';

interface ConnectionHealth {
  id: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
  status: 'healthy' | 'expired' | 'error' | 'inactive';
  lastChecked: Date;
  errorMessage?: string;
}

interface HealthSummary {
  total: number;
  healthy: number;
  expired: number;
  error: number;
  inactive: number;
}

interface HealthResponse {
  summary: HealthSummary;
  connections: ConnectionHealth[];
}

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Saudável'
  },
  expired: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Token Expirado'
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Erro'
  },
  inactive: {
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-border',
    label: 'Inativa'
  }
};

export function ConnectionAlerts() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/connections/health');

      if (!response.ok) {
        throw new Error('Falha ao verificar status das conexões');
      }

      const data: HealthResponse = await response.json();
      setHealthData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao buscar dados de saúde das conexões:', error);
      notify.error('Erro', 'Não foi possível verificar o status das conexões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();

    // 5 minutes - health API uses per-connection cache, Baileys check is in-memory (no Meta API quota impact)
    const interval = setInterval(fetchHealthData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !healthData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Verificando Conexões...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!healthData) {
    return null;
  }

  const problemConnections = healthData.connections.filter(
    conn => conn.status === 'expired' || conn.status === 'error'
  );

  const hasProblems = problemConnections.length > 0;

  return (
    <div className="space-y-4">
      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {hasProblems ? (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                Status das Conexões
              </CardTitle>
              <CardDescription>
                {lastUpdate && (
                  `Última verificação: ${lastUpdate.toLocaleTimeString()}`
                )}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealthData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {healthData.summary.healthy}
              </div>
              <div className="text-sm text-muted-foreground">Saudáveis</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {healthData.summary.expired}
              </div>
              <div className="text-sm text-muted-foreground">Expiradas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {healthData.summary.error}
              </div>
              <div className="text-sm text-muted-foreground">Com Erro</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                {healthData.summary.inactive}
              </div>
              <div className="text-sm text-muted-foreground">Inativas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de Problemas */}
      {hasProblems && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção: Conexões com Problemas Detectadas</AlertTitle>
          <AlertDescription>
            {problemConnections.length} conexão(ões) precisam de atenção.
            Verifique os detalhes abaixo e atualize os tokens de acesso conforme necessário.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de Conexões com Problemas */}
      {problemConnections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conexões que Precisam de Atenção</CardTitle>
            <CardDescription>
              Estas conexões têm problemas que podem afetar o envio de mensagens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {problemConnections.map((connection) => {
                const config = statusConfig[connection.status];
                const Icon = config.icon;

                return (
                  <div
                    key={connection.id}
                    className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                        <div>
                          <div className="font-medium">{connection.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {connection.phoneNumber}
                          </div>
                          {connection.errorMessage && (
                            <div className="text-sm text-red-600 mt-1">
                              {connection.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className={config.color}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}