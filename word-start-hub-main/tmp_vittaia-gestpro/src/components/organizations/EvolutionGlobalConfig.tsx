import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Loader2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GlobalConfig {
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_webhook_url: string;
}

export function EvolutionGlobalConfig() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [config, setConfig] = useState<GlobalConfig>({
    evolution_api_url: '',
    evolution_api_key: '',
    evolution_webhook_url: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_webhook_url']);

      if (error) throw error;

      const configMap: GlobalConfig = {
        evolution_api_url: '',
        evolution_api_key: '',
        evolution_webhook_url: '',
      };

      data?.forEach((item: { key: string; value: string | null }) => {
        if (item.key in configMap) {
          configMap[item.key as keyof GlobalConfig] = item.value || '';
        }
      });

      setConfig(configMap);
    } catch (error) {
      console.error('Error loading global config:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações globais.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert each config value (insert if not exists, update if exists)
      const updates = [
        { key: 'evolution_api_url', value: config.evolution_api_url || null },
        { key: 'evolution_api_key', value: config.evolution_api_key || null },
        { key: 'evolution_webhook_url', value: config.evolution_webhook_url || null },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('global_config')
          .upsert(
            { 
              key: update.key, 
              value: update.value, 
              updated_at: new Date().toISOString() 
            },
            { onConflict: 'key' }
          );

        if (error) throw error;
      }

      toast({
        title: 'Configurações salvas',
        description: 'Evolution API global atualizada com sucesso.',
      });
    } catch (error) {
      console.error('Error saving global config:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-green-500/30 bg-card">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Settings className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Configuração Evolution API (Global)</CardTitle>
                  <CardDescription>
                    URL e API Key compartilhadas por todas as organizações
                  </CardDescription>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="global-evolution-url">URL da Evolution API</Label>
                  <Input
                    id="global-evolution-url"
                    value={config.evolution_api_url}
                    onChange={(e) => setConfig(prev => ({ ...prev, evolution_api_url: e.target.value }))}
                    placeholder="https://evolution.seudominio.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="global-evolution-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="global-evolution-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={config.evolution_api_key}
                      onChange={(e) => setConfig(prev => ({ ...prev, evolution_api_key: e.target.value }))}
                      placeholder="Sua API Key da Evolution"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="global-webhook-url">URL do Webhook (Template)</Label>
                  <Input
                    id="global-webhook-url"
                    value={config.evolution_webhook_url}
                    onChange={(e) => setConfig(prev => ({ ...prev, evolution_webhook_url: e.target.value }))}
                    placeholder="https://workflow.exemplo.com/webhook/{instance}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use <code className="bg-muted px-1 rounded">{'{instance}'}</code> para inserir o nome da instância automaticamente.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar Configuração Global
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
