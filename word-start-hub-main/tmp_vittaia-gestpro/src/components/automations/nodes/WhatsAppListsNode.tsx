import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Users2 } from "lucide-react";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function WhatsAppListsNodeComponent({ id, data }: NodeProps) {
    const customLabel = (data as any)?.label || "";

    return (
        <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<Users2 className="h-4 w-4 text-indigo-500" />}
                defaultLabel="Listas (WhatsApp API)"
                customLabel={customLabel}
                colorClass="bg-indigo-500/10"
                textColorClass="text-indigo-500"
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-2 text-center text-xs text-muted-foreground p-4">
                <p>Consulta as listas de envio cadastradas para disparo no WhatsApp Oficial.</p>
                <p>Injeta a relação completa de listas (IDs, nomes e metadados) no contexto da Inteligência Artificial ou fluxos condicionais.</p>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />

            <NodeOutputPanel
                nodeId={id}
                nodeLabel={customLabel || "Listas do WhatsApp"}
                output={(data as any)?.nodeOutput}
                error={(data as any)?.nodeError}
                isPinned={(data as any)?.isPinned || false}
                isExecuting={(data as any)?.isExecuting || false}
                onExecute={() => (data as any)?.onExecute?.(id)}
                onPin={() => (data as any)?.onPinOutput?.(id)}
                onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
            />

            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-background" />
        </div>
    );
}

export const WhatsAppListsNode = memo(WhatsAppListsNodeComponent);
