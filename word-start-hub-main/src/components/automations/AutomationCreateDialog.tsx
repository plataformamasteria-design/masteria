import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Automation, Funnel, FunnelStage } from "@/pages/Automations";
import { Copy, Check, Globe } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation: Automation | null;
  funnels: Funnel[];
  stages: FunnelStage[];
  onSaved: () => void;
}

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";

export function AutomationCreateDialog({
  open,
  onOpenChange,
  automation,
  funnels,
  stages,
  onSaved,
}: Props) {
  const { currentOrganization } = useOrganization();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("stage_entry");
  const [funnelId, setFunnelId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tags, setTags] = useState<{ id: string, name: string, color: string }[]>([]);

  // Schedule config
  const [scheduleInterval, setScheduleInterval] = useState(1);
  const [scheduleUnit, setScheduleUnit] = useState<"seconds" | "minutes" | "hours" | "days">("minutes");

  const isEditing = !!automation;
  const filteredStages = stages.filter((s) => s.funnel_id === funnelId);

  useEffect(() => {
    if (triggerType === 'tag_added' && currentOrganization?.id) {
      supabase.from('tags').select('id, name, color').eq('organization_id', currentOrganization.id).then(({ data }) => {
        if (data) setTags(data);
      });
    }
  }, [triggerType, currentOrganization?.id]);

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setDescription(automation.description || "");
      setTriggerType(automation.trigger_type);
      setFunnelId(automation.funnel_id || "");
      setStageId(automation.trigger_stage_id || "");
      const sc = (automation as any).schedule_config;
      if (sc) {
        setScheduleInterval(sc.interval || 1);
        setScheduleUnit(sc.unit || "minutes");
      } else {
        setScheduleInterval(1);
        setScheduleUnit("minutes");
      }
    } else {
      setName("");
      setDescription("");
      setTriggerType("stage_entry");
      setFunnelId("");
      setStageId("");
      setScheduleInterval(1);
      setScheduleUnit("minutes");
    }
  }, [automation, open]);

  const handleSave = async () => {
    if (!name.trim() || !currentOrganization?.id) return;

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: triggerType,
        funnel_id: funnelId || null,
        trigger_stage_id: stageId || null,
        organization_id: currentOrganization.id,
        schedule_config: triggerType === "scheduled" ? { interval: scheduleInterval, unit: scheduleUnit } : null,
      };

      // Generate webhook_token for new webhook automations
      if (triggerType === "webhook" && !isEditing) {
        payload.webhook_token = crypto.randomUUID();
      }

      if (isEditing) {
        if (triggerType === "webhook" && !(automation as any)?.webhook_token) {
          payload.webhook_token = crypto.randomUUID();
        }
        const { error } = await (supabase as any)
          .from("automations")
          .update(payload)
          .eq("id", automation.id);
        if (error) throw error;
        toast({ title: "Automação atualizada" });
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from("automations")
          .insert({ ...payload, created_by: userData.user?.id });
        if (error) throw error;
        toast({ title: "Automação criada" });
      }

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = automation && (automation as any).webhook_token
    ? `${SUPABASE_URL}/functions/v1/automation-webhook-trigger?token=${(automation as any).webhook_token}`
    : null;

  const copyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Automação" : "Nova Automação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Boas-vindas novos leads"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o objetivo desta automação..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Gatilho</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stage_entry">Entrada em etapa do CRM</SelectItem>
                <SelectItem value="message_received">Mensagem recebida (na etapa)</SelectItem>
                <SelectItem value="tag_added">Tag adicionada</SelectItem>
                <SelectItem value="manual">Disparo manual</SelectItem>
                <SelectItem value="webhook">Webhook (receber dados externos)</SelectItem>
                <SelectItem value="scheduled">Agendado (Timer automático)</SelectItem>
                <SelectItem value="broadcast_campaign">Disparo Lote (Campaign)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Webhook info */}
          {triggerType === "webhook" && isEditing && webhookUrl && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Label className="flex items-center gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5 text-primary" />
                URL do Webhook
              </Label>
              <div className="flex gap-1">
                <Input value={webhookUrl} readOnly className="text-xs font-mono h-8" />
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={copyWebhookUrl}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Envie um POST para esta URL com dados JSON. Os dados estarão disponíveis como variáveis no fluxo.
              </p>
            </div>
          )}

          {triggerType === "webhook" && !isEditing && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">
                Após criar a automação, uma URL de webhook será gerada automaticamente. Envie dados via POST para disparar o fluxo.
              </p>
            </div>
          )}

          {/* Schedule config */}
          {triggerType === "scheduled" && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Label className="text-xs">Intervalo de execução</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">A cada</span>
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  value={scheduleInterval}
                  onChange={(e) => setScheduleInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Select value={scheduleUnit} onValueChange={(v: any) => setScheduleUnit(v)}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Segundo(s)</SelectItem>
                    <SelectItem value="minutes">Minuto(s)</SelectItem>
                    <SelectItem value="hours">Hora(s)</SelectItem>
                    <SelectItem value="days">Dia(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                O fluxo será executado automaticamente neste intervalo enquanto estiver ativo.
              </p>
            </div>
          )}

          {/* Funnel selector - hide for webhook/scheduled/broadcast/tag_added */}
          {triggerType !== "webhook" && triggerType !== "scheduled" && triggerType !== "broadcast_campaign" && triggerType !== "tag_added" && (
            <div className="space-y-2">
              <Label>Funil vinculado</Label>
              <Select
                value={funnelId}
                onValueChange={(v) => {
                  setFunnelId(v);
                  setStageId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funil" />
                </SelectTrigger>
                <SelectContent>
                  {funnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Stage selector */}
          {(triggerType === "stage_entry" || triggerType === "message_received") && funnelId && (
            <div className="space-y-2">
              <Label>Etapa gatilho</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                A automação será disparada quando um lead entrar nesta etapa
              </p>
            </div>
          )}

          {/* Tag selector */}
          {triggerType === "tag_added" && (
            <div className="space-y-2">
              <Label>Tag vinculada</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                A automação será disparada imediatamente quando esta tag for adicionada via CRM ou Chat.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
