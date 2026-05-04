import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function DelayNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [amount, setAmount] = useState(config.amount || "1");
  const [unit, setUnit] = useState(config.unit || "hours");

  useEffect(() => { setAmount(config.amount || "1"); }, [config.amount]);
  useEffect(() => { setUnit(config.unit || "hours"); }, [config.unit]);

  const update = (field: string, value: string) => {
    (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, [field]: value } });
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[220px] overflow-visible transition-all hover:shadow-xl group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-purple-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader nodeId={id} icon={<Clock className="h-4 w-4 text-purple-500" />} defaultLabel="Aguardar" customLabel={customLabel} colorClass="bg-purple-500/10" textColorClass="text-purple-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 flex gap-2">
        <Input type="number" min="1" value={amount} onChange={(e) => { setAmount(e.target.value); update("amount", e.target.value); }} className="h-8 text-xs w-20 nodrag" />
        <Select value={unit} onValueChange={(v) => { setUnit(v); update("unit", v); }}>
          <SelectTrigger className="h-8 text-xs nodrag"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="seconds">Segundos</SelectItem>
            <SelectItem value="minutes">Minutos</SelectItem>
            <SelectItem value="hours">Horas</SelectItem>
            <SelectItem value="days">Dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Aguardar"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-purple-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const DelayNode = memo(DelayNodeComponent);
