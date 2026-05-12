import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { CalendarPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function AgendaNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [title, setTitle] = useState(config.event_title || "");
  const [description, setDescription] = useState(config.event_description || "");
  const [duration, setDuration] = useState(config.duration || "30");

  const [generateMeetLink, setGenerateMeetLink] = useState(config.generate_meet_link ?? true);
  const [notifyLead, setNotifyLead] = useState(config.notify_lead ?? true);

  useEffect(() => { setTitle(config.event_title || ""); }, [config.event_title]);
  useEffect(() => { setDescription(config.event_description || ""); }, [config.event_description]);
  useEffect(() => { setDuration(config.duration || "30"); }, [config.duration]);
  useEffect(() => { setGenerateMeetLink(config.generate_meet_link ?? true); }, [config.generate_meet_link]);
  useEffect(() => { setNotifyLead(config.notify_lead ?? true); }, [config.notify_lead]);

  const update = (updates: Record<string, any>) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-sky-500 !border-2 !border-background" />
      <NodeHeader nodeId={id} icon={<CalendarPlus className="h-4 w-4 text-sky-500" />} defaultLabel="Criar Evento na Agenda" customLabel={customLabel} colorClass="bg-sky-500/10" textColorClass="text-sky-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-3">
        <div><Label className="text-[10px] text-muted-foreground">Título do evento</Label><Input value={title} onChange={(e) => { setTitle(e.target.value); update({ event_title: e.target.value }); }} placeholder="Reunião com {{lead_name}}" className="h-8 text-xs nodrag mt-1" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Duração (minutos)</Label><Select value={duration} onValueChange={(v) => { setDuration(v); update({ duration: v }); }}><SelectTrigger className="h-8 text-xs nodrag mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 min</SelectItem><SelectItem value="30">30 min</SelectItem><SelectItem value="60">1 hora</SelectItem><SelectItem value="120">2 horas</SelectItem></SelectContent></Select></div>

        <div className="rounded-lg bg-sky-500/5 border border-sky-500/10 p-2 space-y-2">
          <Label className="text-[10px] font-bold text-sky-600 uppercase">Agendamento</Label>
          <Select value={config.schedule_mode || "auto"} onValueChange={(v) => update({ schedule_mode: v })}>
            <SelectTrigger className="h-7 text-xs nodrag"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automático (próxima 1h)</SelectItem>
              <SelectItem value="custom">Data/hora específica</SelectItem>
            </SelectContent>
          </Select>
          {config.schedule_mode === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] text-muted-foreground">Data</Label>
                <Input type="date" value={config.custom_date || ""} onChange={(e) => update({ custom_date: e.target.value })} className="h-7 text-xs nodrag mt-0.5" />
              </div>
              <div>
                <Label className="text-[9px] text-muted-foreground">Hora</Label>
                <Input type="time" value={config.custom_time || ""} onChange={(e) => update({ custom_time: e.target.value })} className="h-7 text-xs nodrag mt-0.5" />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer bg-blue-50 dark:bg-blue-900/20 p-2 text-xs rounded-md border border-blue-100 dark:border-blue-800/30 transition-colors">
            <input type="checkbox" checked={generateMeetLink} onChange={(e) => { setGenerateMeetLink(e.target.checked); update({ generate_meet_link: e.target.checked }); }} className="accent-blue-500 w-4 h-4 nodrag" />
            <span className="font-semibold text-blue-700 dark:text-blue-300">Google Meet Automático</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 dark:bg-emerald-900/20 p-2 text-xs rounded-md border border-emerald-100 dark:border-emerald-800/30 transition-colors">
            <input type="checkbox" checked={notifyLead} onChange={(e) => { setNotifyLead(e.target.checked); update({ notify_lead: e.target.checked }); }} className="accent-emerald-500 w-4 h-4 nodrag" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Avisar lead no WhatsApp</span>
          </label>
        </div>

        <div><Label className="text-[10px] text-muted-foreground">Descrição (opcional)</Label><Textarea value={description} onChange={(e) => { setDescription(e.target.value); update({ event_description: e.target.value }); }} placeholder="Detalhes do evento..." rows={2} className="text-xs resize-none nodrag nowheel mt-1" /></div>

        {/* Pre-Event Reminder Integration */}
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2 space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.send_reminder ?? false}
              onChange={(e) => update({ send_reminder: e.target.checked })}
              className="accent-sky-500 w-3.5 h-3.5 nodrag"
            />
            <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 uppercase">⏰ Lembrete pré-evento</span>
          </label>
          {config.send_reminder && (
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <Label className="text-[9px] text-muted-foreground whitespace-nowrap">Horas antes:</Label>
                <Input
                  type="number"
                  min={1}
                  max={72}
                  value={config.reminder_hours_before || "1"}
                  onChange={(e) => update({ reminder_hours_before: e.target.value })}
                  className="h-6 text-[10px] w-16 nodrag"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] text-muted-foreground">Mensagem de lembrete</Label>
                <Textarea
                  value={config.reminder_message || ""}
                  onChange={(e) => update({ reminder_message: e.target.value })}
                  placeholder="Olá! Lembrando que nossa reunião é daqui a pouco..."
                  rows={2}
                  className="text-[10px] resize-none nodrag nowheel h-12"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Criar Evento"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-sky-500 !border-2 !border-background" />
    </div>
  );
}

export const AgendaNode = memo(AgendaNodeComponent);
