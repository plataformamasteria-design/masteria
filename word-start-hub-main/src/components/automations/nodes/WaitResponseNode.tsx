import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageCircle, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function WaitResponseNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [timeout, setTimeout] = useState(config.timeout_amount || "24");
  const [timeoutUnit, setTimeoutUnit] = useState(config.timeout_unit || "hours");
  const [immediateResponse, setImmediateResponse] = useState(config.immediate_response || false);

  useEffect(() => { setTimeout(config.timeout_amount || "24"); }, [config.timeout_amount]);
  useEffect(() => { setTimeoutUnit(config.timeout_unit || "hours"); }, [config.timeout_unit]);
  useEffect(() => { setImmediateResponse(config.immediate_response || false); }, [config.immediate_response]);

  const updateConfig = (updates: any) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-background" />
      <NodeHeader nodeId={id} icon={<MessageCircle className="h-4 w-4 text-cyan-500" />} defaultLabel="Aguardar Resposta" customLabel={customLabel} colorClass="bg-cyan-500/10" textColorClass="text-cyan-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        <p className="text-[10px] text-muted-foreground">Pausa o fluxo até o contato enviar uma mensagem via WhatsApp.</p>
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-cyan-500" />
            <Label className="text-[10px] font-medium text-cyan-600 cursor-pointer">Resposta imediata</Label>
          </div>
          <Switch checked={immediateResponse} onCheckedChange={(v) => { setImmediateResponse(v); updateConfig({ immediate_response: v }); }} className="nodrag scale-75" />
        </div>
        {immediateResponse && <p className="text-[9px] text-cyan-600/70">Continua o fluxo assim que o lead responder, sem esperar tempo.</p>}
        <div>
          <Label className="text-[10px] text-muted-foreground">Tempo limite (timeout)</Label>
          <div className="flex gap-2 mt-1">
            <Input type="number" min="1" value={timeout} onChange={(e) => { setTimeout(e.target.value); updateConfig({ timeout_amount: e.target.value }); }} className="h-8 text-xs w-20 nodrag" />
            <Select value={timeoutUnit} onValueChange={(v) => { setTimeoutUnit(v); updateConfig({ timeout_unit: v }); }}>
              <SelectTrigger className="h-8 text-xs nodrag flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Segundos</SelectItem>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Aguardar Resposta"} nodeType="wait_response" output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <div className="flex justify-around px-4 pb-3">
        <div className="flex flex-col items-center">
          <span className="text-[8px] text-muted-foreground">Respondeu</span>
          <Handle type="source" position={Position.Bottom} id="responded" className="!w-2.5 !h-2.5 !bg-cyan-500 !border-2 !border-background !relative !transform-none !left-auto !right-auto" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] text-orange-500 font-medium">Timeout</span>
          <Handle type="source" position={Position.Bottom} id="timeout" className="!w-2.5 !h-2.5 !bg-orange-500 !border-2 !border-background !relative !transform-none !left-auto !right-auto" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] text-red-500 font-medium">Fallback</span>
          <Handle type="source" position={Position.Bottom} id="fallback" className="!w-2.5 !h-2.5 !bg-red-500 !border-2 !border-background !relative !transform-none !left-auto !right-auto" />
        </div>
      </div>
    </div>
  );
}

export const WaitResponseNode = memo(WaitResponseNodeComponent);
