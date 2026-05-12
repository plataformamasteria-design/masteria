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
  { value: "marketing_metrics", label: "📊 Métrica de marketing" },
];

function ConditionNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [conditionType, setConditionType] = useState(config.condition_type || "response_equals");
  const [conditionValue, setConditionValue] = useState(config.condition_value || "");
  const [conditionValues, setConditionValues] = useState<string[]>(config.condition_values || [""]);
  const [marketingMetric, setMarketingMetric] = useState(config.marketing_metric || "CPL");
  const [marketingOperator, setMarketingOperator] = useState(config.marketing_operator || ">");

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
    <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background" />
      <NodeHeader nodeId={id} icon={<GitBranch className="h-4 w-4 text-amber-500" />} defaultLabel="Condição" customLabel={customLabel} colorClass="bg-amber-500/10" textColorClass="text-amber-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Tipo de condição</Label>
          <Select value={conditionType} onValueChange={(v) => { setConditionType(v); update({ condition_type: v }); }}>
            <SelectTrigger className="h-8 text-xs nodrag"><SelectValue /></SelectTrigger>
            <SelectContent>{conditionTypes.map((ct) => (<SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>))}</SelectContent>
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
              {conditionValues.map((val, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input value={val} onChange={(e) => updateValue(i, e.target.value)} placeholder={`Valor ${i + 1}`} className="h-7 text-xs nodrag" />
                  {conditionValues.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeValue(i)}><X className="h-3 w-3" /></Button>}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addValue}><Plus className="h-3 w-3" />Adicionar valor</Button>
            </div>
          </div>
        )}

        {conditionType === "marketing_metrics" && (
          <div className="space-y-2 mt-2 pt-2 border-t border-border/50">
            <div>
              <Label className="text-[10px] text-muted-foreground">Métrica</Label>
              <Select value={marketingMetric} onValueChange={(v) => { setMarketingMetric(v); update({ marketing_metric: v }); }}>
                <SelectTrigger className="h-7 text-xs nodrag"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPL">Custo por Lead (CPL)</SelectItem>
                  <SelectItem value="ROAS">Retorno (ROAS)</SelectItem>
                  <SelectItem value="CPC">Custo por Clique (CPC)</SelectItem>
                  <SelectItem value="CTR">Taxa de Cliques (CTR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Operador</Label>
                <Select value={marketingOperator} onValueChange={(v) => { setMarketingOperator(v); update({ marketing_operator: v }); }}>
                  <SelectTrigger className="h-7 text-xs nodrag"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">">Maior que (&gt;)</SelectItem>
                    <SelectItem value="<">Menor que (&lt;)</SelectItem>
                    <SelectItem value=">=">Maior ou igual (&ge;)</SelectItem>
                    <SelectItem value="<=">Menor ou igual (&le;)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Valor alvo</Label>
                <Input type="number" value={conditionValue} onChange={(e) => { setConditionValue(e.target.value); update({ condition_value: e.target.value }); }} placeholder="Ex: 5.50" className="h-7 text-xs nodrag" />
              </div>
            </div>
          </div>
        )}
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Condição"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <div className="flex justify-between px-6 pb-3">
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-emerald-500 font-medium">Sim</span>
          <Handle type="source" position={Position.Bottom} id="yes" className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !relative !transform-none !left-auto !right-auto" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-red-500 font-medium">Não</span>
          <Handle type="source" position={Position.Bottom} id="no" className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !relative !transform-none !left-auto !right-auto" />
        </div>
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
