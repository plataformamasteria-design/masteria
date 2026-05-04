'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Send,
  CheckCircle,
  Eye,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaileysReportModalProps {
  campaignId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReportMetrics {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
}

interface CampaignData {
  id: string;
  name: string;
  status: string;
  message: string | null;
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
}

interface ContactReport {
  id: string;
  contactId: string;
  name: string;
  phone: string;
  status: string;
  sentAt: string;
  updatedAt: string;
  failureReason: string | null;
  messageId: string | null;
}

interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  sent: { label: 'Enviada', color: 'bg-blue-500', icon: Send },
  SENT: { label: 'Enviada', color: 'bg-blue-500', icon: Send },
  delivered: { label: 'Entregue', color: 'bg-green-500', icon: CheckCircle },
  DELIVERED: { label: 'Entregue', color: 'bg-green-500', icon: CheckCircle },
  read: { label: 'Lida', color: 'bg-purple-500', icon: Eye },
  READ: { label: 'Lida', color: 'bg-purple-500', icon: Eye },
  played: { label: 'Reproduzida', color: 'bg-purple-500', icon: Eye },
  PLAYED: { label: 'Reproduzida', color: 'bg-purple-500', icon: Eye },
  failed: { label: 'Falhou', color: 'bg-red-500', icon: AlertCircle },
  FAILED: { label: 'Falhou', color: 'bg-red-500', icon: AlertCircle },
};

export function BaileysReportModal({
  campaignId,
  open,
  onOpenChange
}: BaileysReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [contacts, setContacts] = useState<ContactReport[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchReport = useCallback(async () => {
    if (!campaignId) return;

    try {
      const response = await fetch(`/api/v1/campaigns/${campaignId}/baileys-report`);
      if (!response.ok) throw new Error('Failed to fetch report');

      const data = await response.json();
      setCampaign(data.campaign);
      setMetrics(data.metrics);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[BaileysReport] Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const fetchContacts = useCallback(async (page: number) => {
    if (!campaignId) return;

    try {
      const response = await fetch(
        `/api/v1/campaigns/${campaignId}/baileys-report/contacts?page=${page}`
      );
      if (!response.ok) throw new Error('Failed to fetch contacts');

      const data = await response.json();
      setContacts(data.contacts);
      setPagination(data.pagination);
    } catch (error) {
      console.error('[BaileysReport] Error fetching contacts:', error);
    }
  }, [campaignId]);

  useEffect(() => {
    if (open && campaignId) {
      setLoading(true);
      setCurrentPage(1);
      fetchReport();
      fetchContacts(1);
    }
  }, [open, campaignId, fetchReport, fetchContacts]);

  useEffect(() => {
    if (!open || !campaignId) return;

    const interval = setInterval(() => {
      fetchReport();
      fetchContacts(currentPage);
    }, 5000);

    return () => clearInterval(interval);
  }, [open, campaignId, currentPage, fetchReport, fetchContacts]);

  useEffect(() => {
    if (campaignId && open) {
      fetchContacts(currentPage);
    }
  }, [currentPage, campaignId, open, fetchContacts]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              Relatório: {campaign?.name || 'Carregando...'}
            </DialogTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {lastUpdated && (
                <span>Atualizado: {lastUpdated.toLocaleTimeString('pt-BR')}</span>
              )}
              <RefreshCw
                className={cn("h-4 w-4", loading && "animate-spin")}
                onClick={() => {
                  fetchReport();
                  fetchContacts(currentPage);
                }}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Análise detalhada da campanha.
          </p>
        </DialogHeader>

        {loading && !metrics ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-40" />
            <Skeleton className="h-60" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Enviado</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Total de mensagens na fila de envio.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {metrics?.deliveryRate?.toFixed(1) || '0.0'}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.delivered || 0} mensagens entregues.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Leitura</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {metrics?.readRate?.toFixed(1) || '0.0'}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.read || 0} mensagens lidas.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Falha</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {metrics?.failureRate?.toFixed(1) || '0.0'}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.failed || 0} falhas no envio.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Desempenho da Campanha
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Distribuição visual do status das mensagens enviadas.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enviadas</span>
                      <span className="text-sm font-medium">{metrics?.sent || 0}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${metrics?.total ? ((metrics.sent / metrics.total) * 100) : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Entregues</span>
                      <span className="text-sm font-medium">{metrics?.delivered || 0}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${metrics?.total ? ((metrics.delivered / metrics.total) * 100) : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Lidas</span>
                      <span className="text-sm font-medium">{metrics?.read || 0}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${metrics?.total ? ((metrics.read / metrics.total) * 100) : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Falhas</span>
                      <span className="text-sm font-medium">{metrics?.failed || 0}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all"
                        style={{ width: `${metrics?.total ? ((metrics.failed / metrics.total) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Mensagem Enviada
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Pré-visualização do conteúdo enviado para os contatos.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">Modelo: Mensagem de Texto</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {campaign?.message || 'Corpo da mensagem não disponível.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">
                      Detalhes do Envio por Contato
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Status individual de cada contato na campanha.
                    </p>
                  </div>
                  {pagination && (
                    <div className="text-xs text-muted-foreground">
                      Página {pagination.page} de {pagination.totalPages} ({pagination.total} contatos)
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum contato encontrado.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">Contato</th>
                            <th className="text-left py-2 px-2">Telefone</th>
                            <th className="text-left py-2 px-2">Status</th>
                            <th className="text-left py-2 px-2">Enviado</th>
                            <th className="text-left py-2 px-2">Atualizado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.map((contact) => {
                            const config = statusConfig[contact.status] ?? statusConfig.sent;
                            const StatusIcon = config?.icon ?? Send;
                            return (
                              <tr key={contact.id} className="border-b last:border-0">
                                <td className="py-2 px-2">{contact.name}</td>
                                <td className="py-2 px-2 font-mono text-xs">{contact.phone}</td>
                                <td className="py-2 px-2">
                                  <Badge
                                    variant="secondary"
                                    className={cn("text-white text-xs", config?.color ?? 'bg-blue-500')}
                                  >
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {config?.label ?? 'Enviada'}
                                  </Badge>
                                </td>
                                <td className="py-2 px-2 text-xs text-muted-foreground">
                                  {new Date(contact.sentAt).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                </td>
                                <td className="py-2 px-2 text-xs text-muted-foreground">
                                  {new Date(contact.updatedAt).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {pagination && pagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!pagination.hasPrev}
                          onClick={() => handlePageChange(currentPage - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          {pagination.page} / {pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!pagination.hasNext}
                          onClick={() => handlePageChange(currentPage + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
