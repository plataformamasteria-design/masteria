import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { NodeStatsBar } from "./NodeStatsBar";
import { VariablePicker } from "../VariablePicker";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function SendMessageNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const [message, setMessage] = useState(config.message || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const customLabel = (data as any)?.label || "";

  const configMessage = config.message || "";
  useEffect(() => { setMessage(configMessage); }, [configMessage]);

  const handleChange = (val: string) => {
    setMessage(val);
    (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, message: val } });
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newVal = message.substring(0, start) + variable + message.substring(end);
      handleChange(newVal);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
      }, 0);
    } else {
      handleChange(message + variable);
    }
  };

  const renderPreview = () => {
    if (!message) return null;
    const parts = message.split(/(\{\{[^}]+\}\})/g);
    const hasVariables = parts.some(p => p.startsWith('{{'));
    if (!hasVariables) return null;
    return (
      <div className="px-4 pb-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
        {parts.filter(p => p.startsWith('{{')).map((p, i) => (
          <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-mono text-[9px]">{p}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[260px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-blue-50 dark:bg-blue-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader
        nodeId={id}
        icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
        defaultLabel="Enviar Mensagem"
        customLabel={customLabel}
        colorClass="bg-blue-50 dark:bg-blue-900/30"
        textColorClass="text-blue-500"
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(label) => (data as any)?.onRename?.(id, label)}
      />
      <div className="px-4 py-3">
        <div className="flex items-start gap-1">
          <Textarea ref={textareaRef} value={message} onChange={(e) => handleChange(e.target.value)} placeholder="Digite a mensagem..." rows={3} className="text-xs resize-none nodrag nowheel flex-1" />
          <VariablePicker onInsert={handleInsertVariable} compact />
        </div>
      </div>
      {renderPreview()}
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id}
        nodeLabel={customLabel || "Enviar Mensagem"}
        nodeType="send_message"
        output={(data as any)?.nodeOutput}
        error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false}
        isExecuting={(data as any)?.isExecuting || false}
        onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-blue-50 dark:bg-blue-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const SendMessageNode = memo(SendMessageNodeComponent);
