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

  useEffect(() => { setTitle(config.event_title || ""); }, [config.event_title]);
  useEffect(() => { setDescription(config.event_description || ""); }, [config.event_description]);
  useEffect(() => { setDuration(config.duration || "30"); }, [config.duration]);

  const update = (updates: Record<string, string>) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[260px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-sky-50 dark:bg-sky-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader nodeId={id} icon={<CalendarPlus className="h-4 w-4 text-sky-500" />} defaultLabel="Criar Evento na Agenda" customLabel={customLabel} colorClass="bg-sky-50 dark:bg-sky-900/30" textColorClass="text-sky-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        <div><Label className="text-[10px] text-muted-foreground">Título do evento</Label><Input value={title} onChange={(e) => { setTitle(e.target.value); update({ event_title: e.target.value }); }} placeholder="Reunião com {{lead_name}}" className="h-8 text-xs nodrag mt-1" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Duração (minutos)</Label><Select value={duration} onValueChange={(v) => { setDuration(v); update({ duration: v }); }}><SelectTrigger className="h-8 text-xs nodrag mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 min</SelectItem><SelectItem value="30">30 min</SelectItem><SelectItem value="60">1 hora</SelectItem><SelectItem value="120">2 horas</SelectItem></SelectContent></Select></div>
        <div><Label className="text-[10px] text-muted-foreground">Descrição (opcional)</Label><Textarea value={description} onChange={(e) => { setDescription(e.target.value); update({ event_description: e.target.value }); }} placeholder="Detalhes do evento..." rows={2} className="text-xs resize-none nodrag nowheel mt-1" /></div>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Criar Evento"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-sky-50 dark:bg-sky-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const AgendaNode = memo(AgendaNodeComponent);
