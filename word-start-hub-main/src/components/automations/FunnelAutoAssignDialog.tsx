import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Funnel, FunnelStage } from "@/pages/Automations";
import { Loader2, Users, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnels: Funnel[];
  stages: FunnelStage[];
}

export function FunnelAutoAssignDialog({ open, onOpenChange, funnels, stages }: Props) {
  const { currentOrganization } = useOrganization();
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoFunnelId, setAutoFunnelId] = useState("");
  const [autoStageId, setAutoStageId] = useState("");
  const [bulkFunnelId, setBulkFunnelId] = useState("");
  const [bulkStageId, setBulkStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const autoStages = stages.filter((s) => s.funnel_id === autoFunnelId);
  const bulkStages = stages.filter((s) => s.funnel_id === bulkFunnelId);

  useEffect(() => {
    if (!open || !currentOrganization?.id) return;
    loadConfig();
  }, [open, currentOrganization?.id]);

  const loadConfig = async () => {
    const { data } = await (supabase as any)
      .from("organizations")
      .select("settings")
      .eq("id", currentOrganization!.id)
      .maybeSingle();

    const settings = data?.settings || {};
    setAutoEnabled(!!settings.auto_assign_funnel_enabled);
    setAutoFunnelId(settings.auto_assign_funnel_id || "");
    setAutoStageId(settings.auto_assign_stage_id || "");
  };

  const handleSaveAutoAssign = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    try {
      // Get current settings first
      const { data: orgData } = await (supabase as any)
        .from("organizations")
        .select("settings")
        .eq("id", currentOrganization.id)
        .maybeSingle();

      const currentSettings = orgData?.settings || {};
      const newSettings = {
        ...currentSettings,
        auto_assign_funnel_enabled: autoEnabled,
        auto_assign_funnel_id: autoFunnelId || null,
        auto_assign_stage_id: autoStageId || null,
      };

      const { error } = await (supabase as any)
        .from("organizations")
        .update({ settings: newSettings })
        .eq("id", currentOrganization.id);

      if (error) throw error;
      toast({ title: "Configuração salva com sucesso!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!currentOrganization?.id || !bulkFunnelId || !bulkStageId) return;
    setBulkRunning(true);
    setBulkResult(null);
    try {
      // Get all chats that DON'T have a record in chat_funnel_stage for this funnel
      const { data: allChats } = await (supabase as any)
        .from("chats")
        .select("id")
        .eq("organization_id", currentOrganization.id)
        .eq("is_group", false);

      const { data: assignedChats } = await (supabase as any)
        .from("chat_funnel_stage")
        .select("chat_id")
        .eq("organization_id", currentOrganization.id)
        .eq("funnel_id", bulkFunnelId);

      const assignedSet = new Set((assignedChats || []).map((c: any) => c.chat_id));
      const unassigned = (allChats || []).filter((c: any) => !assignedSet.has(c.id));

      if (unassigned.length === 0) {
        setBulkResult("Nenhum lead sem funil encontrado.");
        setBulkRunning(false);
        return;
      }

      // Insert in batches of 100
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < unassigned.length; i += batchSize) {
        const batch = unassigned.slice(i, i + batchSize).map((c: any) => ({
          chat_id: c.id,
          funnel_id: bulkFunnelId,
          stage_id: bulkStageId,
          organization_id: currentOrganization.id,
        }));

        const { error } = await (supabase as any)
          .from("chat_funnel_stage")
          .upsert(batch, { onConflict: "chat_id,funnel_id" });

        if (error) throw error;
        inserted += batch.length;
      }

      setBulkResult(`${inserted} leads atribuídos com sucesso!`);
      toast({ title: `${inserted} leads atribuídos ao funil` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atribuição de Funil</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Section 1: Auto-assign new leads */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">Auto-atribuir novos leads</h3>
                <p className="text-[11px] text-muted-foreground">
                  Todo novo lead será automaticamente adicionado ao funil e etapa selecionados
                </p>
              </div>
              <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
            </div>

            {autoEnabled && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Funil</Label>
                  <Select value={autoFunnelId} onValueChange={(v) => { setAutoFunnelId(v); setAutoStageId(""); }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {funnels.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {autoFunnelId && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Etapa inicial</Label>
                    <Select value={autoStageId} onValueChange={setAutoStageId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {autoStages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={handleSaveAutoAssign}
                  disabled={saving || (autoEnabled && (!autoFunnelId || !autoStageId))}
                  className="w-full"
                >
                  {saving ? "Salvando..." : "Salvar configuração"}
                </Button>
              </div>
            )}

            {!autoEnabled && (
              <Button size="sm" variant="outline" onClick={handleSaveAutoAssign} disabled={saving} className="w-full">
                {saving ? "Salvando..." : "Desativar e salvar"}
              </Button>
            )}
          </div>

          {/* Section 2: Bulk assign unassigned leads */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-accent/50 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Atribuir leads sem funil</h3>
                <p className="text-[11px] text-muted-foreground">
                  Mover todos os leads que não estão em nenhum funil para um funil e etapa específicos
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Funil destino</Label>
                <Select value={bulkFunnelId} onValueChange={(v) => { setBulkFunnelId(v); setBulkStageId(""); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {bulkFunnelId && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Etapa destino</Label>
                  <Select value={bulkStageId} onValueChange={setBulkStageId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                size="sm"
                variant="default"
                onClick={handleBulkAssign}
                disabled={bulkRunning || !bulkFunnelId || !bulkStageId}
                className="w-full gap-2"
              >
                {bulkRunning && <Loader2 className="h-3 w-3 animate-spin" />}
                {bulkRunning ? "Processando..." : "Atribuir agora"}
              </Button>
              {bulkResult && (
                <p className="text-xs text-center text-muted-foreground">{bulkResult}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
