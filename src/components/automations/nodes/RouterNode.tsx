import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Signpost, Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

interface RoutingRule {
  field: string;
  operator: string;
  value: string;
  outputName: string;
  renameOutput: boolean;
}

const OPERATORS = [
  { value: "equals", label: "é igual a" },
  { value: "not_equals", label: "não é igual a" },
  { value: "contains", label: "contém" },
  { value: "not_contains", label: "não contém" },
  { value: "starts_with", label: "começa com" },
  { value: "ends_with", label: "termina com" },
  { value: "is_empty", label: "está vazio" },
  { value: "is_not_empty", label: "não está vazio" },
  { value: "greater_than", label: "maior que" },
  { value: "less_than", label: "menor que" },
  { value: "regex", label: "regex" },
];

const NO_VALUE_OPERATORS = ["is_empty", "is_not_empty"];

const ROUTE_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500",
  "bg-purple-500", "bg-red-500", "bg-teal-500", "bg-orange-500",
];

function RouterNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [mode, setMode] = useState<string>(config.mode || "rules");
  const [rules, setRules] = useState<RoutingRule[]>(
    config.rules?.length
      ? config.rules
      : [{ field: "", operator: "equals", value: "", outputName: "Saída 1", renameOutput: false }]
  );

  useEffect(() => {
    if (config.rules?.length) setRules(config.rules);
  }, [JSON.stringify(config.rules)]);
  useEffect(() => {
    if (config.mode) setMode(config.mode);
  }, [config.mode]);

  const update = (nextRules: RoutingRule[], nextMode?: string) => {
    (data as any)?.onChange?.(id, {
      config: { ...(data as any)?.config, rules: nextRules, mode: nextMode || mode },
    });
  };

  const updateRule = (i: number, field: keyof RoutingRule, val: any) => {
    const next = [...rules];
    next[i] = { ...next[i], [field]: val };
    setRules(next);
    update(next);
  };

  const addRule = () => {
    const next = [...rules, { field: "", operator: "equals", value: "", outputName: `Saída ${rules.length + 1}`, renameOutput: false }];
    setRules(next);
    update(next);
  };

  const removeRule = (i: number) => {
    if (rules.length <= 1) return;
    const next = rules.filter((_, idx) => idx !== i);
    setRules(next);
    update(next);
  };

  const handleFieldDrop = (i: number, e: React.DragEvent) => {
    e.preventDefault();
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        updateRule(i, "field", parsed.ref);
        return;
      } catch {}
    }
    const text = e.dataTransfer.getData("text/plain");
    if (text) updateRule(i, "field", text);
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[340px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-indigo-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader
        nodeId={id}
        icon={<Signpost className="h-4 w-4 text-indigo-500" />}
        defaultLabel="Caminho"
        customLabel={customLabel}
        colorClass="bg-indigo-500/10"
        textColorClass="text-indigo-500"
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(l) => (data as any)?.onRename?.(id, l)}
      />

      <div className="px-4 py-3 space-y-3">
        {/* Mode selector */}
        <div>
          <Label className="text-[10px] text-muted-foreground">Modo</Label>
          <Select value={mode} onValueChange={(v) => { setMode(v); update(rules, v); }}>
            <SelectTrigger className="h-7 text-xs nodrag"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rules">Regras</SelectItem>
              <SelectItem value="expression">Expressão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Label className="text-[10px] text-muted-foreground font-semibold uppercase">Regras de Roteamento</Label>

        <div className="space-y-3">
          {((Array.isArray(rules) ? rules : []) || []).map((rule, i) => {
            const colorClass = ROUTE_COLORS[i % ROUTE_COLORS.length];
            return (
              <div key={i} className="space-y-1.5 rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-muted/20 p-2">
                {/* Route color indicator */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                  <span className="text-[10px] font-semibold text-foreground flex-1">Rota {i + 1}</span>
                  {rules.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeRule(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Field input with drop */}
                <Input
                  value={rule.field}
                  onChange={(e) => updateRule(i, "field", e.target.value)}
                  placeholder="Campo ou {{ referência }}"
                  className="h-7 text-xs nodrag font-mono"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleFieldDrop(i, e)}
                />

                {/* Operator + Value */}
                <div className="flex items-center gap-1">
                  <Select value={rule.operator} onValueChange={(v) => updateRule(i, "operator", v)}>
                    <SelectTrigger className="h-7 text-[10px] nodrag flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {((Array.isArray(OPERATORS) ? OPERATORS : []) || []).map((op) => (
                        <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!NO_VALUE_OPERATORS.includes(rule.operator) && (
                    <Input
                      value={rule.value}
                      onChange={(e) => updateRule(i, "value", e.target.value)}
                      placeholder="Valor"
                      className="h-7 text-xs nodrag flex-1"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const od = e.dataTransfer.getData("application/x-node-output");
                        if (od) { try { updateRule(i, "value", JSON.parse(od).ref); return; } catch {} }
                        const t = e.dataTransfer.getData("text/plain");
                        if (t) updateRule(i, "value", t);
                      }}
                    />
                  )}
                </div>

                {/* Rename output toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={rule.renameOutput}
                    onCheckedChange={(c) => updateRule(i, "renameOutput", c)}
                    className="nodrag scale-75"
                  />
                  <span className="text-[9px] text-muted-foreground">Renomear Saída</span>
                </div>
                {rule.renameOutput && (
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Nome da Saída</Label>
                    <Input
                      value={rule.outputName}
                      onChange={(e) => updateRule(i, "outputName", e.target.value)}
                      placeholder="Nome da saída"
                      className="h-7 text-xs nodrag"
                    />
                  </div>
                )}

                {/* Variable preview */}
                {rule.field.match(/\{\{.+\}\}/) && (
                  <div className="flex items-center gap-1 px-0.5">
                    <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-violet-500/10 text-violet-600 truncate">
                      {rule.field.replace(/\{\{\s*|\s*\}\}/g, "").split(".$json.")[0]}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addRule}>
          <Plus className="h-3 w-3" /> Adicionar rota
        </Button>
      </div>

      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id}
        nodeLabel={customLabel || "Caminho"}
        output={(data as any)?.nodeOutput}
        error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false}
        isExecuting={(data as any)?.isExecuting || false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />

      {/* Dynamic outputs: one per rule + fallback */}
      <div className="flex flex-wrap justify-center gap-3 px-4 pb-4">
        {((Array.isArray(rules) ? rules : []) || []).map((rule, i) => {
          const colorClass = ROUTE_COLORS[i % ROUTE_COLORS.length];
          const label = rule.renameOutput && rule.outputName ? rule.outputName : `Rota ${i + 1}`;
          return (
            <div key={i} className="flex flex-col items-center relative">
              <span className="text-[8px] text-muted-foreground font-medium truncate max-w-[60px] mb-1">{label}</span>
              <Handle
                type="source"
                position={Position.Bottom}
                id={`route-${i}`}
                className={`!w-3 !h-3 ${colorClass.replace("bg-", "!bg-")} !border-2 !border-background`}
              />
            </div>
          );
        })}
        <div className="flex flex-col items-center relative">
          <span className="text-[8px] text-muted-foreground font-medium mb-1">Outros</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="fallback"
            className="!w-4 !h-4 !bg-gray-400 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125"
          />
        </div>
      </div>
    </div>
  );
}

export const RouterNode = memo(RouterNodeComponent);
