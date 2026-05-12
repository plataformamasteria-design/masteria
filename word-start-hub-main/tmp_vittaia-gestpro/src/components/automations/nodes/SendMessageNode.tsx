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
          <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 font-mono text-[9px]">{p}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background" />
      <NodeHeader
        nodeId={id}
        icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
        defaultLabel="Enviar Mensagem"
        customLabel={customLabel}
        colorClass="bg-blue-500/10"
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
      <div className="px-4 pb-2 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer bg-blue-50 dark:bg-blue-900/20 p-1.5 text-[10px] rounded-md border border-blue-100 dark:border-blue-800/30 transition-colors">
          <input
            type="checkbox"
            checked={(data as any)?.config?.multi_bubble ?? false}
            onChange={(e) => handleChange(message)} // trigger save
            className="accent-blue-500 w-3.5 h-3.5 nodrag hidden"
          />
          <input
            type="checkbox"
            checked={(data as any)?.config?.multi_bubble ?? false}
            onChange={(e) => (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, multi_bubble: e.target.checked } })}
            className="accent-blue-500 w-3.5 h-3.5 nodrag"
          />
          <span className="font-semibold text-blue-700 dark:text-blue-300">💬 Enviar em múltiplas bolhas</span>
        </label>
        {(data as any)?.config?.multi_bubble && (
          <div className="flex items-center gap-2 pl-5">
            <span className="text-[9px] text-muted-foreground">Delay entre bolhas:</span>
            <input
              type="number"
              min={1}
              max={10}
              value={(data as any)?.config?.bubble_delay_seconds ?? 2}
              onChange={(e) => (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, bubble_delay_seconds: parseInt(e.target.value) || 2 } })}
              className="w-12 h-5 text-[10px] text-center rounded border border-border bg-background nodrag"
            />
            <span className="text-[9px] text-muted-foreground">seg</span>
          </div>
        )}
      </div>
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
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background" />
    </div>
  );
}

export const SendMessageNode = memo(SendMessageNodeComponent);
