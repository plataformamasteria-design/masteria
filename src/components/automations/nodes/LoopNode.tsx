import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function LoopNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [restartDelay, setRestartDelay] = useState(config.restart_delay || "8");
  const [restartUnit, setRestartUnit] = useState(config.restart_unit || "hours");
  
  useEffect(() => {
    setRestartDelay(config.restart_delay || "8");
    setRestartUnit(config.restart_unit || "hours");
  }, [config.restart_delay, config.restart_unit]);

  const update = (updates: Record<string, any>) => {
    (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } });
  };

  const unitLabels: Record<string, string> = {
    minutes: "minutos",
    hours: "horas",
    days: "dias",
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border-2 border-amber-500/60 rounded-xl shadow-lg min-w-[280px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-amber-50 dark:bg-amber-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader
        nodeId={id}
        icon={<RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        defaultLabel="Loop (Reiniciar)"
        customLabel={customLabel}
        colorClass="bg-amber-50 dark:bg-amber-900/30"
        textColorClass="text-amber-600 dark:text-amber-400"
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(l) => (data as any)?.onRename?.(id, l)}
      />
      <div className="px-4 py-3 space-y-3">
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-500/20 px-2.5 py-2">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
            🔄 Após o tempo definido, a automação será reiniciada para este lead quando ele enviar uma nova mensagem.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Tempo de espera</Label>
            <Input
              type="number"
              min={1}
              value={restartDelay}
              onChange={(e) => {
                setRestartDelay(e.target.value);
                update({ restart_delay: e.target.value });
              }}
              className="h-8 text-xs nodrag"
            />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Unidade</Label>
            <Select
              value={restartUnit}
              onValueChange={(v) => {
                setRestartUnit(v);
                update({ restart_unit: v });
              }}
            >
              <SelectTrigger className="h-8 text-xs nodrag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          <span>
            Após {restartDelay} {unitLabels[restartUnit] || restartUnit}, o fluxo poderá ser reativado para o lead
          </span>
        </div>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id}
        nodeLabel={customLabel || "Loop"}
        output={(data as any)?.nodeOutput}
        error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false}
        isExecuting={(data as any)?.isExecuting || false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-amber-50 dark:bg-amber-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const LoopNode = memo(LoopNodeComponent);
