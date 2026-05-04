import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function BotToggleNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [botAction, setBotAction] = useState(config.bot_action || "enable");
  const [notifyFinished, setNotifyFinished] = useState(config.notify_finished || false);

  useEffect(() => {
    setBotAction(config.bot_action || "enable");
    setNotifyFinished(config.notify_finished || false);
  }, [config.bot_action, config.notify_finished]);

  const update = (updates: Record<string, any>) => {
    (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } });
  };

  const isEnable = botAction === "enable";

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[260px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-cyan-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader
        nodeId={id}
        icon={<Bot className="h-4 w-4 text-cyan-500" />}
        defaultLabel="Robô I.A"
        customLabel={customLabel}
        colorClass="bg-cyan-500/10"
        textColorClass="text-cyan-500"
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(l) => (data as any)?.onRename?.(id, l)}
      />
      <div className="px-4 py-3 space-y-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Ação do Robô</Label>
          <Select
            value={botAction}
            onValueChange={(v) => {
              setBotAction(v);
              update({ bot_action: v });
            }}
          >
            <SelectTrigger className="h-8 text-xs nodrag mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enable">Ativar Robô I.A</SelectItem>
              <SelectItem value="disable">Desativar Robô I.A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isEnable ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
          <Bot className="h-3.5 w-3.5" />
          <span>{isEnable ? "O robô será ativado para este lead" : "O robô será desativado para este lead"}</span>
        </div>

        {/* Notify platform option */}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-500/10 px-2.5 py-2 border border-blue-500/20">
          <div>
            <p className="text-[11px] font-medium">Notificar plataforma</p>
            <p className="text-[9px] text-muted-foreground">Exibe ícone no chat indicando que o robô finalizou o atendimento</p>
          </div>
          <Switch
            checked={notifyFinished}
            onCheckedChange={(v) => {
              setNotifyFinished(v);
              update({ notify_finished: v });
            }}
          />
        </div>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id}
        nodeLabel={customLabel || "Robô I.A"}
        output={(data as any)?.nodeOutput}
        error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false}
        isExecuting={(data as any)?.isExecuting || false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-cyan-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const BotToggleNode = memo(BotToggleNodeComponent);
