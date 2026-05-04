

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { MoreHorizontal, PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { Webhook } from '@/lib/types';

const eventLabels: Record<string, string> = {
  'contact.created': 'Quando um novo contato for criado',
  'lead.updated': 'Quando um lead for atualizado',
  'sale.completed': 'Quando uma venda for concluída',
  'email.sent': 'Quando um email for enviado',
  'task.completed': 'Quando uma tarefa for concluída',
};

const maskUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.length > 4) {
        const maskedPart = '...' + lastPart.slice(-4);
        pathParts[pathParts.length - 1] = maskedPart;
        urlObj.pathname = pathParts.join('/');
      }
    }
    return urlObj.toString().replace(urlObj.search, ''); // remove query params for display
  } catch (error) {
    return url;
  }
};

export function WebhooksManager(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetchWebhooks = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/webhooks');
      if (!res.ok) throw new Error('Falha ao carregar webhooks.');
      const data = await res.json();
      setWebhooks(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      notify.error('Erro', error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleOpenModal = (webhook: Webhook | null): void => {
    setEditingWebhook(webhook);
    setIsModalOpen(true);
  }

  const handleSaveWebhook = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const webhookData = {
      name: formData.get('name') as string,
      url: formData.get('url') as string,
      events: [formData.get('event') as string],
    };

    const isEditing = !!editingWebhook;
    const url = isEditing ? `/api/v1/webhooks/${editingWebhook.id}` : '/api/v1/webhooks';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao salvar o webhook.');
      }

      notify.success(`Webhook ${isEditing ? 'Atualizado' : 'Criado'}!`, `O webhook "${webhookData.name}" foi salvo.`);
      await fetchWebhooks();

    } catch (error) {
      notify.error('Erro ao Salvar', error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setIsModalOpen(false);
      setEditingWebhook(null);
    }
  };

  const handleToggleActive = async (webhookId: string, active: boolean): Promise<void> => {
    const originalWebhooks = [...webhooks];
    setWebhooks(webhooks.map(wh => wh.id === webhookId ? { ...wh, active } : wh));

    try {
      const response = await fetch(`/api/v1/webhooks/${webhookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      if (!response.ok) throw new Error('Falha ao atualizar o status.');
    } catch (error) {
      notify.error('Erro', error instanceof Error ? error.message : 'Não foi possível alterar o status.');
      setWebhooks(originalWebhooks);
    }
  }

  const handleDeleteWebhook = async (webhookId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/v1/webhooks/${webhookId}`, {
        method: 'DELETE',
      });
      if (response.status !== 204) throw new Error('Falha ao excluir o webhook.');

      setWebhooks(webhooks.filter(wh => wh.id !== webhookId));
      notify.success('Webhook Excluído!');
    } catch (error) {
      notify.error('Erro ao Excluir', error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Webhooks de Saída</CardTitle>
            <CardDescription>
              Notifique as suas outras aplicações sobre eventos que acontecem no Master IA Oficial.
            </CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => handleOpenModal(null)}>
            <PlusCircle className="mr-2" />
            Adicionar Webhook
          </Button>
        </CardHeader>
        <CardContent>
          <div className="w-full border rounded-lg relative">
            <div className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Evento Gatilho</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : webhooks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Nenhum webhook configurado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    webhooks.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-medium">{webhook.name}</TableCell>
                        <TableCell>{webhook.events?.[0] ? (eventLabels[webhook.events[0]] || webhook.events[0]) : 'Evento não configurado'}</TableCell>
                        <TableCell className="font-mono text-xs">{maskUrl(webhook.url)}</TableCell>
                        <TableCell>
                          <Switch checked={webhook.active} onCheckedChange={(checked) => handleToggleActive(webhook.id, checked)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onSelect={() => handleOpenModal(webhook)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir o webhook &quot;{webhook.name}&quot;? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteWebhook(webhook.id)}>Sim, Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Editar Webhook' : 'Configurar Webhook'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveWebhook}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-name">Nome do Webhook</Label>
                <Input id="webhook-name" name="name" placeholder="Ex: Enviar novos contatos para o CRM" defaultValue={editingWebhook?.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL de Destino</Label>
                <Input id="webhook-url" name="url" placeholder="https://api.seusistema.com/..." defaultValue={editingWebhook?.url} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-event">Evento Gatilho</Label>
                <Select name="event" defaultValue={editingWebhook?.events?.[0] || 'contact.created'}>
                  <SelectTrigger id="webhook-event">
                    <SelectValue placeholder="Selecione um evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact.created">Quando um novo contato for criado</SelectItem>
                    <SelectItem value="lead.updated">Quando um lead for atualizado</SelectItem>
                    <SelectItem value="sale.completed">Quando uma venda for concluída</SelectItem>
                    <SelectItem value="email.sent">Quando um email for enviado</SelectItem>
                    <SelectItem value="task.completed">Quando uma tarefa for concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar Webhook</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
