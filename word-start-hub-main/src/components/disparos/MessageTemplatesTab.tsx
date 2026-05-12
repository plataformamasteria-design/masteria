import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit2, Tag, GitBranch, Clock, ShieldCheck, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { CommandStepEditor } from "@/components/commands/CommandStepEditor";

interface MessageStep {
  id?: string;
  step_order: number;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'video';
  content?: string;
  file_url?: string;
  file_name?: string;
}

interface TemplateConfig {
  steps: MessageStep[];
  delay_seconds: number;
  delay_between_messages: number;
  auto_assign_tag: boolean;
  auto_assign_tag_id: string;
  auto_assign_funnel: boolean;
  auto_assign_funnel_id: string;
  auto_assign_stage_id: string;
}

function parseTemplateContent(content: string): TemplateConfig {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.steps && Array.isArray(parsed.steps)) {
      return {
        steps: parsed.steps,
        delay_seconds: parsed.delay_seconds || 5,
        delay_between_messages: parsed.delay_between_messages || 1.5,
        auto_assign_tag: parsed.auto_assign_tag || false,
        auto_assign_tag_id: parsed.auto_assign_tag_id || "",
        auto_assign_funnel: parsed.auto_assign_funnel || false,
        auto_assign_funnel_id: parsed.auto_assign_funnel_id || "",
        auto_assign_stage_id: parsed.auto_assign_stage_id || "",
      };
    }
    // Legacy: plain array of steps
    if (Array.isArray(parsed)) {
      return { steps: parsed, delay_seconds: 5, delay_between_messages: 1.5, auto_assign_tag: false, auto_assign_tag_id: "", auto_assign_funnel: false, auto_assign_funnel_id: "", auto_assign_stage_id: "" };
    }
  } catch {}
  return { steps: [{ step_order: 1, message_type: 'text', content }], delay_seconds: 5, delay_between_messages: 1.5, auto_assign_tag: false, auto_assign_tag_id: "", auto_assign_funnel: false, auto_assign_funnel_id: "", auto_assign_stage_id: "" };
}

function templateSummary(content: string): string {
  const config = parseTemplateContent(content);
  const parts: string[] = [];
  config.steps.forEach((s) => {
    if (s.message_type === 'text') parts.push(s.content?.substring(0, 40) || '');
    else if (s.message_type === 'audio') parts.push('🎵 Áudio');
    else if (s.message_type === 'image') parts.push('🖼️ Imagem');
    else if (s.message_type === 'video') parts.push('🎬 Vídeo');
    else if (s.message_type === 'pdf') parts.push(`📄 ${s.file_name || 'PDF'}`);
  });
  const summary = parts.filter(Boolean).join(' → ');
  const extras: string[] = [];
  if (config.delay_seconds !== 5) extras.push(`⏱ ${config.delay_seconds}s delay`);
  if (config.auto_assign_tag) extras.push('🏷️ Tag auto');
  if (config.auto_assign_funnel) extras.push('📊 Funil auto');
  return summary + (extras.length ? `\n${extras.join(' • ')}` : '');
}

export function MessageTemplatesTab() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<MessageStep[]>([{ step_order: 1, message_type: 'text', content: '' }]);
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [delayBetweenMessages, setDelayBetweenMessages] = useState(1.5);
  const [autoAssignTag, setAutoAssignTag] = useState(false);
  const [autoAssignTagId, setAutoAssignTagId] = useState("");
  const [autoAssignFunnel, setAutoAssignFunnel] = useState(false);
  const [autoAssignFunnelId, setAutoAssignFunnelId] = useState("");
  const [autoAssignStageId, setAutoAssignStageId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["broadcast-templates", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("broadcast_message_templates").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("tags").select("id, name, color").eq("organization_id", orgId).order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ["funnels", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("funnels").select("id, name").eq("organization_id", orgId).order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: funnelStages = [] } = useQuery({
    queryKey: ["funnel-stages-template", autoAssignFunnelId],
    queryFn: async () => {
      if (!autoAssignFunnelId) return [];
      const { data } = await supabase.from("funnel_stages").select("id, name").eq("funnel_id", autoAssignFunnelId).order("order_position");
      return data || [];
    },
    enabled: !!autoAssignFunnelId,
  });

  const handleSave = async () => {
    if (!orgId || !name.trim() || !steps.some(s => s.content?.trim() || s.file_url)) {
      toast({ variant: "destructive", title: "Preencha o nome e adicione pelo menos uma mensagem" });
      return;
    }
    const config: TemplateConfig = {
      steps, delay_seconds: delaySeconds, delay_between_messages: delayBetweenMessages,
      auto_assign_tag: autoAssignTag, auto_assign_tag_id: autoAssignTagId,
      auto_assign_funnel: autoAssignFunnel, auto_assign_funnel_id: autoAssignFunnelId,
      auto_assign_stage_id: autoAssignStageId,
    };
    const content = JSON.stringify(config);
    if (editingId) {
      await supabase.from("broadcast_message_templates").update({ name, content }).eq("id", editingId);
    } else {
      await supabase.from("broadcast_message_templates").insert({ organization_id: orgId, name, content });
    }
    queryClient.invalidateQueries({ queryKey: ["broadcast-templates"] });
    toast({ title: editingId ? "Modelo atualizado" : "Modelo salvo" });
    resetDialog();
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from("broadcast_message_templates").delete().eq("id", deleteId);
    queryClient.invalidateQueries({ queryKey: ["broadcast-templates"] });
    setDeleteId(null);
    toast({ title: "Modelo excluído" });
  };

  const handleEdit = (template: any) => {
    setEditingId(template.id);
    setName(template.name);
    const config = parseTemplateContent(template.content);
    setSteps(config.steps);
    setDelaySeconds(config.delay_seconds);
    setDelayBetweenMessages(config.delay_between_messages);
    setAutoAssignTag(config.auto_assign_tag);
    setAutoAssignTagId(config.auto_assign_tag_id);
    setAutoAssignFunnel(config.auto_assign_funnel);
    setAutoAssignFunnelId(config.auto_assign_funnel_id);
    setAutoAssignStageId(config.auto_assign_stage_id);
    setDialogOpen(true);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setName("");
    setSteps([{ step_order: 1, message_type: 'text', content: '' }]);
    setDelaySeconds(5);
    setDelayBetweenMessages(1.5);
    setAutoAssignTag(false);
    setAutoAssignTagId("");
    setAutoAssignFunnel(false);
    setAutoAssignFunnelId("");
    setAutoAssignStageId("");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Modelos de Disparo</h2>
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo Modelo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Modelo" : "Novo Modelo de Disparo"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do modelo</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promoção Black Friday" />
                </div>

                <Separator />
                <Label className="text-sm font-medium flex items-center gap-2"><Send className="h-4 w-4" /> Mensagens</Label>
                {orgId && <CommandStepEditor steps={steps} onChange={setSteps} organizationId={orgId} />}

                <Separator />
                <Label className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> Configuração de Delay</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Entre destinatários (s)</Label>
                    <Input type="number" min={3} max={300} value={delaySeconds} onChange={e => setDelaySeconds(Math.max(3, Number(e.target.value)))} />
                  </div>
                  <div>
                    <Label className="text-xs">Entre mensagens (s)</Label>
                    <Input type="number" min={0.5} max={30} step={0.5} value={delayBetweenMessages} onChange={e => setDelayBetweenMessages(Math.max(0.5, Number(e.target.value)))} />
                  </div>
                </div>

                <Separator />
                <Label className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Ações Pós-Envio</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={autoAssignTag} onCheckedChange={setAutoAssignTag} />
                    <Label className="text-sm">Atribuir etiqueta</Label>
                  </div>
                  {autoAssignTag && (
                    <Select value={autoAssignTagId} onValueChange={setAutoAssignTagId}>
                      <SelectTrigger><SelectValue placeholder="Selecione a etiqueta" /></SelectTrigger>
                      <SelectContent>
                        {tags.map(tag => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex items-center gap-3">
                    <Switch checked={autoAssignFunnel} onCheckedChange={setAutoAssignFunnel} />
                    <Label className="text-sm">Mover para funil</Label>
                  </div>
                  {autoAssignFunnel && (
                    <>
                      <Select value={autoAssignFunnelId} onValueChange={(v) => { setAutoAssignFunnelId(v); setAutoAssignStageId(""); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                        <SelectContent>{funnels.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {autoAssignFunnelId && (
                        <Select value={autoAssignStageId} onValueChange={setAutoAssignStageId}>
                          <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                          <SelectContent>{funnelStages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </>
                  )}
                </div>

                <Button onClick={handleSave} className="w-full">Salvar Modelo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum modelo salvo ainda. Crie seu primeiro modelo de disparo completo.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((t: any) => {
              const config = parseTemplateContent(t.content);
              return (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="truncate">{t.name}</span>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{templateSummary(t.content)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs gap-1">
                        <Send className="h-3 w-3" /> {config.steps.length} msg
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Clock className="h-3 w-3" /> {config.delay_seconds}s
                      </Badge>
                      {config.auto_assign_tag && (
                        <Badge variant="secondary" className="text-xs gap-1"><Tag className="h-3 w-3" /> Tag</Badge>
                      )}
                      {config.auto_assign_funnel && (
                        <Badge variant="secondary" className="text-xs gap-1"><GitBranch className="h-3 w-3" /> Funil</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O modelo será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
