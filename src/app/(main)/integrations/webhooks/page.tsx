'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useToast } from '@/hooks/use-toast';
import { WebhookDialog } from '@/components/integrations/webhook-dialog';
import {
  PlusCircle,
  Search,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Webhook,
  CheckCircle2,
  XCircle,
  Send,
} from 'lucide-react';

interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  conversation_created: 'Conversa Criada',
  conversation_updated: 'Conversa Atualizada',
  message_received: 'Msg Recebida',
  message_sent: 'Msg Enviada',
  lead_created: 'Lead Criado',
  lead_stage_changed: 'Estágio Alterado',
  sale_closed: 'Venda Fechada',
  meeting_scheduled: 'Reunião Agendada',
  campaign_sent: 'Campanha Enviada',
  campaign_completed: 'Campanha Concluída',
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function WebhooksPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookSubscription | null>(null);
  const [deleteWebhook, setDeleteWebhook] = useState<WebhookSubscription | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{
    data: WebhookSubscription[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>(
    `/api/v1/webhooks?search=${encodeURIComponent(search)}&page=${currentPage}&limit=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const filteredWebhooks = useMemo(() => {
    if (!data?.data) return [];

    return data.data.filter((webhook) => {
      if (statusFilter === 'active' && !webhook.active) return false;
      if (statusFilter === 'inactive' && webhook.active) return false;
      return true;
    });
  }, [data?.data, statusFilter]);

  const paginatedWebhooks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredWebhooks.slice(startIndex, endIndex);
  }, [filteredWebhooks, currentPage, pageSize]);

  const totalItems = filteredWebhooks.length;

  const handleOpenDialog = (webhook: WebhookSubscription | null) => {
    setEditingWebhook(webhook);
    setIsDialogOpen(true);
  };

  const handleDeleteWebhook = async () => {
    if (!deleteWebhook) return;

    try {
      const response = await fetch(`/api/v1/webhooks/${deleteWebhook.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar webhook');
      }

      toast({
        title: 'Webhook Deletado!',
        description: `O webhook "${deleteWebhook.name}" foi removido com sucesso.`,
      });

      mutate();
      setDeleteWebhook(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Deletar',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
      });
    }
  };

  const handleTestWebhook = async (webhook: WebhookSubscription) => {
    setTestingWebhookId(webhook.id);

    try {
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Este é um teste de webhook',
          webhookId: webhook.id,
          webhookName: webhook.name,
        },
      };

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'test-signature',
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        toast({
          title: 'Teste Enviado!',
          description: `O payload de teste foi enviado para ${webhook.url}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro no Teste',
          description: `O webhook retornou status ${response.status}`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro no Teste',
        description: 'Não foi possível enviar o teste para o webhook.',
      });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Webhooks</h1>
        <p className="text-muted-foreground">
          Configure webhooks para receber notificações em tempo real sobre eventos do sistema
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou URL..."
                className="pl-9 w-full"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => handleOpenDialog(null)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Webhook
          </Button>
        </CardHeader>

        <CardContent>
          <div className="w-full overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-destructive">
                      Erro ao carregar webhooks
                    </TableCell>
                  </TableRow>
                ) : paginatedWebhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        icon={Webhook}
                        title={search ? 'Nenhum webhook encontrado' : 'Nenhum webhook configurado'}
                        description={
                          search
                            ? 'Não encontramos webhooks com o termo de busca informado.'
                            : 'Configure webhooks para receber notificações em tempo real sobre eventos do sistema.'
                        }
                        actionLabel={!search ? 'Criar Webhook' : undefined}
                        onAction={!search ? () => handleOpenDialog(null) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedWebhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-mono cursor-help">
                                {truncateUrl(webhook.url)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs break-all">{webhook.url}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {webhook.events.slice(0, 2).map((event) => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {EVENT_LABELS[event] || event}
                            </Badge>
                          ))}
                          {webhook.events.length > 2 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs cursor-help">
                                    +{webhook.events.length - 2}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    {webhook.events.slice(2).map((event) => (
                                      <div key={event} className="text-xs">
                                        {EVENT_LABELS[event] || event}
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {webhook.active ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleTestWebhook(webhook)}
                              disabled={testingWebhookId === webhook.id}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {testingWebhookId === webhook.id ? 'Enviando...' : 'Testar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenDialog(webhook)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteWebhook(webhook)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalItems > pageSize && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * pageSize) + 1} a{' '}
                  {Math.min(currentPage * pageSize, totalItems)} de {totalItems} webhooks
                </div>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value, 10));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size} por página
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PaginationControls
                totalItems={totalItems}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <WebhookDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        webhook={editingWebhook}
        onSuccess={() => {
          mutate();
          setEditingWebhook(null);
        }}
      />

      <AlertDialog
        open={!!deleteWebhook}
        onOpenChange={(open) => !open && setDeleteWebhook(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O webhook &quot;{deleteWebhook?.name}&quot; será
              excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWebhook}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
