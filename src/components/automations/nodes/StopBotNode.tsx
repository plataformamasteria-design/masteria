import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { ShieldOff } from "lucide-react";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function StopBotNodeComponent({ id, data }: NodeProps) {
  const customLabel = (data as any)?.label || "";

  return (
    <div className="bg-white dark:bg-zinc-950 border-2 border-red-500/60 rounded-xl shadow-lg min-w-[260px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-red-50 dark:bg-red-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader
        nodeId={id}
        icon={<ShieldOff className="h-4 w-4 text-red-500" />}
        defaultLabel="Parar Automação"
        customLabel={customLabel}
        colorClass="bg-red-50 dark:bg-red-900/30"
        textColorClass="text-red-500"
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(l) => (data as any)?.onRename?.(id, l)}
      />
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-xs text-red-600 dark:text-red-400">
          <ShieldOff className="h-3.5 w-3.5 shrink-0" />
          <span>Nenhuma automação será ativada para este lead, independente do gatilho configurado.</span>
        </div>
        <p className="text-[9px] text-muted-foreground">
          O lead será permanentemente bloqueado de todas as automações. Para reativar, será necessário remover o bloqueio manualmente.
        </p>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id}
        nodeLabel={customLabel || "Parar Automação"}
        output={(data as any)?.nodeOutput}
        error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false}
        isExecuting={(data as any)?.isExecuting || false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-red-50 dark:bg-red-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const StopBotNode = memo(StopBotNodeComponent);
