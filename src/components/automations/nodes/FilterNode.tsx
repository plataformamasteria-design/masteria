import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Filter, Plus, X, GripVertical } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
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

const STANDARD_VARIABLES = [
  "{{last_response}}",
  "{{conversation.ai_active}}",
  "{{contact.tags}}",
  "{{contact.kanban_board}}",
  "{{contact.kanban_stage}}",
  "{{contact.name}}",
  "{{contact.phone}}",
  "{{contact.email}}",
];

function isStandardVar(v: string) {
  return STANDARD_VARIABLES.includes(v);
}

function FilterNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [conditions, setConditions] = useState<FilterCondition[]>(
    config.conditions?.length ? config.conditions : [{ field: "", operator: "equals", value: "" }]
  );
  const [matchMode, setMatchMode] = useState<string>(config.match_mode || "all");

  useEffect(() => {
    if (config.conditions?.length) setConditions(config.conditions);
  }, [JSON.stringify(config.conditions)]);
  useEffect(() => {
    if (config.match_mode) setMatchMode(config.match_mode);
  }, [config.match_mode]);

  const update = (conds: FilterCondition[], mode?: string) => {
    (data as any)?.onChange?.(id, {
      config: { ...(data as any)?.config, conditions: conds, match_mode: mode || matchMode },
    });
  };

  const updateCondition = (i: number, field: keyof FilterCondition, val: string) => {
    const next = [...conditions];
    next[i] = { ...next[i], [field]: val };
    setConditions(next);
    update(next);
  };

  const addCondition = () => {
    const next = [...conditions, { field: "", operator: "equals", value: "" }];
    setConditions(next);
    update(next);
  };

  const removeCondition = (i: number) => {
    const next = conditions.filter((_, idx) => idx !== i);
    setConditions(next);
    update(next);
  };

  const handleDrop = (i: number, e: React.DragEvent) => {
    e.preventDefault();
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        updateCondition(i, "field", parsed.ref);
        return;
      } catch {}
    }
    const text = e.dataTransfer.getData("text/plain");
    if (text) updateCondition(i, "field", text);
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[320px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-cyan-50 dark:bg-cyan-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader
        nodeId={id}
        icon={<Filter className="h-4 w-4 text-cyan-500" />}
        defaultLabel="Filtro"
        customLabel={customLabel}
        colorClass="bg-cyan-50 dark:bg-cyan-900/30"
        textColorClass="text-cyan-500"
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(l) => (data as any)?.onRename?.(id, l)}
      />

      <div className="px-4 py-3 space-y-3">
        {/* Match mode */}
        {conditions.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Combinar</Label>
            <Select value={matchMode} onValueChange={(v) => { setMatchMode(v); update(conditions, v); }}>
              <SelectTrigger className="h-7 text-xs nodrag"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas (AND)</SelectItem>
                <SelectItem value="any">Qualquer (OR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Label className="text-[10px] text-muted-foreground font-semibold uppercase">Condições</Label>

        <div className="space-y-2">
          {((Array.isArray(conditions) ? conditions : []) || []).map((cond, i) => (
            <div key={i} className="space-y-1 rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-muted/20 p-2">
              {/* Field with drop support and Variable Selector */}
              <div className="flex flex-col gap-1 w-full">
                <Select
                  value={isStandardVar(cond.field) ? cond.field : (cond.field ? "custom" : "")}
                  onValueChange={(v) => {
                    if (v !== "custom") updateCondition(i, "field", v);
                    else updateCondition(i, "field", ""); // Clear for custom typing
                  }}
                >
                  <SelectTrigger className="h-7 text-xs nodrag w-full">
                    <SelectValue placeholder="Selecione a Variável..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">Respostas & Lógica</SelectLabel>
                      <SelectItem value="{{last_response}}" className="text-xs">Última Mensagem</SelectItem>
                      <SelectItem value="{{conversation.ai_active}}" className="text-xs">Robô (IA) Ativo?</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">CRM e Organização</SelectLabel>
                      <SelectItem value="{{contact.tags}}" className="text-xs">Etiquetas (Tags)</SelectItem>
                      <SelectItem value="{{contact.kanban_board}}" className="text-xs">Funil Kanban</SelectItem>
                      <SelectItem value="{{contact.kanban_stage}}" className="text-xs">Etapa Kanban</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">Dados do Contato</SelectLabel>
                      <SelectItem value="{{contact.name}}" className="text-xs">Nome do Contato</SelectItem>
                      <SelectItem value="{{contact.phone}}" className="text-xs">Telefone</SelectItem>
                      <SelectItem value="{{contact.email}}" className="text-xs">E-mail</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">Avançado</SelectLabel>
                      <SelectItem value="custom" className="text-xs font-semibold text-primary">Variável Personalizada...</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                {(!isStandardVar(cond.field) || cond.field === "custom") && (
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      value={cond.field}
                      onChange={(e) => updateCondition(i, "field", e.target.value)}
                      placeholder="Campo Personalizado ou Webhook..."
                      className="h-7 text-xs nodrag font-mono flex-1"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(i, e)}
                    />
                    {conditions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCondition(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
                {isStandardVar(cond.field) && conditions.length > 1 && (
                   <div className="flex justify-end">
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCondition(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                   </div>
                )}
              </div>
              {/* Operator + Value */}
              <div className="flex items-center gap-1">
                <Select value={cond.operator} onValueChange={(v) => updateCondition(i, "operator", v)}>
                  <SelectTrigger className="h-7 text-[10px] nodrag flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {((Array.isArray(OPERATORS) ? OPERATORS : []) || []).map((op) => (
                      <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!NO_VALUE_OPERATORS.includes(cond.operator) && (
                  <Input
                    value={cond.value}
                    onChange={(e) => updateCondition(i, "value", e.target.value)}
                    placeholder="Valor"
                    className="h-7 text-xs nodrag flex-1"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const outputData = e.dataTransfer.getData("application/x-node-output");
                      if (outputData) {
                        try {
                          const parsed = JSON.parse(outputData);
                          updateCondition(i, "value", parsed.ref);
                          return;
                        } catch {}
                      }
                      const text = e.dataTransfer.getData("text/plain");
                      if (text) updateCondition(i, "value", text);
                    }}
                  />
                )}
              </div>
              {/* Show variable preview */}
              {cond.field.match(/\{\{.+\}\}/) && (
                <div className="flex items-center gap-1 px-0.5">
                  <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 truncate">
                    {cond.field.replace(/\{\{\s*|\s*\}\}/g, "").split(".$json.")[0]}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addCondition}>
          <Plus className="h-3 w-3" /> Adicionar condição
        </Button>
      </div>

      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id}
        nodeLabel={customLabel || "Filtro"}
        output={(data as any)?.nodeOutput}
        error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false}
        isExecuting={(data as any)?.isExecuting || false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />

      {/* Two outputs: Pass / Block */}
      <div className="flex justify-between px-6 pb-4">
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-emerald-500 font-medium mb-1">Passou</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-red-500 font-medium mb-1">Bloqueado</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="pass" className="!w-4 !h-4 !bg-emerald-50 dark:bg-emerald-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" style={{ left: '20%' }} />
      <Handle type="source" position={Position.Bottom} id="block" className="!w-4 !h-4 !bg-red-50 dark:bg-red-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" style={{ left: '80%' }} />
    </div>
  );
}

export const FilterNode = memo(FilterNodeComponent);
