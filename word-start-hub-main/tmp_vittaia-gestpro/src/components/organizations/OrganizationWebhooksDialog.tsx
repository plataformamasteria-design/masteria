import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Webhook, RefreshCw, Loader2, Smartphone, CheckCircle2, XCircle, Circle, MessageSquareText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WebhookConfig {
  id?: string;
  name: string;
  url: string;
  headers: Record<string, string>;
  active: boolean;
}

interface OrganizationWebhooksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
}

export function OrganizationWebhooksDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: OrganizationWebhooksDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  const [receivedWebhook, setReceivedWebhook] = useState<WebhookConfig>({
    name: 'Webhook Mensagens Recebidas (I.A)',
    url: '',
    headers: {},
    active: true,
  });

  const [receivedHeaders, setReceivedHeaders] = useState('');

  // Instance name field and status
  const [instanceName, setInstanceName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown' | 'no_config'>('unknown');
  const [hasGlobalConfig, setHasGlobalConfig] = useState(false);

  useEffect(() => {
    if (open && organizationId) {
      fetchWebhooks();
    }
  }, [open, organizationId]);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      // Fetch webhooks
      const { data, error } = await (supabase as any)
        .from('webhook_configs')
        .select('*')
        .eq('organization_id', organizationId);

      if (error) throw error;

      const received = data?.find(w => w.webhook_type === 'received');

      if (received) {
        setReceivedWebhook({
          id: received.id,
          name: received.name,
          url: received.url,
          headers: (received.headers as Record<string, string>) || {},
          active: received.active,
        });
        setReceivedHeaders(JSON.stringify(received.headers || {}, null, 2));
      } else {
        setReceivedWebhook({ name: 'Webhook Mensagens Recebidas (I.A)', url: '', headers: {}, active: true });
        setReceivedHeaders('{}');
      }

      // Fetch organization instance_name and slug
      const { data: orgData, error: orgError } = await (supabase as any)
        .from('organizations')
        .select('instance_name, slug')
        .eq('id', organizationId)
        .single();

      if (!orgError && orgData) {
        setInstanceName(orgData.instance_name || '');
        setOrgSlug(orgData.slug || '');
      }

      // Check if global Evolution API is configured
      const { data: globalConfig } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['evolution_api_url', 'evolution_api_key']);

      const hasUrl = globalConfig?.some((c: { key: string; value: string | null }) => c.key === 'evolution_api_url' && c.value);
      const hasKey = globalConfig?.some((c: { key: string; value: string | null }) => c.key === 'evolution_api_key' && c.value);
      
      if (hasUrl && hasKey) {
        setHasGlobalConfig(true);
        // Check connection status
        await checkConnectionStatus();
      } else {
        setHasGlobalConfig(false);
        setConnectionStatus('no_config');
      }
    } catch (error) {
      console.error('Erro ao carregar webhooks:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações de webhook.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: { action: 'status', organization_id: organizationId },
      });
      const res = { ok: !error, json: async () => data };

      if (res.ok) {
        const data = await res.json();
        setConnectionStatus(data.connected ? 'connected' : 'disconnected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
      setConnectionStatus('unknown');
    } finally {
      setCheckingStatus(false);
    }
  };

  const parseHeaders = (headersStr: string): Record<string, string> => {
    try {
      return JSON.parse(headersStr || '{}');
    } catch {
      return {};
    }
  };

  const saveWebhook = async (
    webhook: WebhookConfig,
    webhookType: 'sent' | 'follow_up' | 'received',
    headersStr: string
  ) => {
    const headers = parseHeaders(headersStr);

    if (webhook.id) {
      // Atualizar existente
      const { error } = await supabase
        .from('webhook_configs')
        .update({
          name: webhook.name,
          url: webhook.url,
          headers,
          active: webhook.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', webhook.id);

      if (error) throw error;
    } else if (webhook.url) {
      // Criar novo
      const { error } = await (supabase as any)
        .from('webhook_configs')
        .insert({
          organization_id: organizationId,
          webhook_type: webhookType,
          event_type: webhookType,
          name: webhook.name,
          url: webhook.url,
          headers,
          active: webhook.active,
        });

      if (error) throw error;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWebhook(receivedWebhook, 'received', receivedHeaders);

      // Save instance_name to organization
      const { error: orgError } = await (supabase as any)
        .from('organizations')
        .update({
          instance_name: instanceName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);

      if (orgError) throw orgError;

      toast({
        title: 'Configurações salvas',
        description: 'Webhooks e nome da instância atualizados com sucesso.',
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = () => {
    if (checkingStatus) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'no_config':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Circle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    if (checkingStatus) return 'Verificando...';
    switch (connectionStatus) {
      case 'connected':
        return 'Conectado';
      case 'disconnected':
        return 'Desconectado';
      case 'no_config':
        return 'API Global não configurada';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Configurar Integrações
          </DialogTitle>
          <DialogDescription>
            Configure webhooks e instância WhatsApp para <strong>{organizationName}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Webhook de Mensagens Recebidas (I.A) */}
            <div className="space-y-4 p-4 border rounded-lg border-blue-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-blue-500" />
                  <h3 className="font-semibold">Webhook Mensagens Recebidas (I.A)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="received-active" className="text-sm">Ativo</Label>
                  <Switch
                    id="received-active"
                    checked={receivedWebhook.active}
                    onCheckedChange={(checked) => setReceivedWebhook(prev => ({ ...prev, active: checked }))}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Recebe mensagens do WhatsApp para processamento pelo agente de I.A
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="received-name">Nome</Label>
                <Input
                  id="received-name"
                  value={receivedWebhook.name}
                  onChange={(e) => setReceivedWebhook(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do webhook"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="received-url">URL (n8n)</Label>
                <Input
                  id="received-url"
                  value={receivedWebhook.url}
                  onChange={(e) => setReceivedWebhook(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://workflow.exemplo.com/webhook/MeuAgente"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="received-headers">Headers (JSON)</Label>
                <Textarea
                  id="received-headers"
                  value={receivedHeaders}
                  onChange={(e) => setReceivedHeaders(e.target.value)}
                  placeholder='{"Authorization": "Bearer token"}'
                  className="font-mono text-sm"
                  rows={3}
                />
              </div>
            </div>


            

            {/* WhatsApp Instance Name */}
            <div className="space-y-4 p-4 border rounded-lg border-green-500/30">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold">WhatsApp (Evolution API)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure o nome da instância WhatsApp para esta organização
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="instance-name">Nome da Instância</Label>
                <div className="flex gap-2">
                  <Input
                    id="instance-name"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder={orgSlug || 'nome-da-instancia'}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={checkConnectionStatus}
                    disabled={checkingStatus || !hasGlobalConfig}
                    title="Verificar status"
                  >
                    {checkingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se vazio, será usado: <code className="bg-muted px-1 rounded">{orgSlug}</code>
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                {getStatusIcon()}
                <span className="text-sm font-medium">Status: {getStatusText()}</span>
              </div>

              {!hasGlobalConfig && (
                <p className="text-xs text-amber-500">
                  ⚠️ Configure a Evolution API Global na página de Organizações para usar o WhatsApp.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
