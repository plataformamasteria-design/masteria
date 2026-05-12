import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { PenLine, ChevronDown, ChevronRight, Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

const FIELD_TYPES = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
] as const;

const MODES = [
  { value: "manual", label: "Manual Mapping" },
  { value: "json", label: "JSON" },
] as const;

interface FieldMapping { id: string; name: string; type: string; value: string; sourceNodeLabel?: string; sourceValue?: string; }
function newField(): FieldMapping { return { id: crypto.randomUUID(), name: "", type: "string", value: "" }; }

function EditFieldsNodeComponent({ id, data }: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const config = (data as any)?.config || {};
  const onChange = (data as any)?.onChange;
  const customLabel = (data as any)?.label || "";

  const mode = config.mode || "manual";
  const fields: FieldMapping[] = config.fields || [];
  const jsonValue = config.json_value || "{}";
  const duplicateHandling = config.duplicate_handling || "update";

  const updateConfig = (patch: Record<string, any>) => {
    if (!onChange) return;
    onChange(id, { config: { ...config, ...patch } });
  };

  const addField = () => updateConfig({ fields: [...fields, newField()] });
  const removeField = (fieldId: string) => updateConfig({ fields: fields.filter((f) => f.id !== fieldId) });
  const updateField = (fieldId: string, key: keyof FieldMapping, val: string) =>
    updateConfig({ fields: fields.map((f) => (f.id === fieldId ? { ...f, [key]: val } : f)) });

  const handleDropOnField = (e: React.DragEvent, fieldId: string, targetKey: "name" | "value") => {
    e.preventDefault();
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        const updatedFields = fields.map((f) => {
          if (f.id !== fieldId) return f;
          return {
            ...f,
            [targetKey]: parsed.ref,
            ...(targetKey === "value" ? { sourceNodeLabel: parsed.nodeLabel, sourceValue: parsed.value } : {}),
          };
        });
        updateConfig({ fields: updatedFields });
        return;
      } catch {}
    }
    const text = e.dataTransfer.getData("text/plain");
    if (text) updateField(fieldId, targetKey, text);
  };

  const fieldCount = fields.length;
  const summaryText = mode === "manual"
    ? `${fieldCount} campo${fieldCount !== 1 ? "s" : ""} configurado${fieldCount !== 1 ? "s" : ""}`
    : "JSON mode";

  return (
    <div className="bg-card border-2 border-teal-500/60 rounded-xl shadow-lg min-w-[260px] max-w-[380px] overflow-hidden">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-teal-500 !border-2 !border-card" />
      <NodeHeader
        nodeId={id}
        icon={<PenLine className="h-4 w-4 text-white" />}
        defaultLabel="Edit Fields"
        customLabel={customLabel}
        colorClass="bg-teal-600"
        textColorClass="text-white"
        solidHeader
        showOnHover={false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(label) => (data as any)?.onRename?.(id, label)}
      />

      <button className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-accent/30 transition-colors nodrag"
        onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="text-[11px] text-muted-foreground truncate flex-1">{summaryText}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3 max-h-[500px] overflow-y-auto nowheel nodrag">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Mode</Label>
            <Select value={mode} onValueChange={(v) => updateConfig({ mode: v })}>
              <SelectTrigger className="h-7 text-[11px] nodrag"><SelectValue /></SelectTrigger>
              <SelectContent>{MODES.map((m) => (<SelectItem key={m.value} value={m.value} className="text-[11px]">{m.label}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Quando campo duplicado</Label>
            <Select value={duplicateHandling} onValueChange={(v) => updateConfig({ duplicate_handling: v })}>
              <SelectTrigger className="h-7 text-[11px] nodrag"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="update" className="text-[11px]">Atualizar</SelectItem>
                <SelectItem value="skip" className="text-[11px]">Ignorar</SelectItem>
                <SelectItem value="append" className="text-[11px]">Adicionar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "manual" ? (
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Fields to Set</Label>
              {fields.map((field) => (
                <div key={field.id} className="rounded-lg border border-border/60 p-2 space-y-1.5 bg-muted/30">
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <Input value={field.name} onChange={(e) => updateField(field.id, "name", e.target.value)}
                      onDrop={(e) => handleDropOnField(e, field.id, "name")} onDragOver={(e) => e.preventDefault()}
                      placeholder="Nome do campo" className="h-6 text-[11px] font-semibold flex-1 border-none bg-transparent px-1 nodrag" />
                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeField(field.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Select value={field.type} onValueChange={(v) => updateField(field.id, "type", v)}>
                    <SelectTrigger className="h-6 text-[10px] nodrag"><span className="text-muted-foreground mr-1">T</span><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map((t) => (<SelectItem key={t.value} value={t.value} className="text-[11px]">{t.label}</SelectItem>))}</SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">=</span>
                    <Input value={field.value} onChange={(e) => updateField(field.id, "value", e.target.value)}
                      onDrop={(e) => handleDropOnField(e, field.id, "value")} onDragOver={(e) => e.preventDefault()}
                      placeholder="Arraste output ou {{ NomeDoNó.$json.campo }}" className="h-6 text-[11px] font-mono flex-1 nodrag" />
                  </div>
                  {/* Preview of source node */}
                  {field.sourceNodeLabel && (
                    <div className="flex items-center gap-1 px-1">
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600">
                        ← {field.sourceNodeLabel}
                      </span>
                      {field.sourceValue && (
                        <span className="text-[8px] text-muted-foreground truncate">
                          = {field.sourceValue.length > 25 ? field.sourceValue.slice(0, 25) + "..." : field.sourceValue}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={addField}>
                <Plus className="h-3 w-3 mr-1" />Adicionar Campo
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">JSON</Label>
              <Textarea value={jsonValue} onChange={(e) => updateConfig({ json_value: e.target.value })}
                onDrop={(e) => {
                  e.preventDefault();
                  const outputData = e.dataTransfer.getData("application/x-node-output");
                  if (outputData) { try { const p = JSON.parse(outputData); updateConfig({ json_value: jsonValue + p.ref }); } catch {} }
                }}
                onDragOver={(e) => e.preventDefault()}
                className="text-[11px] font-mono min-h-[120px] nodrag nowheel"
                placeholder={`{\n  "campo1": "{{ NomeDoNó.$json.valor }}",\n  "campo2": "texto fixo"\n}`} spellCheck={false} />
            </div>
          )}

          <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-2">
            <p className="text-[10px] text-teal-600 dark:text-teal-400">
              Arraste campos do output de outros nós ou use <code className="font-mono bg-teal-500/20 px-1 rounded">{"{{ NomeDoNó.$json.campo }}"}</code>
            </p>
          </div>
        </div>
      )}

      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Edit Fields"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-teal-500 !border-2 !border-card" />
    </div>
  );
}

export const EditFieldsNode = memo(EditFieldsNodeComponent);
