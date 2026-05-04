'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVoiceAgents, VoiceAgent, CreateAgentData, UpdateAgentData } from '@/hooks/useVoiceAgents';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Phone, Bot, Clock, Plus, Edit, Power, Loader2, PhoneCall, PhoneOff, Users, RefreshCw, Send, Square, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { VoiceAgentDialog, PhoneNumbersManager } from '@/components/voice-agents';
import { RetellCallButton } from '@/components/voice/RetellCallButton';
import { CreateVoiceCampaignDialog } from '@/components/campaigns/create-voice-campaign-dialog';
import { CampaignDetailsModal, CampaignDetails } from '@/components/campaigns/campaign-details-modal';

function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function unformatPhone(value: string): string {
  return value.replace(/\D/g, '');
}

type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'error';

export default function VoiceAIPage() {
  const { agents, loading, updateAgent, createAgent, fetchAgents, deleteAgent } = useVoiceAgents();
  const { toast } = useToast();

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callError, setCallError] = useState<string>('');
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [voiceCampaigns, setVoiceCampaigns] = useState<any[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [pausingCampaign, setPausingCampaign] = useState<string | null>(null);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<VoiceAgent | null>(null);
  const [callsPage, setCallsPage] = useState(1);
  const [callsTotal, setCallsTotal] = useState(0);
  const [agentsPage, setAgentsPage] = useState(1);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetails | null>(null);
  const [showCampaignDetails, setShowCampaignDetails] = useState(false);
  const [campaignsPage, setCampaignsPage] = useState(1);
  const [campaignsTotal, setCampaignsTotal] = useState(0);
  const agentsPerPage = 6;
  const itemsPerPage = 10;
  const campaignsPerPage = 10;

  const availableAgents = agents.filter(a => a.status !== 'archived');

  const fetchRecentCalls = useCallback(async () => {
    setLoadingCalls(true);
    try {
      const offset = (callsPage - 1) * itemsPerPage;
      const response = await fetch(`/api/v1/voice/calls?limit=${itemsPerPage}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setRecentCalls(data.data || []);
        setCallsTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching calls:', err);
    } finally {
      setLoadingCalls(false);
    }
  }, [callsPage, itemsPerPage]);


  const fetchVoiceCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const offset = (campaignsPage - 1) * campaignsPerPage;
      const response = await fetch(`/api/v1/campaigns?channel=VOICE&limit=${campaignsPerPage}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        const campaigns = (data.data || []).sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setVoiceCampaigns(campaigns);
        setCampaignsTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching voice campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [campaignsPage]);

  const pauseCampaign = async (campaignId: string) => {
    setPausingCampaign(campaignId);
    try {
      const response = await fetch(`/api/v1/campaigns/${campaignId}/pause`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao pausar campanha');
      }
      toast({ title: 'Sucesso', description: data.message });
      fetchVoiceCampaigns();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setPausingCampaign(null);
    }
  };

  useEffect(() => {
    fetchRecentCalls();
    fetchVoiceCampaigns();
    const campaignsInterval = setInterval(fetchVoiceCampaigns, 30000); // 30 segundos
    return () => {
      clearInterval(campaignsInterval);
    };
  }, [fetchRecentCalls, fetchVoiceCampaigns]);

  const _makeCall = async () => {
    if (!selectedAgentId) {
      toast({ title: 'Erro', description: 'Selecione um agente', variant: 'destructive' });
      return;
    }

    const cleanPhone = unformatPhone(phoneNumber);
    if (cleanPhone.length < 10) {
      toast({ title: 'Erro', description: 'Número de telefone inválido', variant: 'destructive' });
      return;
    }

    setCallStatus('calling');
    setCallError('');

    try {
      const response = await fetch('/api/v1/voice/calls/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          toNumber: `+55${cleanPhone}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar chamada');
      }

      setCallStatus('ringing');
      toast({ title: 'Sucesso', description: 'Chamada iniciada com sucesso!' });

      setTimeout(() => {
        setCallStatus('idle');
        fetchRecentCalls();
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setCallStatus('error');
      setCallError(message);
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneBR(e.target.value));
  };

  const toggleAgentStatus = async (agent: VoiceAgent) => {
    setTogglingAgentId(agent.id);
    try {
      const newStatus = agent.status === 'active' ? 'inactive' : 'active';
      const result = await updateAgent(agent.id, { status: newStatus });
      if (result) {
        toast({
          title: 'Sucesso',
          description: `Agente ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso`,
        });
        // Força um recarregamento da lista
        await fetchAgents();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setTogglingAgentId(null);
    }
  };

  const handleEditAgent = (agent: VoiceAgent) => {
    setEditingAgent(agent);
    setShowAgentDialog(true);
  };

  const handleNewAgent = () => {
    setEditingAgent(null);
    setShowAgentDialog(true);
  };

  const handleSaveAgent = async (data: CreateAgentData | UpdateAgentData) => {
    if (editingAgent) {
      return await updateAgent(editingAgent.id, data as UpdateAgentData);
    } else {
      return await createAgent(data as CreateAgentData);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deletingAgentId) return;
    const success = await deleteAgent(deletingAgentId);
    if (success) {
      setShowDeleteDialog(false);
      setDeletingAgentId(null);
      setAgentsPage(1);
    }
  };

  const confirmDeleteAgent = (agentId: string) => {
    setDeletingAgentId(agentId);
    setShowDeleteDialog(true);
  };

  const getCallStatusBadge = () => {
    switch (callStatus) {
      case 'calling':
        return <Badge className="bg-yellow-500 text-white animate-pulse">Discando...</Badge>;
      case 'ringing':
        return <Badge className="bg-blue-500 text-white animate-pulse">Chamando...</Badge>;
      case 'connected':
        return <Badge className="bg-green-500 text-white">Conectado</Badge>;
      case 'ended':
        return <Badge className="bg-gray-500 text-white">Encerrada</Badge>;
      case 'error':
        return <Badge className="bg-red-500 text-white">Erro</Badge>;
      default:
        return null;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Ativo</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-500 hover:bg-gray-600 text-white">Inativo</Badge>;
      case 'ended':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Concluída</Badge>;
      case 'ongoing':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white animate-pulse">Em andamento</Badge>;
      case 'failed':
        return <Badge className="bg-red-500 hover:bg-red-600 text-white">Falha</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Phone className="h-7 w-7 text-primary" />
            Voice AI
          </h2>
          <p className="text-muted-foreground">
            Faça chamadas inteligentes com IA
          </p>
        </div>
        <CreateVoiceCampaignDialog>
          <Button className="bg-primary hover:bg-primary/90">
            <Users className="mr-2 h-4 w-4" />
            Campanha em Massa
          </Button>
        </CreateVoiceCampaignDialog>
      </div>

      <Card className="shadow-lg border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PhoneCall className="h-5 w-5 text-primary" />
            Fazer Ligação Rápida
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Agente</label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhum agente disponível</SelectItem>
                  ) : (
                    availableAgents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          {agent.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                className="text-lg"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <RetellCallButton
              contactId="quick-call"
              customerName="Chamada Rápida"
              customerNumber={`+55${unformatPhone(phoneNumber)}`}
              agentId={selectedAgentId}
              variant="default"
              size="lg"
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-lg px-8"
              trigger={
                <Button
                  disabled={callStatus === 'calling' || callStatus === 'ringing' || !selectedAgentId || unformatPhone(phoneNumber).length < 10}
                  size="lg"
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-lg px-8"
                >
                  {callStatus === 'calling' ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Ligando...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-5 w-5" />
                      Ligar Agora
                    </>
                  )}
                </Button>
              }
            />

            {callStatus !== 'idle' && (
              <div className="flex items-center gap-2">
                {getCallStatusBadge()}
                {callError && <span className="text-sm text-red-500">{callError}</span>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      <Card className="shadow-lg border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-blue-600" />
            Campanhas de Voz ({campaignsTotal})
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchVoiceCampaigns}
            disabled={loadingCampaigns}
          >
            <RefreshCw className={`h-4 w-4 ${loadingCampaigns ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loadingCampaigns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : voiceCampaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma campanha de voz criada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {voiceCampaigns.map((campaign: any) => {
                const _campaignsPerPageCount = Math.ceil(campaignsTotal / campaignsPerPage);
                const isSending = campaign.status === 'SENDING';
                const isQueued = campaign.status === 'QUEUED';
                const isPaused = campaign.status === 'PAUSED';
                const isCompleted = campaign.status === 'COMPLETED';
                const isFailed = campaign.status === 'FAILED';
                const isScheduled = campaign.status === 'SCHEDULED';
                const progress = campaign.progress || 0;

                const handleCampaignClick = () => {
                  const voiceAgent = agents.find(a => a.id === campaign.voiceAgentId);
                  setSelectedCampaign({
                    ...campaign,
                    channel: 'VOICE' as const,
                    voiceAgentName: voiceAgent?.name || 'Agente de voz',
                  });
                  setShowCampaignDetails(true);
                };

                return (
                  <div
                    key={campaign.id}
                    className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={handleCampaignClick}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isSending ? 'bg-blue-100 dark:bg-blue-900' :
                          isPaused ? 'bg-orange-100 dark:bg-orange-900' :
                            isCompleted ? 'bg-green-100 dark:bg-green-900' :
                              isFailed ? 'bg-red-100 dark:bg-red-900' :
                                'bg-gray-100 dark:bg-gray-800'
                          }`}>
                          {isSending ? (
                            <Send className="h-4 w-4 text-blue-600 animate-pulse" />
                          ) : isCompleted ? (
                            <PhoneCall className="h-4 w-4 text-green-600" />
                          ) : isFailed ? (
                            <PhoneOff className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className={`h-4 w-4 ${isQueued ? 'text-yellow-600' :
                              isPaused ? 'text-orange-600' :
                                'text-gray-500'
                              }`} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {agents.find(a => a.id === campaign.voiceAgentId)?.name || 'Agente de voz'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          isSending ? 'bg-blue-500 text-white animate-pulse' :
                            isQueued ? 'bg-yellow-500 text-white' :
                              isPaused ? 'bg-orange-500 text-white' :
                                isCompleted ? 'bg-green-500 text-white' :
                                  isFailed ? 'bg-red-500 text-white' :
                                    isScheduled ? 'bg-purple-500 text-white' :
                                      'bg-gray-500 text-white'
                        }>
                          {isSending ? 'Enviando' :
                            isQueued ? 'Na fila' :
                              isPaused ? 'Pausada' :
                                isCompleted ? 'Concluída' :
                                  isFailed ? 'Falha' :
                                    isScheduled ? 'Agendada' :
                                      campaign.status}
                        </Badge>
                        {(isSending || isQueued) && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              pauseCampaign(campaign.id);
                            }}
                            disabled={pausingCampaign === campaign.id}
                          >
                            {pausingCampaign === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Square className="h-4 w-4 mr-1" />
                                Parar
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    {isSending && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-muted-foreground mb-1">
                          <span>Progresso</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                    {isScheduled && campaign.scheduledAt && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <Clock className="inline h-3 w-3 mr-1" />
                        Agendada para: {new Date(campaign.scheduledAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                    {campaign.createdAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Criada em {new Date(campaign.createdAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                );
              })}

              {Math.ceil(campaignsTotal / campaignsPerPage) > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={campaignsPage === 1}
                    onClick={() => setCampaignsPage(prev => Math.max(1, prev - 1))}
                  >
                    ← Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {campaignsPage} de {Math.ceil(campaignsTotal / campaignsPerPage)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={campaignsPage === Math.ceil(campaignsTotal / campaignsPerPage)}
                    onClick={() => setCampaignsPage(prev => Math.min(Math.ceil(campaignsTotal / campaignsPerPage), prev + 1))}
                  >
                    Próximo →
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="space-y-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5" />
              Meus Agentes
            </CardTitle>
            <Button onClick={handleNewAgent} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Novo Agente
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setAgentsPage(1);
              }}
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('active');
                setAgentsPage(1);
              }}
            >
              Ativos
            </Button>
            <Button
              variant={statusFilter === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter('inactive');
                setAgentsPage(1);
              }}
            >
              Inativos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum agente criado</p>
              <Button onClick={handleNewAgent} variant="outline" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                Criar primeiro agente
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents
                  .filter(a => a.status !== 'archived')
                  .filter(a => statusFilter === 'all' || a.status === statusFilter)
                  .slice((agentsPage - 1) * agentsPerPage, agentsPage * agentsPerPage)
                  .map(agent => (
                    <Card key={agent.id} className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <span className="font-medium truncate">{agent.name}</span>
                          </div>
                          {getStatusBadge(agent.status)}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                          <Badge variant="outline" className="text-xs">
                            {agent.type === 'inbound' ? 'Entrada' : agent.type === 'outbound' ? 'Saída' : 'Transferência'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAgent(agent)}
                            className="flex-1"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant={agent.status === 'active' ? 'destructive' : 'default'}
                            size="sm"
                            onClick={() => toggleAgentStatus(agent)}
                            disabled={togglingAgentId === agent.id}
                            className={agent.status === 'active' ? '' : 'bg-green-600 hover:bg-green-700'}
                          >
                            {togglingAgentId === agent.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => confirmDeleteAgent(agent.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {(() => {
                const filteredAgents = agents
                  .filter(a => a.status !== 'archived')
                  .filter(a => statusFilter === 'all' || a.status === statusFilter);
                return filteredAgents.length > agentsPerPage && (
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {(agentsPage - 1) * agentsPerPage + 1} a {Math.min(agentsPage * agentsPerPage, filteredAgents.length)} de {filteredAgents.length} agentes
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAgentsPage(p => Math.max(1, p - 1))}
                        disabled={agentsPage === 1}
                      >
                        Anterior
                      </Button>
                      <div className="flex items-center gap-2 px-3 py-1 border rounded-md text-sm">
                        <span>Página {agentsPage} de {Math.ceil(filteredAgents.length / agentsPerPage)}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAgentsPage(p => p + 1)}
                        disabled={agentsPage >= Math.ceil(filteredAgents.length / agentsPerPage)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Chamadas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCalls ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recentCalls.length === 0 && callsTotal === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma chamada recente</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Data</th>
                      <th className="pb-3 font-medium">Agente</th>
                      <th className="pb-3 font-medium">Número</th>
                      <th className="pb-3 font-medium">Duração</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalls.map(call => (
                      <tr key={call.id} className="border-b last:border-0">
                        <td className="py-3 text-sm">{formatDate(call.startedAt || call.createdAt)}</td>
                        <td className="py-3 text-sm">
                          {agents.find(a => a.id === call.agentId)?.name || '-'}
                        </td>
                        <td className="py-3 text-sm font-mono">{call.toNumber}</td>
                        <td className="py-3 text-sm">{formatDuration(call.duration)}</td>
                        <td className="py-3">{getStatusBadge(call.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {callsTotal > itemsPerPage && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(callsPage - 1) * itemsPerPage + 1} a {Math.min(callsPage * itemsPerPage, callsTotal)} de {callsTotal} chamadas
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCallsPage(p => Math.max(1, p - 1))}
                      disabled={callsPage === 1 || loadingCalls}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-2 px-3 py-1 border rounded-md text-sm">
                      <span>Página {callsPage} de {Math.ceil(callsTotal / itemsPerPage)}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCallsPage(p => p + 1)}
                      disabled={callsPage >= Math.ceil(callsTotal / itemsPerPage) || loadingCalls}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PhoneNumbersManager />

      <VoiceAgentDialog
        open={showAgentDialog}
        onOpenChange={(open) => {
          setShowAgentDialog(open);
          if (!open) setEditingAgent(null);
        }}
        agent={editingAgent}
        onSave={handleSaveAgent}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgent}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <CampaignDetailsModal
        campaign={selectedCampaign}
        open={showCampaignDetails}
        onOpenChange={setShowCampaignDetails}
        onRefresh={fetchVoiceCampaigns}
      />
    </div>
  );
}
