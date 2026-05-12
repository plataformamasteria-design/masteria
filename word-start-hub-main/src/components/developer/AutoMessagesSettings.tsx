import { useEffect, useMemo, useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

type BusinessHours = {
  days: number[]; // 0=Dom, 1=Seg ... 6=Sáb
  start: string; // HH:mm
  end: string; // HH:mm
  lunch_enabled: boolean;
  lunch_start: string;
  lunch_end: string;
};

type AutoMessagesRow = {
  id: string;
  organization_id: string;
  welcome_enabled: boolean;
  welcome_message: string | null;
  welcome_inactive_hours: number;
  away_enabled: boolean;
  away_message: string | null;
  business_hours: BusinessHours;
  timezone: string;
};

const DEFAULT_HOURS: BusinessHours = {
  days: [1, 2, 3, 4, 5],
  start: "08:00",
  end: "18:00",
  lunch_enabled: false,
  lunch_start: "12:00",
  lunch_end: "13:00",
};

const DAY_LABELS: Array<{ day: number; label: string }> = [
  { day: 1, label: "Seg" },
  { day: 2, label: "Ter" },
  { day: 3, label: "Qua" },
  { day: 4, label: "Qui" },
  { day: 5, label: "Sex" },
  { day: 6, label: "Sáb" },
  { day: 0, label: "Dom" },
];

export function AutoMessagesSettings() {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id ?? null;

  const { isAdmin, isSuperAdmin, isSubAdmin, isLoading: roleLoading } = useUserRole();
  // Requisito: admin, sub_admin e super_admin podem salvar.
  const canEdit = isSuperAdmin || isAdmin || isSubAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);

  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayMessage, setAwayMessage] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS);

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
    } catch {
      return "America/Sao_Paulo";
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!organizationId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("organization_auto_messages")
          .select("*")
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (error) throw error;

        const cfg = data as unknown as AutoMessagesRow | null;
        if (cfg) {
          setRowId(cfg.id);
          setWelcomeEnabled(!!cfg.welcome_enabled);
          setWelcomeMessage(cfg.welcome_message ?? "");
          setAwayEnabled(!!cfg.away_enabled);
          setAwayMessage(cfg.away_message ?? "");
          setBusinessHours((cfg.business_hours as any) || DEFAULT_HOURS);
        } else {
          setRowId(null);
          setWelcomeEnabled(false);
          setWelcomeMessage("");
          setAwayEnabled(false);
          setAwayMessage("");
          setBusinessHours(DEFAULT_HOURS);
        }
      } catch (e: any) {
        console.error("[AutoMessagesSettings] load error:", e);
        toast({
          title: "Erro",
          description: e?.message || "Não foi possível carregar as configurações.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [organizationId]);

  const toggleDay = (day: number, checked: boolean) => {
    setBusinessHours((prev) => {
      const days = new Set(prev.days);
      if (checked) days.add(day);
      else days.delete(day);
      return { ...prev, days: Array.from(days) };
    });
  };

  const handleSave = async () => {
    if (!organizationId) return;
    if (!canEdit) {
      toast({
        title: "Sem permissão",
        description: "Apenas Admin/Sub Admin/Super Admin pode salvar essas configurações.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(rowId ? { id: rowId } : {}),
        organization_id: organizationId,
        welcome_enabled: welcomeEnabled,
        welcome_message: welcomeMessage.trim() ? welcomeMessage.trim() : null,
        welcome_inactive_hours: 24,
        away_enabled: awayEnabled,
        away_message: awayMessage.trim() ? awayMessage.trim() : null,
        business_hours: businessHours,
        timezone,
      };

      const { data, error } = await supabase
        .from("organization_auto_messages")
        .upsert(payload as any, { onConflict: "organization_id" })
        .select("id")
        .single();

      if (error) throw error;
      setRowId((data as any)?.id ?? rowId);

      toast({
        title: "Configurações salvas",
        description: "Mensagens automáticas atualizadas com sucesso.",
      });
    } catch (e: any) {
      console.error("[AutoMessagesSettings] save error:", e);

      const msg = String(e?.message || "");
      const isRls = msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row-level security");
      toast({
        title: "Erro ao salvar",
        description: isRls
          ? "Apenas Admin/Sub Admin/Super Admin pode salvar essas configurações."
          : (e?.message || "Não foi possível salvar as configurações."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!organizationId) {
    return (
      <CardContent>
        <p className="text-sm text-muted-foreground">Selecione uma organização para configurar.</p>
      </CardContent>
    );
  }

  if (loading) {
    return (
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-5">
      {!roleLoading && !canEdit && (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          Apenas <span className="font-medium text-foreground">Admin</span>, <span className="font-medium text-foreground">Sub Admin</span> ou <span className="font-medium text-foreground">Super Admin</span> pode alterar e salvar essas mensagens.
        </div>
      )}
      {/* Boas-vindas */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Mensagem de boas-vindas</div>
          <div className="text-xs text-muted-foreground">
            Envia na 1ª mensagem do lead e novamente quando ele ficar 24h inativo.
          </div>
        </div>
        <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} disabled={!canEdit} />
      </div>
      <div className="space-y-2">
        <Label>Texto da boas-vindas</Label>
        <Textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          placeholder="Ex: Olá! Seja bem-vindo(a). Como posso te ajudar?"
          className="min-h-[90px]"
          disabled={!canEdit}
        />
      </div>

      <div className="border-t border-border" />

      {/* Ausência */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Mensagem de ausência</div>
          <div className="text-xs text-muted-foreground">
            Envia fora do horário de atendimento (inclui almoço).
          </div>
        </div>
        <Switch checked={awayEnabled} onCheckedChange={setAwayEnabled} disabled={!canEdit} />
      </div>
      <div className="space-y-2">
        <Label>Texto da ausência</Label>
        <Textarea
          value={awayMessage}
          onChange={(e) => setAwayMessage(e.target.value)}
          placeholder="Ex: No momento estamos fora do horário. Assim que possível retornamos."
          className="min-h-[90px]"
          disabled={!canEdit}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-2 md:col-span-3">
          <Label>Dias de atendimento</Label>
          <div className="flex flex-wrap gap-3">
            {DAY_LABELS.map(({ day, label }) => (
              <label key={day} className="flex items-center gap-2">
                <Checkbox
                  checked={businessHours.days.includes(day)}
                  onCheckedChange={(checked) => toggleDay(day, !!checked)}
                  disabled={!canEdit}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Início</Label>
          <Input
            type="time"
            value={businessHours.start}
            onChange={(e) => setBusinessHours((p) => ({ ...p, start: e.target.value }))}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Fim</Label>
          <Input
            type="time"
            value={businessHours.end}
            onChange={(e) => setBusinessHours((p) => ({ ...p, end: e.target.value }))}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Fuso</Label>
          <Input value={timezone} disabled />
        </div>

        <div className="md:col-span-3 flex items-center justify-between gap-3 rounded-md border border-border p-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Intervalo de almoço</div>
            <div className="text-xs text-muted-foreground">Se ativo, envia ausência durante o almoço.</div>
          </div>
          <Switch
            checked={businessHours.lunch_enabled}
            onCheckedChange={(v) => setBusinessHours((p) => ({ ...p, lunch_enabled: v }))}
            disabled={!canEdit}
          />
        </div>

        {businessHours.lunch_enabled && (
          <>
            <div className="space-y-2">
              <Label>Almoço (início)</Label>
              <Input
                type="time"
                value={businessHours.lunch_start}
                onChange={(e) => setBusinessHours((p) => ({ ...p, lunch_start: e.target.value }))}
                  disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Almoço (fim)</Label>
              <Input
                type="time"
                value={businessHours.lunch_end}
                onChange={(e) => setBusinessHours((p) => ({ ...p, lunch_end: e.target.value }))}
                  disabled={!canEdit}
              />
            </div>
            <div className="hidden md:block" />
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !canEdit}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </CardContent>
  );
}
