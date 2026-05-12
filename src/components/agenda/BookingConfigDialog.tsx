import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BookingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BookingConfig {
  id?: string;
  organization_id: string;
  calendar_id: string | null;
  working_days: number[];
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  max_advance_days: number;
  min_advance_hours: number;
  services: Array<{ name: string; duration: number; description: string }>;
  widget_title: string;
  widget_description: string;
  primary_color: string;
  require_phone: boolean;
  require_email: boolean;
  require_notes: boolean;
  auto_create_chat: boolean;
  auto_apply_tag_id: string | null;
  auto_assign_funnel_id: string | null;
  auto_assign_stage_id: string | null;
  auto_assign_agent_id: string | null;
  send_confirmation_webhook: boolean;
  active: boolean;
}

const defaultConfig: Partial<BookingConfig> = {
  working_days: [1, 2, 3, 4, 5],
  start_time: "08:00",
  end_time: "18:00",
  slot_duration_minutes: 30,
  buffer_minutes: 0,
  max_advance_days: 30,
  min_advance_hours: 2,
  services: [],
  widget_title: "Agendar Horário",
  widget_description: "Escolha o melhor horário para você",
  primary_color: "#3B82F6",
  require_phone: true,
  require_email: false,
  require_notes: false,
  auto_create_chat: true,
  auto_apply_tag_id: null,
  auto_assign_funnel_id: null,
  auto_assign_stage_id: null,
  auto_assign_agent_id: null,
  send_confirmation_webhook: true,
  active: true,
  calendar_id: null,
};

const weekdays = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export function BookingConfigDialog({ open, onOpenChange }: BookingConfigDialogProps) {
  const { currentOrganization } = useOrganization();
  const [config, setConfig] = useState<Partial<BookingConfig>>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const [funnels, setFunnels] = useState<Array<{ id: string; name: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: string; name: string; funnel_id: string }>>([]);
  const [agents, setAgents] = useState<Array<{ id: string; full_name: string }>>([]);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && currentOrganization?.id) {
      loadConfig();
      loadOptions();
    }
  }, [open, currentOrganization?.id]);

  const loadConfig = async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("booking_config")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingId(data.id);
        setConfig({
          ...data,
          start_time: data.start_time?.substring(0, 5) || "08:00",
          end_time: data.end_time?.substring(0, 5) || "18:00",
        });
      } else {
        setExistingId(null);
        setConfig({ ...defaultConfig, organization_id: currentOrganization.id });
      }
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    if (!currentOrganization?.id) return;
    const orgId = currentOrganization.id;

    const [tagsRes, calendarsRes, funnelsRes, stagesRes, agentsRes] = await Promise.all([
      (supabase as any).from("tags").select("id, name").eq("organization_id", orgId).order("name"),
      (supabase as any).from("calendars").select("id, name").eq("organization_id", orgId).order("name"),
      (supabase as any).from("funnels").select("id, name").eq("organization_id", orgId).order("name"),
      (supabase as any).from("funnel_stages").select("id, name, funnel_id").eq("organization_id", orgId).order("order_position"),
      (supabase as any).from("profiles").select("id, full_name").eq("organization_id", orgId).order("full_name"),
    ]);

    if (tagsRes.data) setTags(tagsRes.data);
    if (calendarsRes.data) setCalendars(calendarsRes.data);
    if (funnelsRes.data) setFunnels(funnelsRes.data);
    if (stagesRes.data) setStages(stagesRes.data);
    if (agentsRes.data) setAgents(agentsRes.data);
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) return;

    setSaving(true);
    try {
      // Build a clean payload without extra fields
      const payload: Record<string, any> = {
        organization_id: currentOrganization.id,
        working_days: config.working_days,
        start_time: (config.start_time || "08:00") + ":00",
        end_time: (config.end_time || "18:00") + ":00",
        slot_duration_minutes: config.slot_duration_minutes,
        buffer_minutes: config.buffer_minutes,
        max_advance_days: config.max_advance_days,
        min_advance_hours: config.min_advance_hours,
        services: config.services || [],
        widget_title: config.widget_title,
        widget_description: config.widget_description,
        primary_color: config.primary_color,
        require_phone: config.require_phone,
        require_email: config.require_email,
        require_notes: config.require_notes,
        auto_create_chat: config.auto_create_chat,
        auto_apply_tag_id: config.auto_apply_tag_id || null,
        auto_assign_funnel_id: config.auto_assign_funnel_id || null,
        auto_assign_stage_id: config.auto_assign_stage_id || null,
        auto_assign_agent_id: config.auto_assign_agent_id || null,
        calendar_id: config.calendar_id || null,
        send_confirmation_webhook: config.send_confirmation_webhook,
        active: config.active,
      };

      if (existingId) {
        const { error } = await (supabase as any)
          .from("booking_config")
          .update(payload)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("booking_config")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setExistingId(data.id);
      }

      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkingDay = (day: number) => {
    const currentDays = config.working_days || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort();
    setConfig((prev) => ({ ...prev, working_days: newDays }));
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Agendamento
          </DialogTitle>
          <DialogDescription>
            Configure horários, aparência e comportamento do agendamento online
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="schedule">Horários</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Widget Ativo</Label>
                <p className="text-sm text-muted-foreground">Habilita ou desabilita o agendamento</p>
              </div>
              <Switch
                checked={config.active}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, active: checked }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração do Slot (minutos)</Label>
                <Select
                  value={String(config.slot_duration_minutes)}
                  onValueChange={(value) => setConfig((prev) => ({ ...prev, slot_duration_minutes: parseInt(value) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1h30</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Intervalo entre Slots (min)</Label>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={config.buffer_minutes}
                  onChange={(e) => setConfig((prev) => ({ ...prev, buffer_minutes: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Antecedência Máxima (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={config.max_advance_days}
                  onChange={(e) => setConfig((prev) => ({ ...prev, max_advance_days: parseInt(e.target.value) || 30 }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Antecedência Mínima (horas)</Label>
                <Input
                  type="number"
                  min="0"
                  max="72"
                  value={config.min_advance_hours}
                  onChange={(e) => setConfig((prev) => ({ ...prev, min_advance_hours: parseInt(e.target.value) || 2 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Agenda Vinculada</Label>
              <Select
                value={config.calendar_id || "none"}
                onValueChange={(value) => setConfig((prev) => ({ ...prev, calendar_id: value === "none" ? null : value }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma agenda" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (todas)</SelectItem>
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Agenda onde os eventos serão criados</p>
            </div>

            <div className="space-y-2">
              <Label>Tag Automática</Label>
              <Select
                value={config.auto_apply_tag_id || "none"}
                onValueChange={(value) => setConfig((prev) => ({ ...prev, auto_apply_tag_id: value === "none" ? null : value }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Tag aplicada automaticamente ao lead</p>
            </div>

            <div className="space-y-2">
              <Label>Funil Automático</Label>
              <Select
                value={config.auto_assign_funnel_id || "none"}
                onValueChange={(value) => {
                  setConfig((prev) => ({
                    ...prev,
                    auto_assign_funnel_id: value === "none" ? null : value,
                    auto_assign_stage_id: null,
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um funil" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {funnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {config.auto_assign_funnel_id && (
              <div className="space-y-2">
                <Label>Etapa do Funil</Label>
                <Select
                  value={config.auto_assign_stage_id || "none"}
                  onValueChange={(value) => setConfig((prev) => ({ ...prev, auto_assign_stage_id: value === "none" ? null : value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione uma etapa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Primeira etapa</SelectItem>
                    {stages
                      .filter((s) => s.funnel_id === config.auto_assign_funnel_id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Atribuir Agente</Label>
              <Select
                value={config.auto_assign_agent_id || "none"}
                onValueChange={(value) => setConfig((prev) => ({ ...prev, auto_assign_agent_id: value === "none" ? null : value }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name || "Sem nome"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Agente atribuído automaticamente ao lead</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label>Criar Lead Automaticamente</Label>
                <Switch
                  checked={config.auto_create_chat}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, auto_create_chat: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Disparar Webhook</Label>
                <Switch
                  checked={config.send_confirmation_webhook}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, send_confirmation_webhook: checked }))}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Dias de Funcionamento</Label>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => (
                  <Button
                    key={day.value}
                    variant={config.working_days?.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleWorkingDay(day.value)}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário de Início</Label>
                <Input
                  type="time"
                  value={config.start_time}
                  onChange={(e) => setConfig((prev) => ({ ...prev, start_time: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Horário de Término</Label>
                <Input
                  type="time"
                  value={config.end_time}
                  onChange={(e) => setConfig((prev) => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Título do Widget</Label>
              <Input
                value={config.widget_title}
                onChange={(e) => setConfig((prev) => ({ ...prev, widget_title: e.target.value }))}
                placeholder="Agendar Horário"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={config.widget_description}
                onChange={(e) => setConfig((prev) => ({ ...prev, widget_description: e.target.value }))}
                placeholder="Escolha o melhor horário para você"
              />
            </div>

            <div className="space-y-2">
              <Label>Cor Principal</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="color"
                  value={config.primary_color}
                  onChange={(e) => setConfig((prev) => ({ ...prev, primary_color: e.target.value }))}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={config.primary_color}
                  onChange={(e) => setConfig((prev) => ({ ...prev, primary_color: e.target.value }))}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Exigir Telefone</Label>
                  <p className="text-xs text-muted-foreground">Sempre obrigatório</p>
                </div>
                <Switch checked={true} disabled />
              </div>

              <div className="flex items-center justify-between">
                <Label>Exigir E-mail</Label>
                <Switch
                  checked={config.require_email}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, require_email: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Campo de Observações</Label>
                <Switch
                  checked={config.require_notes}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, require_notes: checked }))}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
