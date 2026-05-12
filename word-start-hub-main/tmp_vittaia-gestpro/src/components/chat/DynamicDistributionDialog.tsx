import * as React from "react";

import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type Team = { id: string; name: string };

type DynamicDistributionSettings = {
  enabled: boolean;
  assignment_target?: { team_id?: string | null };
  metric?: "least_open_chats";
  include_only_online?: boolean;
  reassign_on_offline?: boolean;
  periodic_enabled?: boolean;
  periodic_interval_minutes?: number;
  // future
  office_hours_enabled?: boolean;
  options?: {
    random?: boolean;
    performance_least_open?: boolean;
    online_only?: boolean;
    office_hours?: boolean;
  };
};

function normalizeSettings(raw: any): DynamicDistributionSettings {
  const s = (raw ?? {}) as DynamicDistributionSettings;
  return {
    enabled: !!s.enabled,
    assignment_target: {
      team_id: s.assignment_target?.team_id ?? null,
    },
    metric: "least_open_chats",
    include_only_online: s.include_only_online ?? true,
    reassign_on_offline: s.reassign_on_offline ?? true,
    periodic_enabled: s.periodic_enabled ?? true,
    periodic_interval_minutes: Number.isFinite(s.periodic_interval_minutes)
      ? Number(s.periodic_interval_minutes)
      : 2,
    office_hours_enabled: s.office_hours_enabled ?? false,
    options: {
      random: s.options?.random ?? false,
      performance_least_open: true,
      online_only: true,
      office_hours: s.options?.office_hours ?? false,
    },
  };
}

export function DynamicDistributionDialog({
  open,
  onOpenChange,
  teams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
}) {
  const { currentOrganization, refreshOrganizations } = useOrganization();
  const [saving, setSaving] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  const [settings, setSettings] = React.useState<DynamicDistributionSettings>(() =>
    normalizeSettings((currentOrganization?.settings as any)?.dynamic_distribution)
  );

  const settingsKey = React.useMemo(() => {
    const cfg = (currentOrganization?.settings as any)?.dynamic_distribution ?? null;
    try {
      return JSON.stringify(cfg);
    } catch {
      return String(cfg);
    }
  }, [currentOrganization?.settings]);

  React.useEffect(() => {
    setSettings(normalizeSettings((currentOrganization?.settings as any)?.dynamic_distribution));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id, settingsKey]);

  const save = async () => {
    if (!currentOrganization?.id) return;
    if (settings.enabled && !settings.assignment_target?.team_id) {
      toast.error("Selecione uma equipe alvo");
      return;
    }

    setSaving(true);
    try {
      const nextSettings = {
        ...(currentOrganization.settings || {}),
        dynamic_distribution: settings,
      };

      const { error } = await supabase
        .from("organizations")
        .update({ settings: nextSettings })
        .eq("id", currentOrganization.id);

      if (error) throw error;
      await refreshOrganizations();
      toast.success("Distribuição Dinâmica salva");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar Distribuição Dinâmica");
    } finally {
      setSaving(false);
    }
  };

  const applyNow = async () => {
    if (!currentOrganization?.id) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("dynamic-distribution-processor", {
        body: { trigger: "manual", organization_id: currentOrganization.id },
      });
      if (error) throw error;
      const assigned = (data as any)?.assigned ?? 0;
      const reassigned = (data as any)?.reassigned ?? 0;
      toast.success(`Aplicado: ${assigned} atribuídas, ${reassigned} reatribuídas`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao aplicar distribuição");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Distribuição Dinâmica</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Ativar</div>
              <div className="text-xs text-muted-foreground">
                Distribui leads automaticamente (Equipe + Agente)
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Equipe alvo</Label>
            <Select
              value={settings.assignment_target?.team_id || "none"}
              onValueChange={(value) =>
                setSettings((s) => ({
                  ...s,
                  assignment_target: { team_id: value === "none" ? null : value },
                }))
              }
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione uma equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecionar…</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Critérios (múltipla escolha)</div>
            <div className="space-y-2">
              <label className="flex items-start gap-2">
                <Checkbox checked disabled />
                <div className="leading-tight">
                  <div className="text-sm">Por desempenho</div>
                  <div className="text-xs text-muted-foreground">Menos conversas abertas (balanceamento)</div>
                </div>
              </label>

              <label className="flex items-start gap-2">
                <Checkbox checked disabled />
                <div className="leading-tight">
                  <div className="text-sm">Apenas agentes online/logados</div>
                  <div className="text-xs text-muted-foreground">Usa presença (heartbeat) para definir online</div>
                </div>
              </label>

              <label className="flex items-start gap-2 opacity-60">
                <Checkbox checked={!!settings.options?.office_hours} disabled />
                <div className="leading-tight">
                  <div className="text-sm">Por horário/expediente</div>
                  <div className="text-xs text-muted-foreground">(em breve) Reatribui ao encerrar expediente</div>
                </div>
              </label>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Reatribuir quando ficar offline</div>
                <div className="text-xs text-muted-foreground">Se o agente sumir (sem presença recente)</div>
              </div>
              <Switch
                checked={!!settings.reassign_on_offline}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, reassign_on_offline: v }))}
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Redistribuição periódica</div>
                <div className="text-xs text-muted-foreground">Atribui backlog sem agente automaticamente</div>
              </div>
              <Switch
                checked={!!settings.periodic_enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, periodic_enabled: v }))}
              />
            </label>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Intervalo (min)</Label>
              <Select
                value={String(settings.periodic_interval_minutes ?? 2)}
                onValueChange={(v) => setSettings((s) => ({ ...s, periodic_interval_minutes: Number(v) }))}
                disabled={!settings.periodic_enabled}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 10].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={applyNow} disabled={applying || saving || !settings.enabled}>
            {applying ? "Aplicando…" : "Aplicar agora"}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
