

'use client';

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, FileText, GitBranch, MessageSquareText, SendIcon, Loader2, PlayCircle, List, LayoutGrid, Megaphone, Pause, Play } from 'lucide-react';
import type { Campaign, Connection, SmsGateway, Template } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { DateRangePicker } from '../ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';
import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useDebounce } from '@/hooks/use-debounce';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { BaileysReportModal } from './baileys-report-modal';


type CampaignTableProps = {
  channel: 'WHATSAPP' | 'SMS';
  baileysOnly?: boolean;
}
type ViewType = 'grid' | 'table';

const statusConfig = {
  COMPLETED: { variant: 'default', text: 'Concluída', className: 'bg-green-500 hover:bg-green-600' },
  SENDING: { variant: 'outline', text: 'Enviando', className: 'border-blue-500 text-blue-500' },
  QUEUED: { variant: 'outline', text: 'Na Fila', className: 'border-blue-500 text-blue-500' },
  SCHEDULED: { variant: 'secondary', text: 'Agendada', className: 'bg-orange-500 hover:bg-orange-600 text-secondary-foreground' },
  PENDING: { variant: 'secondary', text: 'Pendente', className: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
  PAUSED: { variant: 'secondary', text: 'Pausada', className: 'bg-muted-foreground hover:bg-muted-foreground/80 text-white' },
  FAILED: { variant: 'destructive', text: 'Falhou', className: '' },
  // Legacy statuses for graceful fallback
  Concluída: { variant: 'default', text: 'Concluída', className: 'bg-green-500 hover:bg-green-600' },
  Enviando: { variant: 'outline', text: 'Enviando', className: 'border-blue-500 text-blue-500' },
  Agendada: { variant: 'secondary', text: 'Agendada', className: 'bg-orange-500 hover:bg-orange-600 text-secondary-foreground' },
  Pendente: { variant: 'secondary', text: 'Pendente', className: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
  Pausada: { variant: 'secondary', text: 'Pausada', className: 'bg-muted-foreground hover:bg-muted-foreground/80 text-white' },
  Falhou: { variant: 'destructive', text: 'Falhou', className: '' },
} as const;


const CampaignCard = memo(({ campaign, onUpdate, onDelete, allTemplates, notify, onOpenBaileysReport }: { campaign: Campaign, onUpdate: () => void, onDelete: (id: string) => void, allTemplates: Template[], notify: ReturnType<typeof createToastNotifier>, onOpenBaileysReport?: (campaignId: string) => void }) => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [isPauseResuming, setIsPauseResuming] = useState(false);
  const statusKey = campaign.status as keyof typeof statusConfig;
  const status = statusConfig[statusKey] || statusConfig.Agendada;
  const isSms = campaign.channel === 'SMS';
  const campaignDate = campaign.sentAt || campaign.scheduledAt;

  const connectionOrGatewayName = isSms ? campaign.smsGatewayName : campaign.connectionName;
  const template = !isSms && campaign.templateId ? allTemplates.find((t: Template) => t.id === campaign.templateId) : null;
  // Para campanhas Baileys (sem templateId mas com message), mostrar "Mensagem de Texto"
  const templateName = isSms
    ? 'Mensagem de Texto'
    : template?.name
      ? template.name
      : campaign.message
        ? 'Mensagem de Texto'
        : 'Modelo não encontrado';

  const handleForceTrigger = async () => {
    setIsTriggering(true);
    try {
      const response = await fetch(`/api/v1/campaigns/${campaign.id}/trigger`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao forçar o envio.');
      }
      notify.success('Campanha Enviada!', `A campanha "${campaign.name}" foi enviada para a fila de processamento.`);
      onUpdate(); // Refresh the campaign list
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setIsTriggering(false);
    }
  }

  const handlePause = async () => {
    setIsPauseResuming(true);
    try {
      const response = await fetch(`/api/v1/campaigns/${campaign.id}/pause`, {
        method: 'PUT'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.description || errorData.error || 'Falha ao pausar a campanha.');
      }
      notify.success('Campanha Pausada!', `A campanha "${campaign.name}" foi pausada.`);
      onUpdate(); // Refresh the campaign list
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setIsPauseResuming(false);
    }
  }

  const handleResume = async () => {
    setIsPauseResuming(true);
    try {
      const response = await fetch(`/api/v1/campaigns/${campaign.id}/resume`, {
        method: 'PUT'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.description || errorData.error || 'Falha ao retomar a campanha.');
      }
      notify.success('Campanha Retomada!', `A campanha "${campaign.name}" foi retomada.`);
      onUpdate(); // Refresh the campaign list
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setIsPauseResuming(false);
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/v1/campaigns/${campaign.id}`, {
        method: 'DELETE'
      });

      if (response.status !== 204) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao excluir a campanha.');
      }
      notify.success('Campanha Excluída!', `A campanha "${campaign.name}" foi removida.`);
      onDelete(campaign.id);
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    }
  }

  return (
    <Card className="flex flex-col bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-white/5 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all group overflow-hidden relative">
      {/* Decorative top glow */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader className="pb-3 z-10 relative">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1 pr-2">
            <CardTitle className="text-lg font-black tracking-tight line-clamp-2 drop-shadow-md">{campaign.name}</CardTitle>
            <Badge variant="outline" className={cn("w-fit text-[9px] uppercase tracking-wider", isSms ? "border-white/20 text-white" : (!campaign.templateId ? "border-blue-500/50 text-blue-400 bg-blue-500/10" : "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"))}>
              {isSms ? 'SMS' : (!campaign.templateId ? 'Baileys' : 'Oficial')}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {campaign.templateId ? (
                <Link href={`/campaigns/${campaign.id}/report`} passHref>
                  <DropdownMenuItem>
                    <FileText className="mr-2 h-4 w-4" />
                    Ver Relatório
                  </DropdownMenuItem>
                </Link>
              ) : (
                <DropdownMenuItem onClick={() => onOpenBaileysReport?.(campaign.id)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Relatório
                </DropdownMenuItem>
              )}
              {(['SCHEDULED', 'PENDING', 'QUEUED'].includes(campaign.status)) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleForceTrigger} disabled={isTriggering}>
                    {isTriggering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                    Forçar Envio Agora
                  </DropdownMenuItem>
                </>
              )}
              {(['SCHEDULED', 'PENDING', 'QUEUED', 'SENDING'].includes(campaign.status)) && (
                <DropdownMenuItem onClick={handlePause} disabled={isPauseResuming}>
                  {isPauseResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pause className="mr-2 h-4 w-4" />}
                  Pausar Campanha
                </DropdownMenuItem>
              )}
              {campaign.status === 'PAUSED' && (
                <DropdownMenuItem onClick={handleResume} disabled={isPauseResuming}>
                  {isPauseResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Retomar Campanha
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir a campanha &quot;{campaign.name}&quot;? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Sim, Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {campaignDate && <p className="text-xs text-muted-foreground pt-1">{new Date(campaignDate).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}</p>}
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2">
          <Badge variant={status.variant} className={cn(status.className, "mt-1 mb-2 bg-opacity-20 backdrop-blur-sm border shadow-[0_0_10px_currentColor] text-[10px] font-bold tracking-wider uppercase")}>{status.text}</Badge>
          <div className="space-y-2 text-sm text-muted-foreground pt-2">
            <div className="flex items-center gap-2">
              {isSms ? <SendIcon className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" /> : <GitBranch className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />}
              <span className="font-medium text-foreground/80">{connectionOrGatewayName || (isSms ? 'Gateway Padrão' : 'Conexão Padrão')}</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
              <span className="truncate font-medium text-foreground/80">{templateName}</span>
            </div>
          </div>
        </div>
        <div className={cn("grid gap-2 border-t border-zinc-200 dark:border-white/10 pt-4 bg-zinc-50 dark:bg-black/20 -mx-6 -mb-6 px-6 pb-6 mt-2 rounded-b-2xl", isSms ? "grid-cols-2" : "grid-cols-3")}>
          <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 shadow-inner">
            <p className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{campaign.sent}</p>
            <p className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1 text-center">Enviadas</p>
          </div>
          {!isSms && (
            <>
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 shadow-inner">
                <p className="text-xl font-black">{campaign.delivered}</p>
                <p className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1 text-center">Entregues</p>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 shadow-inner">
                <p className="text-xl font-black">{campaign.read}</p>
                <p className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1 text-center">Lidas</p>
              </div>
            </>
          )}
          {isSms && (
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 shadow-inner">
              <p className="text-xl font-black text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">{campaign.failed}</p>
              <p className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-1 text-center">Falhas</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

CampaignCard.displayName = 'CampaignCard';

export function CampaignTable({ channel, baileysOnly = false }: CampaignTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [smsGateways, setSmsGateways] = useState<SmsGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const isSms = channel === 'SMS';

  const [baileysReportCampaignId, setBaileysReportCampaignId] = useState<string | null>(null);
  const [baileysReportOpen, setBaileysReportOpen] = useState(false);

  const handleOpenBaileysReport = (campaignId: string) => {
    setBaileysReportCampaignId(campaignId);
    setBaileysReportOpen(true);
  };

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(12); // Padrão de 12 para grelha
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: addDays(new Date(), -30), to: new Date() });

  const filterOptions =
    channel === 'WHATSAPP'
      ? [
        { value: 'connection', label: 'Conexão WhatsApp' },
        { value: 'template', label: 'Modelo' },
      ]
      : [{ value: 'gateway', label: 'Gateway de SMS' }];

  const [filterType, setFilterType] = useState(filterOptions[0]!.value);
  const [selectedId, setSelectedId] = useState('all');
  const [view, setView] = useState<ViewType>('grid');

  const debouncedFilterType = useDebounce(filterType, 500);
  const debouncedSelectedId = useDebounce(selectedId, 500);
  const debouncedDateRange = useDebounce(dateRange, 500);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        channel,
        page: page.toString(),
        limit: limit.toString(),
      });
      if (debouncedDateRange?.from) params.set('startDate', debouncedDateRange.from.toISOString());
      if (debouncedDateRange?.to) params.set('endDate', debouncedDateRange.to.toISOString());

      if (debouncedFilterType === 'connection' && debouncedSelectedId !== 'all') params.set('connectionId', debouncedSelectedId);
      if (debouncedFilterType === 'template' && debouncedSelectedId !== 'all') params.set('templateId', debouncedSelectedId);
      if (debouncedFilterType === 'gateway' && debouncedSelectedId !== 'all') params.set('gatewayId', debouncedSelectedId);

      const response = await fetch(`/api/v1/campaigns?${params.toString()}`);
      if (!response.ok) throw new Error('Falha ao buscar campanhas.');

      const data = await response.json();

      if (Array.isArray(data.data)) {
        let filteredData = data.data;

        if (baileysOnly) {
          filteredData = data.data.filter((c: Campaign) => c.templateId === null);
        }

        setCampaigns(filteredData);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error("Formato de dados inesperado da API:", data);
        setCampaigns([]);
        setTotalPages(1);
      }

    } catch (error) {
      notify.error("Erro", (error as Error).message);
      setCampaigns([]); // Limpa os dados em caso de erro
    } finally {
      setLoading(false);
    }
  }, [notify, channel, page, limit, debouncedDateRange, debouncedFilterType, debouncedSelectedId, baileysOnly]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasActiveCampaigns = campaigns.some(c => ['SENDING', 'QUEUED', 'SCHEDULED'].includes(c.status));

  useEffect(() => {
    if (hasActiveCampaigns && !loading) {
      pollingIntervalRef.current = setInterval(() => {
        fetchCampaigns();
      }, 30000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [hasActiveCampaigns, loading, fetchCampaigns]);

  useEffect(() => {
    const fetchPrerequisites = async () => {
      try {
        const [connRes, smsRes, tplRes] = await Promise.all([
          fetch('/api/v1/connections'),
          fetch('/api/v1/sms-gateways'),
          fetch('/api/v1/message-templates'),
        ]);
        if (!connRes.ok || !smsRes.ok || !tplRes.ok) throw new Error('Falha ao carregar filtros.');
        const connData = await connRes.json();
        const smsData = await smsRes.json();
        const tplData = await tplRes.json();
        setConnections(connData);
        setSmsGateways(smsData);
        setAllTemplates(tplData);
      } catch (error) {
        notify.error('Erro', (error as Error).message);
      }
    };
    fetchPrerequisites();
  }, [notify]);


  const handleFilterTypeChange = (type: string) => {
    setFilterType(type);
    setSelectedId('all');
    setPage(1);
  };

  const handleCampaignDeleted = (campaignId: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="col-span-full flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (campaigns.length === 0) {
      // Only consider selectedId as a custom filter - dateRange has a default value
      const hasCustomFilters = debouncedSelectedId !== 'all';
      const createCampaignUrl = isSms ? '/sms' : (baileysOnly ? '/campaigns-baileys' : '/campaigns');
      return (
        <div className="col-span-full">
          <EmptyState
            icon={Megaphone}
            title="Nenhuma campanha encontrada"
            description={
              hasCustomFilters
                ? "Não encontramos campanhas com os filtros selecionados. Tente ajustar suas opções de filtro."
                : `Você ainda não criou nenhuma campanha de ${isSms ? 'SMS' : 'WhatsApp'}. Crie sua primeira campanha para começar a enviar mensagens em massa.`
            }
            actionLabel={!hasCustomFilters ? "Criar Campanha" : undefined}
            onAction={!hasCustomFilters ? () => router.push(createCampaignUrl) : undefined}
          />
        </div>
      );
    }

    if (view === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {campaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} onUpdate={fetchCampaigns} onDelete={handleCampaignDeleted} allTemplates={allTemplates} notify={notify} onOpenBaileysReport={handleOpenBaileysReport} />
          ))}
        </div>
      );
    }

    return (
      <div className="w-full border rounded-lg relative">
        <div className="w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Envio</TableHead>
                <TableHead>Enviadas</TableHead>
                {!isSms && <TableHead>Entregues</TableHead>}
                {!isSms && <TableHead>Lidas</TableHead>}
                {isSms && <TableHead>Falhas</TableHead>}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(campaign => {
                const statusKey = campaign.status as keyof typeof statusConfig;
                const status = statusConfig[statusKey] || statusConfig.Agendada;
                const campaignDate = campaign.sentAt || campaign.scheduledAt;
                const isSms = campaign.channel === 'SMS';
                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{campaign.name}</span>
                        <Badge variant="outline" className={cn("w-fit text-[9px] uppercase tracking-wider", isSms ? "border-white/20 text-white" : (!campaign.templateId ? "border-blue-500/50 text-blue-400 bg-blue-500/10" : "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"))}>
                          {isSms ? 'SMS' : (!campaign.templateId ? 'Baileys' : 'Oficial')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={status.variant} className={cn(status.className)}>{status.text}</Badge></TableCell>
                    <TableCell>{campaignDate ? new Date(campaignDate).toLocaleString('pt-BR') : '-'}</TableCell>
                    <TableCell>{campaign.sent}</TableCell>
                    {!isSms && <TableCell>{campaign.delivered}</TableCell>}
                    {!isSms && <TableCell>{campaign.read}</TableCell>}
                    {isSms && <TableCell>{campaign.failed}</TableCell>}
                    <TableCell className="text-right">
                      {campaign.templateId ? (
                        <Link href={`/campaigns/${campaign.id}/report`}>
                          <Button variant="outline" size="sm">Ver Relatório</Button>
                        </Link>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleOpenBaileysReport(campaign.id)}>Ver Relatório</Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  };


  return (
    <div className="space-y-4">
      <Card className="bg-black/5 dark:bg-black/40 border border-black/5 dark:border-white/5 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(0,0,0,0.5)] rounded-2xl">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
            <div className="xl:col-span-1">
              <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 block">Período</Label>
              <DateRangePicker onDateChange={setDateRange} initialDate={dateRange} />
            </div>
            <div className="grid grid-cols-2 gap-4 xl:col-span-2">
              <div>
                <Label htmlFor="filter-type" className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 block">Filtrar por</Label>
                <Select value={filterType} onValueChange={handleFilterTypeChange}>
                  <SelectTrigger id="filter-type">
                    <SelectValue placeholder="Selecione um tipo de filtro" />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filter-value" className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 block">Valor</Label>
                <Select value={selectedId} onValueChange={setSelectedId} disabled={filterType === 'all'}>
                  <SelectTrigger id="filter-value">
                    <SelectValue placeholder="Selecione um valor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {filterType === 'connection' && connections.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.config_name}</SelectItem>
                    ))}
                    {filterType === 'template' && allTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                    {filterType === 'gateway' && smsGateways.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-end justify-end gap-2">
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 block">Visão</Label>
                <div className="flex items-center gap-1 bg-black/5 dark:bg-black/50 p-1 rounded-xl border border-black/5 dark:border-white/10 shadow-inner">
                  <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", view === 'grid' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-muted-foreground hover:text-foreground dark:hover:text-white')} onClick={() => setView('grid')}>
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", view === 'table' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-muted-foreground hover:text-foreground dark:hover:text-white')} onClick={() => setView('table')}>
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4">
        {renderContent()}
      </div>

      {totalPages > 1 && campaigns.length > 0 && (
        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-sm text-muted-foreground">
              Página {page} de {totalPages}.
            </div>
            <Select value={limit.toString()} onValueChange={(value) => { setLimit(parseInt(value, 10)); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[12, 24, 48, 96].map(val => (
                  <SelectItem key={val} value={val.toString()}>{val} por página</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PaginationControls
            totalItems={totalPages * limit}
            pageSize={limit}
            currentPage={page}
            onPageChange={setPage}
          />
        </div>
      )}

      <BaileysReportModal
        campaignId={baileysReportCampaignId}
        open={baileysReportOpen}
        onOpenChange={setBaileysReportOpen}
      />
    </div>
  );
}
