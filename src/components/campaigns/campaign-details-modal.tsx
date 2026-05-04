'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Send,
  Phone,
  MessageSquare,
  Clock,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Target,
  Loader2,
  PhoneCall,
  RotateCcw,
  Eye,
  BarChart3,
} from 'lucide-react';

export type CampaignChannel = 'VOICE' | 'WHATSAPP' | 'SMS';

export type CampaignStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'SENDING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'SCHEDULED'
  | 'PARTIAL_FAILURE';

export interface CampaignDetails {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  createdAt?: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
  progress?: number;
  connectionName?: string;
  smsGatewayName?: string;
  templateName?: string;
  voiceAgentId?: string;
  voiceAgentName?: string;
  message?: string;
  totalContacts?: number;
  batchSize?: number;
  batchDelaySeconds?: number;
  enableRetry?: boolean;
  maxRetryAttempts?: number;
}

interface CampaignDetailsModalProps {
  campaign: CampaignDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function CampaignDetailsModal({
  campaign,
  open,
  onOpenChange,
  onRefresh,
}: CampaignDetailsModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<'pause' | 'resume' | 'retry' | 'cancel' | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [details, setDetails] = useState<CampaignDetails | null>(null);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [voiceCallsData, setVoiceCallsData] = useState<any[]>([]);
  const [voiceMetrics, setVoiceMetrics] = useState<any>(null);

  const fetchCampaignDetails = useCallback(async () => {
    if (!campaign?.id) return;

    setLoadingDetails(true);
    try {
      const isVoice = campaign?.channel === 'VOICE';

      if (isVoice) {
        // For voice campaigns, fetch from voice-report endpoint
        const voiceRes = await fetch(`/api/v1/campaigns/${campaign.id}/voice-report`);
        if (voiceRes.ok) {
          const voiceData = await voiceRes.json();
          setVoiceMetrics(voiceData.metrics);
          setVoiceCallsData(voiceData.calls || []);
          // Update details with voice metrics
          setDetails({
            ...campaign,
            sent: voiceData.metrics.total,
            delivered: voiceData.metrics.answered,
            failed: voiceData.metrics.notAnswered,
          });
        }
      } else {
        // For WhatsApp/SMS campaigns, use original flow
        const [detailsRes, failedRes] = await Promise.all([
          fetch(`/api/v1/campaigns/${campaign.id}`),
          fetch(`/api/v1/campaigns/${campaign.id}/retry-failed`),
        ]);

        if (detailsRes.ok) {
          const data = await detailsRes.json();
          setDetails({ ...campaign, ...data });
        }

        if (failedRes.ok) {
          const failedData = await failedRes.json();
          setFailedCount(failedData.failedCount || 0);
        }
      }
    } catch (err) {
      console.error('Error fetching campaign details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [campaign]);

  useEffect(() => {
    if (open && campaign) {
      setDetails(campaign);
      fetchCampaignDetails();
    }
  }, [open, campaign, fetchCampaignDetails]);

  const handleAction = async (action: 'pause' | 'resume' | 'retry' | 'cancel') => {
    if (!campaign?.id) return;

    setLoading(true);
    try {
      let endpoint = '';
      let method = 'PUT';

      switch (action) {
        case 'pause':
          endpoint = `/api/v1/campaigns/${campaign.id}/pause`;
          break;
        case 'resume':
          endpoint = `/api/v1/campaigns/${campaign.id}/resume`;
          break;
        case 'retry':
          endpoint = `/api/v1/campaigns/${campaign.id}/retry-failed`;
          method = 'POST';
          break;
        case 'cancel':
          endpoint = `/api/v1/campaigns/${campaign.id}`;
          method = 'DELETE';
          break;
      }

      const response = await fetch(endpoint, { method });
      const data = method !== 'DELETE' ? await response.json() : null;

      if (!response.ok) {
        throw new Error(data?.error || data?.description || 'Erro ao executar ação');
      }

      const messages: Record<string, string> = {
        pause: 'Campanha pausada com sucesso',
        resume: 'Campanha retomada com sucesso',
        retry: `Campanha de reenvio criada com ${failedCount} contatos`,
        cancel: 'Campanha cancelada com sucesso',
      };

      toast({
        title: 'Sucesso',
        description: data?.message || messages[action],
      });

      if (action === 'cancel') {
        onOpenChange(false);
      } else {
        fetchCampaignDetails();
      }

      onRefresh?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
      setActionType(null);
    }
  };

  const openConfirmDialog = (action: 'pause' | 'resume' | 'retry' | 'cancel') => {
    setActionType(action);
    setConfirmDialogOpen(true);
  };

  const getChannelIcon = (channel: CampaignChannel) => {
    switch (channel) {
      case 'VOICE':
        return <PhoneCall className="h-5 w-5" />;
      case 'WHATSAPP':
        return <MessageSquare className="h-5 w-5" />;
      case 'SMS':
        return <Phone className="h-5 w-5" />;
      default:
        return <Send className="h-5 w-5" />;
    }
  };

  const getChannelLabel = (channel: CampaignChannel) => {
    const labels: Record<CampaignChannel, string> = {
      VOICE: 'Voz',
      WHATSAPP: 'WhatsApp',
      SMS: 'SMS',
    };
    return labels[channel] || channel;
  };

  const getStatusBadge = (status: CampaignStatus) => {
    const configs: Record<CampaignStatus, { label: string; className: string; icon: typeof Send }> = {
      DRAFT: { label: 'Rascunho', className: 'bg-muted-foreground', icon: Clock },
      QUEUED: { label: 'Na fila', className: 'bg-yellow-500', icon: Clock },
      SENDING: { label: 'Enviando', className: 'bg-blue-500 animate-pulse', icon: Send },
      PAUSED: { label: 'Pausada', className: 'bg-orange-500', icon: Pause },
      COMPLETED: { label: 'Concluída', className: 'bg-green-500', icon: CheckCircle },
      FAILED: { label: 'Falha', className: 'bg-red-500', icon: XCircle },
      SCHEDULED: { label: 'Agendada', className: 'bg-purple-500', icon: Calendar },
      PARTIAL_FAILURE: { label: 'Falha Parcial', className: 'bg-orange-600', icon: AlertCircle },
    };

    const config = configs[status] || { label: status, className: 'bg-muted-foreground', icon: Clock };
    const Icon = config.icon;

    return (
      <Badge className={`${config.className} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentData = details || campaign;
  const status = currentData?.status as CampaignStatus;

  const isVoice = currentData?.channel === 'VOICE';
  const canPause = ['SENDING', 'QUEUED', 'SCHEDULED'].includes(status);
  const canResume = status === 'PAUSED';
  const canRetry = !isVoice && ['COMPLETED', 'FAILED', 'PARTIAL_FAILURE'].includes(status) && failedCount > 0;
  const canCancel = !['COMPLETED', 'FAILED'].includes(status);

  const sentCount = currentData?.sent || 0;
  const deliveredCount = currentData?.delivered || 0;
  const readCount = currentData?.read || 0;
  const failedDisplay = currentData?.failed || failedCount || 0;
  const progress = currentData?.progress || (sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0);

  const deliveryRate = sentCount > 0 ? ((deliveredCount / sentCount) * 100).toFixed(1) : '0';
  const readRate = deliveredCount > 0 ? ((readCount / deliveredCount) * 100).toFixed(1) : '0';
  const failureRate = sentCount > 0 ? ((failedDisplay / sentCount) * 100).toFixed(1) : '0';

  if (!campaign) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${currentData?.channel === 'VOICE' ? 'bg-green-100 dark:bg-green-900' :
                  currentData?.channel === 'WHATSAPP' ? 'bg-emerald-100 dark:bg-emerald-900' :
                    'bg-blue-100 dark:bg-blue-900'
                }`}>
                {getChannelIcon(currentData?.channel as CampaignChannel)}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{currentData?.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{getChannelLabel(currentData?.channel as CampaignChannel)}</Badge>
                  {getStatusBadge(status)}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 mt-4">
              {status === 'SENDING' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso do Envio</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
              )}

              {isVoice ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <PhoneCall className="h-5 w-5 mx-auto text-green-500 mb-2" />
                        <p className="text-2xl font-bold">{(voiceMetrics?.total || sentCount).toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">Chamadas Realizadas</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <CheckCircle className="h-5 w-5 mx-auto text-blue-500 mb-2" />
                        <p className="text-2xl font-bold">{(voiceMetrics?.answered || deliveredCount).toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">Atendidas</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <XCircle className="h-5 w-5 mx-auto text-red-500 mb-2" />
                        <p className="text-2xl font-bold">{(voiceMetrics?.notAnswered || failedDisplay).toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">Não Atendidas</p>
                      </CardContent>
                    </Card>
                  </div>

                  {voiceCallsData.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Detalhes das Chamadas
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-2">Telefone</th>
                                <th className="text-left py-2 px-2">Status</th>
                                <th className="text-left py-2 px-2">Duração</th>
                                <th className="text-left py-2 px-2">Data/Hora</th>
                              </tr>
                            </thead>
                            <tbody>
                              {voiceCallsData.map((call, idx) => (
                                <tr key={idx} className="border-b hover:bg-muted/50">
                                  <td className="py-2 px-2 font-mono text-xs">{call.phoneNumber}</td>
                                  <td className="py-2 px-2">
                                    <Badge
                                      className={
                                        call.status === 'answered'
                                          ? 'bg-green-500'
                                          : call.status === 'voicemail'
                                            ? 'bg-blue-500'
                                            : call.status === 'no_answer'
                                              ? 'bg-yellow-500'
                                              : call.status === 'busy'
                                                ? 'bg-orange-500'
                                                : 'bg-red-500'
                                      }
                                    >
                                      {call.status === 'answered'
                                        ? 'Atendida'
                                        : call.status === 'voicemail'
                                          ? 'Voicemail'
                                          : call.status === 'no_answer'
                                            ? 'Sem resposta'
                                            : call.status === 'busy'
                                              ? 'Ocupado'
                                              : 'Falha'}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-2 text-muted-foreground">
                                    {call.duration || '-'}
                                  </td>
                                  <td className="py-2 px-2 text-xs text-muted-foreground">
                                    {call.sentAt
                                      ? new Date(call.sentAt).toLocaleString('pt-BR')
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <Send className="h-5 w-5 mx-auto text-blue-500 mb-2" />
                      <p className="text-2xl font-bold">{sentCount.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">Enviados</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-2" />
                      <p className="text-2xl font-bold">{deliveryRate}%</p>
                      <p className="text-xs text-muted-foreground">Entregues ({deliveredCount})</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <Eye className="h-5 w-5 mx-auto text-purple-500 mb-2" />
                      <p className="text-2xl font-bold">{readRate}%</p>
                      <p className="text-xs text-muted-foreground">Lidos ({readCount})</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <XCircle className="h-5 w-5 mx-auto text-red-500 mb-2" />
                      <p className="text-2xl font-bold">{failureRate}%</p>
                      <p className="text-xs text-muted-foreground">Falhas ({failedDisplay})</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Cronograma
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Criada em:</span>
                      <span>{formatDate(currentData?.createdAt)}</span>
                    </div>
                    {currentData?.scheduledAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agendada para:</span>
                        <span>{formatDate(currentData.scheduledAt)}</span>
                      </div>
                    )}
                    {currentData?.sentAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Iniciada em:</span>
                        <span>{formatDate(currentData.sentAt)}</span>
                      </div>
                    )}
                    {currentData?.completedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Concluída em:</span>
                        <span>{formatDate(currentData.completedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Configuração
                  </h4>
                  <div className="space-y-2 text-sm">
                    {currentData?.connectionName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conexão:</span>
                        <span>{currentData.connectionName}</span>
                      </div>
                    )}
                    {currentData?.smsGatewayName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gateway SMS:</span>
                        <span>{currentData.smsGatewayName}</span>
                      </div>
                    )}
                    {currentData?.voiceAgentName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agente de Voz:</span>
                        <span>{currentData.voiceAgentName}</span>
                      </div>
                    )}
                    {currentData?.templateName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Template:</span>
                        <span>{currentData.templateName}</span>
                      </div>
                    )}
                    {currentData?.batchSize && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tamanho do lote:</span>
                        <span>{currentData.batchSize} mensagens</span>
                      </div>
                    )}
                    {currentData?.batchDelaySeconds && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Intervalo:</span>
                        <span>{currentData.batchDelaySeconds}s entre lotes</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {currentData?.message && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Mensagem
                    </h4>
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      {currentData.message}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Ações
                </h4>
                <div className="flex flex-wrap gap-2">
                  {canPause && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirmDialog('pause')}
                      disabled={loading}
                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pausar
                    </Button>
                  )}

                  {canResume && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirmDialog('resume')}
                      disabled={loading}
                      className="text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Retomar
                    </Button>
                  )}

                  {canRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirmDialog('retry')}
                      disabled={loading}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reenviar Falhas ({failedCount})
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchCampaignDetails}
                    disabled={loadingDetails}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${loadingDetails ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>

                  {canCancel && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openConfirmDialog('cancel')}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Cancelar Campanha
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'pause' && 'Pausar Campanha'}
              {actionType === 'resume' && 'Retomar Campanha'}
              {actionType === 'retry' && 'Reenviar para Contatos com Falha'}
              {actionType === 'cancel' && 'Cancelar Campanha'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'pause' && 'Tem certeza que deseja pausar esta campanha? Você poderá retomá-la depois.'}
              {actionType === 'resume' && 'Tem certeza que deseja retomar esta campanha? O envio continuará de onde parou.'}
              {actionType === 'retry' && `Será criada uma nova campanha de reenvio com ${failedCount} contatos que falharam.`}
              {actionType === 'cancel' && 'Tem certeza que deseja cancelar esta campanha? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionType && handleAction(actionType)}
              disabled={loading}
              className={actionType === 'cancel' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
