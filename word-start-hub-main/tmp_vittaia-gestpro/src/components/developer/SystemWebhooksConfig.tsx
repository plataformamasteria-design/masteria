import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

interface WebhookConfig {
  id: string;
  name: string;
  description: string;
  webhook_type: string;
  url: string;
  active: boolean;
}

export const SystemWebhooksConfig = () => {
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhooks, setWebhooks] = useState<{
    followUp: WebhookConfig | null;
    sent: WebhookConfig | null;
  }>({
    followUp: null,
    sent: null,
  });

  useEffect(() => {
    fetchWebhooks();

    // Realtime subscription scoped by organization
    const orgFilter = currentOrganization?.id
      ? `organization_id=eq.${currentOrganization.id}`
      : undefined;
    
    const channel = supabase
      .channel("webhook-configs-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "webhook_configs",
          ...(orgFilter ? { filter: orgFilter } : {}),
        },
        () => {
          fetchWebhooks();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id]);

  const fetchWebhooks = async () => {
    try {
      console.log("Fetching webhooks...");
      
      if (!currentOrganization?.id) {
        console.log("No organization selected");
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("webhook_configs")
        .select("*")
        .in("webhook_type", ["follow_up", "sent"])
        .eq("organization_id", currentOrganization.id);

      console.log("Webhooks data:", data);
      console.log("Webhooks error:", error);

      if (error) throw error;

      const followUpWebhook = data?.find((w) => w.webhook_type === "follow_up") || null;
      const sentWebhook = data?.find((w) => w.webhook_type === "sent") || null;

      console.log("Follow Up Webhook:", followUpWebhook);
      console.log("Sent Webhook:", sentWebhook);

      setWebhooks({
        followUp: followUpWebhook,
        sent: sentWebhook,
      });
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações de webhooks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (type: "follow_up" | "sent") => {
    try {
      setSaving(true);
      const webhook = type === "follow_up" ? webhooks.followUp : webhooks.sent;

      if (!webhook) return;

      const { error } = await supabase
        .from("webhook_configs")
        .update({
          url: webhook.url,
          active: webhook.active,
        })
        .eq("id", webhook.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Webhook atualizado com sucesso",
      });
    } catch (error) {
      console.error("Error saving webhook:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao salvar webhook",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateWebhook = (type: "follow_up" | "sent", field: "url" | "active", value: string | boolean) => {
    setWebhooks((prev) => {
      const webhook = type === "follow_up" ? prev.followUp : prev.sent;
      if (!webhook) return prev;

      return {
        ...prev,
        [type === "follow_up" ? "followUp" : "sent"]: {
          ...webhook,
          [field]: value,
        },
      };
    });
  };

  if (loading) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Follow Up Webhook */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="gradient-text">Follow Up Webhook</CardTitle>
          <CardDescription>Webhook usado para enviar mensagens automatizadas de follow-up aos leads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhooks.followUp ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="followup-url">URL do Webhook</Label>
                <Input
                  id="followup-url"
                  value={webhooks.followUp.url}
                  onChange={(e) => updateWebhook("follow_up", "url", e.target.value)}
                  placeholder="https://workflow-priscilla.agenciamdsolution.com/webhook/priscila-follow-up"
                />
                <p className="text-xs text-muted-foreground">
                  Esta URL será chamada quando o sistema precisar enviar mensagens de follow-up
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border border-border/40 rounded-lg bg-background/50">
                <div className="space-y-0.5">
                  <Label htmlFor="followup-active">Webhook Ativo</Label>
                  <p className="text-sm text-muted-foreground">Ativar/desativar o envio de mensagens de follow-up</p>
                </div>
                <Switch
                  id="followup-active"
                  checked={webhooks.followUp.active}
                  onCheckedChange={(checked) => updateWebhook("follow_up", "active", checked)}
                />
              </div>

              <Button onClick={() => handleSave("follow_up")} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Webhook não encontrado. Execute a inicialização do projeto.</p>
          )}
        </CardContent>
      </Card>

      {/* Message Sent Webhook */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="gradient-text">Message Sent Webhook</CardTitle>
          <CardDescription>
            Webhook chamado quando mensagens são enviadas (para notificações ou integrações)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhooks.sent ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="sent-url">URL do Webhook</Label>
                <Input
                  id="sent-url"
                  value={webhooks.sent.url}
                  onChange={(e) => updateWebhook("sent", "url", e.target.value)}
                  placeholder="https://workflow-priscilla.agenciamdsolution.com/webhook/priscila-sent"
                />
                <p className="text-xs text-muted-foreground">
                  Esta URL será chamada sempre que uma mensagem for enviada pelo sistema
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border border-border/40 rounded-lg bg-background/50">
                <div className="space-y-0.5">
                  <Label htmlFor="sent-active">Webhook Ativo</Label>
                  <p className="text-sm text-muted-foreground">Ativar/desativar notificações de mensagens enviadas</p>
                </div>
                <Switch
                  id="sent-active"
                  checked={webhooks.sent.active}
                  onCheckedChange={(checked) => updateWebhook("sent", "active", checked)}
                />
              </div>

              <Button onClick={() => handleSave("sent")} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Webhook não encontrado. Execute a inicialização do projeto.</p>
          )}
        </CardContent>
      </Card>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">ℹ️ Como Funcionam os Webhooks</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <li>
            <strong>Follow Up:</strong> Usado pelo scheduler automático para enviar mensagens de follow-up programadas
            aos leads
          </li>
          <li>
            <strong>Message Sent:</strong> Chamado quando qualquer mensagem é enviada, útil para integrações e
            notificações
          </li>
          <li className="pt-2 border-t border-blue-300 dark:border-blue-700">
            💡 As URLs podem ser personalizadas para suas próprias integrações ou APIs
          </li>
        </ul>
      </div>
    </div>
  );
};
