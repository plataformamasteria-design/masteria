'use client';

import React, { useState, useEffect } from 'react';
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
import { EventHistoryDropdown } from '@/components/webhooks/event-history-dropdown';
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
import {
  MoreHorizontal,
  PlusCircle,
  Trash2,
  Copy,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
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
import { AutoApproachConfig } from '@/components/settings/auto-approach-config';

interface IncomingWebhookConfig {
  id: string;
  name: string;
  source: string;
  secret: string;
  secretMasked: string;
  webhookUrl: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const sources = [
  { value: 'grapfy', label: 'Grapfy' },
  { value: 'kommo', label: 'Kommo (AmoCRM)' },
  { value: 'custom', label: 'Customizado' },
  { value: 'pipedrive', label: 'Pipedrive' },
  { value: 'hubspot', label: 'HubSpot' },
];

export function IncomingWebhooksManager() {
  const { toast } = useToast();
  const notifier = createToastNotifier(toast);
  const [configs, setConfigs] = useState<IncomingWebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [source, setSource] = useState('grapfy');

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/webhooks/incoming');
      const data = await response.json();
      setConfigs(data.data || []);
    } catch (error) {
      notifier.error('Erro ao carregar configurações de webhook');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!name.trim()) {
      notifier.warning('Nome do webhook é obrigatório');
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch('/api/v1/webhooks/incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, source }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar webhook');
      }

      setConfigs([data, ...configs]);
      setIsDialogOpen(false);
      setName('');
      setSource('grapfy');
      notifier.success('Webhook criado com sucesso!');
    } catch (error) {
      notifier.error(
        error instanceof Error ? error.message : 'Erro ao criar webhook'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notifier.success('Copiado para a área de transferência');
  };

  const getSourceLabel = (source: string) => {
    return sources.find(s => s.value === source)?.label || source;
  };

  const _formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleDeleteWebhook = async (webhookId: string, webhookName: string) => {
    try {
      const response = await fetch('/api/v1/webhooks/incoming', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: webhookId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao deletar webhook');
      }

      // Remove from local state
      setConfigs(configs.filter(config => config.id !== webhookId));
      notifier.success(`Webhook "${webhookName}" deletado com sucesso`);
    } catch (error) {
      notifier.error(
        error instanceof Error ? error.message : 'Erro ao deletar webhook'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Webhooks de Entrada</CardTitle>
            <CardDescription>
              Receba eventos de plataformas externas (Grapfy, Kommo, etc)
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button onClick={() => setIsDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Webhook
            </Button>

            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Adicionar Webhook de Entrada</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-name">Nome do Webhook</Label>
                  <Input
                    id="webhook-name"
                    placeholder="ex: Integração Grapfy"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook-source">Plataforma de Origem</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger id="webhook-source" disabled={isCreating}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={handleCreateWebhook}
                  disabled={isCreating || !name.trim()}
                >
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {configs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Nenhum webhook configurado ainda
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar Primeiro Webhook
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Secret</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map(config => (
                    <React.Fragment key={config.id}>
                      <TableRow>
                        <TableCell className="font-medium">
                          <button
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                            onClick={() => setExpandedWebhookId(
                              expandedWebhookId === config.id ? null : config.id
                            )}
                          >
                            {expandedWebhookId === config.id ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {config.name}
                          </button>
                        </TableCell>
                        <TableCell>{getSourceLabel(config.source)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-xs">
                              {config.webhookUrl}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(config.webhookUrl)}
                              title="Copiar URL"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <EventHistoryDropdown webhookConfigId={config.id} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {selectedSecret === config.id
                                ? config.secret
                                : config.secretMasked}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setSelectedSecret(
                                  selectedSecret === config.id ? null : config.id
                                )
                              }
                              title={
                                selectedSecret === config.id
                                  ? 'Ocultar'
                                  : 'Mostrar'
                              }
                            >
                              {selectedSecret === config.id ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(config.secret)}
                              title="Copiar Secret"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(config.webhookUrl)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar URL
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(config.secret)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar Secret
                              </DropdownMenuItem>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={e => e.preventDefault()}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Deletar
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Deletar Webhook?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O webhook{' '}
                                      <strong>{config.name}</strong> será
                                      deletado permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteWebhook(config.id, config.name)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Deletar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {/* Auto-Approach Config (expandable) */}
                      {expandedWebhookId === config.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="p-0">
                            <div className="p-4 bg-muted/30">
                              <AutoApproachConfig
                                webhookId={config.id}
                                webhookName={config.name}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-base">Como Configurar em Grapfy?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            1. Crie um webhook aqui e copie a <strong>URL do Webhook</strong>
          </p>
          <p>
            2. Entre em Grapfy → Integrações → Webhooks
          </p>
          <p>
            3. Cole a URL no campo de webhook
          </p>
          <p>
            4. Selecione os eventos que deseja receber (leads criados,
            atualizados, etc)
          </p>
          <p>
            5. Pronto! Agora eventos de Grapfy chegarão em tempo real
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
