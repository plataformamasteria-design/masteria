import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getCurrentUserOrganizationId } from "@/lib/organization-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Webhook, Copy, Edit2, Trash2, Eye, Plus, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  description: string | null;
  active: boolean;
  webhook_type: string;
  headers: any;
  created_at: string;
  updated_at: string;
}

const webhookSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  url: z.string().url("URL inválida").startsWith("https://", "URL deve começar com https://"),
  description: z.string().optional(),
  webhook_type: z.string().min(1, "Tipo é obrigatório"),
  headers: z.string().optional(),
});

type WebhookFormData = z.infer<typeof webhookSchema>;

export function WebhookManager() {
  const { currentOrganization } = useOrganization();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<WebhookConfig | null>(null);
  const [previewDialog, setPreviewDialog] = useState<WebhookConfig | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
  });

  useEffect(() => {
    loadWebhooks();
  }, [currentOrganization?.id]);

  const loadWebhooks = async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from("webhook_configs")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .not('webhook_type', 'in', '(follow_up,sent)')
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error("Error loading webhooks:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar webhooks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("webhook_configs")
        .update({ active: !currentActive })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Webhook ${!currentActive ? "ativado" : "desativado"}`,
      });

      loadWebhooks();
    } catch (error) {
      console.error("Error toggling webhook:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar webhook",
        variant: "destructive",
      });
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({
      title: "URL copiada!",
      description: "URL copiada para a área de transferência",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEditDialog = (webhook: WebhookConfig) => {
    setEditDialog(webhook);
    reset({
      name: webhook.name,
      url: webhook.url,
      description: webhook.description || "",
      webhook_type: webhook.webhook_type,
      headers: JSON.stringify(webhook.headers, null, 2),
    });
  };

  const openAddDialog = () => {
    setAddDialog(true);
    reset({
      name: "",
      url: "",
      description: "",
      webhook_type: "custom",
      headers: "{}",
    });
  };

  const onSubmit = async (data: WebhookFormData) => {
    try {
      let headers = {};
      if (data.headers) {
        try {
          headers = JSON.parse(data.headers);
        } catch {
          toast({
            title: "Erro",
            description: "Headers JSON inválido",
            variant: "destructive",
          });
          return;
        }
      }

      if (editDialog) {
        // Update
        const { error } = await supabase
          .from("webhook_configs")
          .update({
            name: data.name,
            url: data.url,
            description: data.description || null,
            webhook_type: data.webhook_type,
            headers,
          })
          .eq("id", editDialog.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Webhook atualizado com sucesso",
        });
      } else {
        // Create
        const organizationId = await getCurrentUserOrganizationId();
        
        const { error } = await (supabase as any)
          .from("webhook_configs")
          .insert([{
            name: data.name,
            url: data.url,
            description: data.description || null,
            webhook_type: data.webhook_type,
            event_type: data.webhook_type,
            headers,
            organization_id: organizationId,
            active: true,
          }]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Webhook criado com sucesso",
        });
      }

      setEditDialog(null);
      setAddDialog(false);
      loadWebhooks();
    } catch (error) {
      console.error("Error saving webhook:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar webhook",
        variant: "destructive",
      });
    }
  };

  const deleteWebhook = async () => {
    if (!deleteDialog) return;

    try {
      const { error } = await supabase
        .from("webhook_configs")
        .delete()
        .eq("id", deleteDialog);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Webhook removido com sucesso",
      });

      setDeleteDialog(null);
      loadWebhooks();
    } catch (error) {
      console.error("Error deleting webhook:", error);
      toast({
        title: "Erro",
        description: "Falha ao remover webhook",
        variant: "destructive",
      });
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      follow_up: { color: "bg-green-500", label: "Follow-up" },
      sent: { color: "bg-purple-500", label: "Message Sent" },
      notification: { color: "bg-blue-500", label: "Notificação" },
      integration: { color: "bg-orange-500", label: "Integração" },
      custom: { color: "bg-gray-500", label: "Customizado" },
    };
    const variant = variants[type] || variants.custom;
    return <Badge className={`${variant.color} text-white`}>{variant.label}</Badge>;
  };

  const getExamplePayload = (type: string) => {
    const examples: Record<string, any> = {
      follow_up: {
        nome_lead: "João Silva",
        numero_lead: "5511999999999",
        mensagem: "Olá! Ainda está interessado?",
        etiqueta_lead: "Follow-up Dia 2",
      },
      sent: {
        chat_id: "uuid-do-chat",
        message: "Mensagem enviada com sucesso",
        timestamp: new Date().toISOString(),
      },
      notification: {
        event: "new_message",
        chat_id: "uuid-do-chat",
        message: "Nova mensagem recebida",
      },
      integration: {
        action: "sync_data",
        data: {
          lead_id: "123",
          status: "active"
        },
      },
      custom: {
        data: "seu payload customizado aqui",
      },
    };
    return JSON.stringify(examples[type] || examples.custom, null, 2);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando webhooks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""} configurado{webhooks.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={openAddDialog} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum webhook configurado ainda.
              <br />
              Clique em "Adicionar Webhook" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 max-w-full">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="relative">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{webhook.name}</h3>
                      {getTypeBadge(webhook.webhook_type)}
                    </div>
                    {webhook.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{webhook.description}</p>
                    )}
                  </div>
                  <Switch
                    checked={webhook.active}
                    onCheckedChange={() => toggleActive(webhook.id, webhook.active)}
                  />
                </div>

                <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
                  <code className="flex-1 truncate text-xs">{webhook.url}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyUrl(webhook.url, webhook.id)}
                    className="h-6 w-6 p-0"
                  >
                    {copiedId === webhook.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    Atualizado {new Date(webhook.updated_at).toLocaleDateString()}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewDialog(webhook)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(webhook)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDialog(webhook.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Add Dialog */}
      <Dialog open={!!editDialog || addDialog} onOpenChange={(open) => {
        if (!open) {
          setEditDialog(null);
          setAddDialog(false);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog ? "Editar Webhook" : "Adicionar Webhook"}</DialogTitle>
            <DialogDescription>
              Configure a URL e parâmetros do webhook. Todas as chamadas usarão esta configuração.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" {...register("name")} placeholder="Follow-up Arrais" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="url">URL</Label>
              <Input id="url" {...register("url")} placeholder="https://..." />
              {errors.url && <p className="text-xs text-destructive mt-1">{errors.url.message}</p>}
            </div>

            <div>
              <Label htmlFor="webhook_type">Tipo</Label>
              <Select
                defaultValue={editDialog?.webhook_type || "custom"}
                onValueChange={(value) => setValue("webhook_type", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notification">Notificação</SelectItem>
                  <SelectItem value="integration">Integração</SelectItem>
                  <SelectItem value="custom">Customizado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                💡 Os webhooks de <strong>Follow-up</strong> e <strong>Message Sent</strong> são gerenciados na aba Config
              </p>
              {errors.webhook_type && <p className="text-xs text-destructive mt-1">{errors.webhook_type.message}</p>}
            </div>

            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea id="description" {...register("description")} placeholder="Descreva o propósito deste webhook" rows={2} />
            </div>

            <div>
              <Label htmlFor="headers">Headers (JSON opcional)</Label>
              <Textarea
                id="headers"
                {...register("headers")}
                placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
                rows={3}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Headers adicionais para autenticação ou configurações customizadas
              </p>
              {errors.headers && <p className="text-xs text-destructive mt-1">{errors.headers.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setEditDialog(null);
                setAddDialog(false);
              }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editDialog ? "Salvar Alterações" : "Criar Webhook"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDialog} onOpenChange={(open) => !open && setPreviewDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Webhook</DialogTitle>
            <DialogDescription>{previewDialog?.name}</DialogDescription>
          </DialogHeader>
          {previewDialog && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">URL</Label>
                <code className="block bg-muted p-3 rounded text-xs break-all">{previewDialog.url}</code>
              </div>

              <div>
                <Label className="text-sm font-semibold">Tipo</Label>
                <div className="mt-1">{getTypeBadge(previewDialog.webhook_type)}</div>
              </div>

              {previewDialog.description && (
                <div>
                  <Label className="text-sm font-semibold">Descrição</Label>
                  <p className="text-sm text-muted-foreground mt-1">{previewDialog.description}</p>
                </div>
              )}

              {Object.keys(previewDialog.headers).length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">Headers Configurados</Label>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(previewDialog.headers, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">Exemplo de Payload</Label>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                  {getExamplePayload(previewDialog.webhook_type)}
                </pre>
              </div>

              <div>
                <Label className="text-sm font-semibold">Status</Label>
                <p className="text-sm mt-1">
                  {previewDialog.active ? (
                    <span className="text-green-500">✓ Ativo</span>
                  ) : (
                    <span className="text-red-500">✗ Inativo</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O webhook será removido permanentemente e todas as integrações que
              dependem dele deixarão de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteWebhook} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
