import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitBranch, Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

const conditionTypes = [
  { value: "has_tag", label: "Possui tag" },
  { value: "is_assigned", label: "Está atribuído" },
  { value: "response_equals", label: "Resposta igual a" },
  { value: "response_contains", label: "Resposta contém" },
  { value: "response_in", label: "Resposta é uma de" },
];

function ConditionNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [conditionType, setConditionType] = useState(config.condition_type || "response_equals");
  const [conditionValue, setConditionValue] = useState(config.condition_value || "");
  const [conditionValues, setConditionValues] = useState<string[]>(config.condition_values || [""]);

  useEffect(() => { setConditionType(config.condition_type || "response_equals"); }, [config.condition_type]);
  useEffect(() => { setConditionValue(config.condition_value || ""); }, [config.condition_value]);
  useEffect(() => { if (config.condition_values?.length) setConditionValues(config.condition_values); }, [JSON.stringify(config.condition_values)]);

  const update = (updates: Record<string, any>) => {
    (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } });
  };

  const needsValue = conditionType !== "is_assigned";
  const isMultiValue = conditionType === "response_in";

  const addValue = () => { const nv = [...conditionValues, ""]; setConditionValues(nv); update({ condition_values: nv }); };
  const removeValue = (i: number) => { const nv = conditionValues.filter((_, idx) => idx !== i); setConditionValues(nv); update({ condition_values: nv }); };
  const updateValue = (i: number, val: string) => { const nv = [...conditionValues]; nv[i] = val; setConditionValues(nv); update({ condition_values: nv }); };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[260px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-amber-50 dark:bg-amber-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader nodeId={id} icon={<GitBranch className="h-4 w-4 text-amber-500" />} defaultLabel="Condição" customLabel={customLabel} colorClass="bg-amber-50 dark:bg-amber-900/30" textColorClass="text-amber-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Tipo de condição</Label>
          <Select value={conditionType} onValueChange={(v) => { setConditionType(v); update({ condition_type: v }); }}>
            <SelectTrigger className="h-8 text-xs nodrag"><SelectValue /></SelectTrigger>
            <SelectContent>{((Array.isArray(conditionTypes) ? conditionTypes : []) || []).map((ct) => (<SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        {needsValue && !isMultiValue && (
          <div>
            <Label className="text-[10px] text-muted-foreground">Valor</Label>
            <Input value={conditionValue} onChange={(e) => { setConditionValue(e.target.value); update({ condition_value: e.target.value }); }} placeholder={conditionType === "has_tag" ? "Nome ou ID da tag" : "Valor esperado"} className="h-8 text-xs nodrag" />
          </div>
        )}
        {isMultiValue && (
          <div>
            <Label className="text-[10px] text-muted-foreground">Valores aceitos</Label>
            <div className="space-y-1.5 mt-1">
              {((Array.isArray(conditionValues) ? conditionValues : []) || []).map((val, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input value={val} onChange={(e) => updateValue(i, e.target.value)} placeholder={`Valor ${i + 1}`} className="h-7 text-xs nodrag" />
                  {conditionValues.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeValue(i)}><X className="h-3 w-3" /></Button>}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addValue}><Plus className="h-3 w-3" />Adicionar valor</Button>
            </div>
          </div>
        )}
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Condição"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <div className="flex justify-between px-6 pb-4">
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-emerald-500 font-medium mb-1">Sim</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-red-500 font-medium mb-1">Não</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" className="!w-4 !h-4 !bg-emerald-50 dark:bg-emerald-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" style={{ left: '20%' }} />
      <Handle type="source" position={Position.Bottom} id="no" className="!w-4 !h-4 !bg-red-50 dark:bg-red-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" style={{ left: '80%' }} />
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
