'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Copy, Eye, EyeOff } from 'lucide-react';

const WEBHOOK_EVENTS = [
  { id: 'conversation_created', label: 'Conversa Criada' },
  { id: 'conversation_updated', label: 'Conversa Atualizada' },
  { id: 'message_received', label: 'Mensagem Recebida' },
  { id: 'message_sent', label: 'Mensagem Enviada' },
  { id: 'lead_created', label: 'Lead Criado' },
  { id: 'lead_stage_changed', label: 'Estágio do Lead Alterado' },
  { id: 'sale_closed', label: 'Venda Fechada' },
  { id: 'meeting_scheduled', label: 'Reunião Agendada' },
  { id: 'campaign_sent', label: 'Campanha Enviada' },
  { id: 'campaign_completed', label: 'Campanha Concluída' },
] as const;

interface WebhookData {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

interface WebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: WebhookData | null;
  onSuccess: () => void;
}

export function WebhookDialog({
  open,
  onOpenChange,
  webhook,
  onSuccess,
}: WebhookDialogProps) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [secret, setSecret] = useState('');

  useEffect(() => {
    if (webhook) {
      setName(webhook.name);
      setUrl(webhook.url);
      setSelectedEvents(webhook.events || []);
      setActive(webhook.active);
      setSecret(webhook.secret);
    } else {
      setName('');
      setUrl('');
      setSelectedEvents([]);
      setActive(true);
      setSecret('');
    }
  }, [webhook, open]);

  const handleToggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId]
    );
  };

  const handleCopySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      notify.success('Secret copiado!', 'O secret foi copiado para a área de transferência.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      notify.error('Erro de validação', 'O nome do webhook é obrigatório.');
      return;
    }

    if (!url.trim()) {
      notify.error('Erro de validação', 'A URL do webhook é obrigatória.');
      return;
    }

    try {
      new URL(url);
    } catch {
      notify.error('Erro de validação', 'Por favor, insira uma URL válida.');
      return;
    }

    if (selectedEvents.length === 0) {
      notify.error('Erro de validação', 'Selecione pelo menos um evento.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name,
        url,
        events: selectedEvents,
        active,
      };

      const response = await fetch(
        webhook ? `/api/v1/webhooks/${webhook.id}` : '/api/v1/webhooks',
        {
          method: webhook ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar webhook');
      }

      const data = response.status === 204 ? null : await response.json();

      notify.success(webhook ? 'Webhook Atualizado!' : 'Webhook Criado!', `O webhook "${name}" foi salvo com sucesso.`);

      if (!webhook && data?.secret) {
        setSecret(data.secret);
        setShowSecret(true);
      } else {
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      notify.error('Erro ao Salvar', error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (secret && !webhook) {
      setSecret('');
      setShowSecret(false);
      onSuccess();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {webhook ? 'Editar Webhook' : 'Criar Novo Webhook'}
          </DialogTitle>
        </DialogHeader>

        {secret && !webhook ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4">
              <h3 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                ⚠️ Importante: Guarde o Secret
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                Este secret será usado para validar as requisições do webhook. Guarde-o em
                um local seguro, pois não será possível visualizá-lo novamente.
              </p>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Secret do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook-secret"
                    value={secret}
                    readOnly
                    type={showSecret ? 'text' : 'password'}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopySecret}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Nome *</Label>
              <Input
                id="webhook-name"
                placeholder="Ex: Integração Zapier"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL *</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://exemplo.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                A URL que receberá os eventos do webhook
              </p>
            </div>

            <div className="space-y-3">
              <Label>Eventos *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-lg p-4 max-h-64 overflow-y-auto">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-${event.id}`}
                      checked={selectedEvents.includes(event.id)}
                      onCheckedChange={() => handleToggleEvent(event.id)}
                    />
                    <label
                      htmlFor={`event-${event.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {event.label}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione os eventos que você deseja receber
              </p>
            </div>

            <div className="flex items-center space-x-2 py-2">
              <Switch
                id="webhook-active"
                checked={active}
                onCheckedChange={setActive}
              />
              <Label htmlFor="webhook-active" className="cursor-pointer">
                Webhook ativo
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : webhook ? 'Atualizar' : 'Criar Webhook'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
