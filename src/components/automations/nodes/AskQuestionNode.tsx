import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { HelpCircle, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NodeStatsBar } from "./NodeStatsBar";
import { VariablePicker } from "../VariablePicker";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function AskQuestionNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [question, setQuestion] = useState(config.question || "");
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const [options, setOptions] = useState<string[]>(config.options || ["Opção 1", "Opção 2"]);

  useEffect(() => { setQuestion(config.question || ""); }, [config.question]);
  useEffect(() => { if (config.options?.length) setOptions(config.options); }, [JSON.stringify(config.options)]);

  const updateConfig = (updates: any) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };
  const addOption = () => { const no = [...options, `Opção ${options.length + 1}`]; setOptions(no); updateConfig({ options: no }); };
  const removeOption = (i: number) => { const no = options.filter((_, idx) => idx !== i); setOptions(no); updateConfig({ options: no }); };
  const updateOption = (i: number, v: string) => { const no = [...options]; no[i] = v; setOptions(no); updateConfig({ options: no }); };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[280px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-emerald-50 dark:bg-emerald-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader nodeId={id} icon={<HelpCircle className="h-4 w-4 text-emerald-500" />} defaultLabel="Fazer Pergunta" customLabel={customLabel} colorClass="bg-emerald-50 dark:bg-emerald-900/30" textColorClass="text-emerald-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Pergunta</Label>
          <div className="flex items-start gap-1">
            <Textarea ref={questionRef} value={question} onChange={(e) => { setQuestion(e.target.value); updateConfig({ question: e.target.value }); }} placeholder="O que deseja perguntar?" rows={2} className="text-xs resize-none nodrag nowheel flex-1" />
            <VariablePicker compact onInsert={(variable) => {
              const ta = questionRef.current;
              if (ta) { const s = ta.selectionStart; const e = ta.selectionEnd; const nv = question.substring(0, s) + variable + question.substring(e); setQuestion(nv); updateConfig({ question: nv }); setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + variable.length; ta.focus(); }, 0); }
              else { const nv = question + variable; setQuestion(nv); updateConfig({ question: nv }); }
            }} />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Opções de resposta</Label>
          <div className="space-y-1.5 mt-1">
            {((Array.isArray(options) ? options : []) || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                <Input value={opt} onChange={(e) => updateOption(i, e.target.value)} className="h-7 text-xs nodrag" />
                {options.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeOption(i)}><X className="h-3 w-3" /></Button>}
              </div>
            ))}
            {options.length < 5 && <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 w-full" onClick={addOption}><Plus className="h-3 w-3" />Adicionar opção</Button>}
          </div>
        </div>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Fazer Pergunta"} nodeType="ask_question" output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <div className="flex justify-around px-4 pb-4 flex-wrap gap-y-3">
        {((Array.isArray(options) ? options : []) || []).map((opt, i) => (
          <div key={i} className="flex flex-col items-center relative">
            <span className="text-[8px] text-muted-foreground truncate max-w-[60px] mb-1">{opt}</span>
            <Handle type="source" position={Position.Bottom} id={`opt-${i}`} className="!w-4 !h-4 !bg-emerald-50 dark:bg-emerald-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
          </div>
        ))}
        <div className="flex flex-col items-center relative">
          <span className="text-[8px] text-orange-500 font-medium mb-1">Outro</span>
          <Handle type="source" position={Position.Bottom} id="fallback" className="!w-4 !h-4 !bg-orange-50 dark:bg-orange-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
        </div>
      </div>
    </div>
  );
}

export const AskQuestionNode = memo(AskQuestionNodeComponent);
