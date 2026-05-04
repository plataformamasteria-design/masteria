import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Code2, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
] as const;

const DEFAULT_CODE: Record<string, string> = {
  javascript: `// Dados disponíveis:\n// - input: dados do nó anterior\n// - context: { chatId, phone, leadName }\n//\n// Retorne um objeto com os dados de saída:\n\nconst result = {\n  message: "Olá!",\n};\n\nreturn result;`,
  python: `# Dados disponíveis:\n# - input: dados do nó anterior\n# - context: { chatId, phone, leadName }\n#\n# Retorne um dict com os dados de saída:\n\nresult = {\n    "message": "Olá!"\n}\n\nreturn result`,
};

const LANG_COLORS: Record<string, string> = { javascript: "text-yellow-400", python: "text-blue-400" };

function CodeNodeComponent({ id, data }: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const config = (data as any)?.config || {};
  const onChange = (data as any)?.onChange;
  const customLabel = (data as any)?.label || "";

  const language = config.language || "javascript";
  const code = config.code || DEFAULT_CODE[language] || "";
  const mode = config.mode || "run_once";

  const updateConfig = (patch: Record<string, any>) => {
    if (!onChange) return;
    onChange(id, { config: { ...config, ...patch } });
  };

  const handleDropOnCode = (e: React.DragEvent) => {
    e.preventDefault();
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        const textarea = e.target as HTMLTextAreaElement;
        const start = textarea.selectionStart || code.length;
        const newCode = code.substring(0, start) + parsed.ref + code.substring(start);
        updateConfig({ code: newCode });
        return;
      } catch {}
    }
    const text = e.dataTransfer.getData("text/plain");
    if (text) updateConfig({ code: code + text });
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border-2 border-purple-500/60 rounded-xl shadow-lg min-w-[260px] max-w-[380px] overflow-visible">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-purple-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader
        nodeId={id}
        icon={<Code2 className="h-4 w-4 text-white" />}
        defaultLabel="Código"
        customLabel={customLabel}
        colorClass="bg-purple-600"
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
        <span className={`text-[11px] font-bold ${LANG_COLORS[language] || ""}`}>
          {language === "javascript" ? "JavaScript" : "Python"}
        </span>
        <span className="text-[11px] text-muted-foreground truncate flex-1">
          {code.split("\n").find((l: string) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("#")) || "Configurar código..."}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-200 dark:border-zinc-800/40 pt-3 max-h-[500px] overflow-y-auto nowheel nodrag">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Mode</Label>
            <Select value={mode} onValueChange={(v) => updateConfig({ mode: v })}>
              <SelectTrigger className="h-7 text-[11px] nodrag"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="run_once" className="text-[11px]">Run Once for All Items</SelectItem>
                <SelectItem value="run_each" className="text-[11px]">Run Once for Each Item</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Language</Label>
            <Select value={language} onValueChange={(v) => updateConfig({ language: v, code: config.code === DEFAULT_CODE[language] ? DEFAULT_CODE[v] : config.code })}>
              <SelectTrigger className="h-7 text-[11px] nodrag"><SelectValue /></SelectTrigger>
              <SelectContent>
                {((Array.isArray(LANGUAGES) ? LANGUAGES : []) || []).map((l) => (<SelectItem key={l.value} value={l.value} className="text-[11px]"><span className={LANG_COLORS[l.value]}>{l.label}</span></SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Código</Label>
            <Textarea
              value={code}
              onChange={(e) => updateConfig({ code: e.target.value })}
              onDrop={handleDropOnCode}
              onDragOver={(e) => e.preventDefault()}
              onKeyDown={(e) => e.stopPropagation()}
              className="text-[11px] font-mono min-h-[180px] bg-zinc-950 text-zinc-100 border-zinc-700 nodrag nowheel nopan"
              placeholder="Escreva seu código aqui..."
              spellCheck={false}
            />
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Arraste campos do output de outros nós ou use <code className="font-mono bg-amber-500/20 px-1 rounded">{"{{ NomeDoNó.$json.campo }}"}</code>
            </p>
          </div>
        </div>
      )}

      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Código"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-purple-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const CodeNode = memo(CodeNodeComponent);
