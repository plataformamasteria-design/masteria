import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NodeStatsBar } from "./NodeStatsBar";
import { VariablePicker } from "../VariablePicker";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, FileText } from "lucide-react";

function SendToNumberNodeComponent({ id, data }: NodeProps) {
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const allNodes: any[] = (data as any)?.allNodes || [];

    const [phone, setPhone] = useState(config.target_phone || "");
    const [sourceType, setSourceType] = useState(config.source_type || "custom"); // "custom" or "ai_agent"
    const [sourceNodeId, setSourceNodeId] = useState(config.source_ai_node_id || "");
    const [message, setMessage] = useState(config.message || "");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const aiAgentNodes = allNodes.filter((n: any) => n.type === "ai_agent");

    useEffect(() => { setPhone(config.target_phone || ""); }, [config.target_phone]);
    useEffect(() => { setSourceType(config.source_type || "custom"); }, [config.source_type]);
    useEffect(() => { setSourceNodeId(config.source_ai_node_id || ""); }, [config.source_ai_node_id]);
    useEffect(() => { setMessage(config.message || ""); }, [config.message]);

    const update = (patch: Record<string, any>) => {
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...patch } });
    };

    const handleInsertVariable = (variable: string) => {
        const textarea = textareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newVal = message.substring(0, start) + variable + message.substring(end);
            setMessage(newVal);
            update({ message: newVal });
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + variable.length;
                textarea.focus();
            }, 0);
        } else {
            const newVal = message + variable;
            setMessage(newVal);
            update({ message: newVal });
        }
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-background" />
            <NodeHeader
                nodeId={id}
                icon={<Phone className="h-4 w-4 text-indigo-500" />}
                defaultLabel="Enviar para Número"
                customLabel={customLabel}
                colorClass="bg-indigo-500/10"
                textColorClass="text-indigo-500"
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />
            <div className="px-4 py-3 space-y-2">
                <div>
                    <Label className="text-[10px] text-muted-foreground">Número de destino</Label>
                    <Input
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); update({ target_phone: e.target.value }); }}
                        placeholder="5511999999999"
                        className="h-8 text-xs nodrag font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground mt-0.5">Formato: código do país + DDD + número (ex: 5511999999999)</p>
                </div>
                <div>
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1">Conteúdo da Mensagem</Label>
                    <div className="flex bg-muted/30 p-1 rounded-md mb-2">
                        <button
                            className={`flex-1 text-[10px] py-1 rounded transition-colors flex items-center justify-center gap-1.5 ${sourceType === "custom" ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
                            onClick={() => { setSourceType("custom"); update({ source_type: "custom" }); }}
                        >
                            <FileText className="h-3 w-3" /> Texto Fixo
                        </button>
                        <button
                            className={`flex-1 text-[10px] py-1 rounded transition-colors flex items-center justify-center gap-1.5 ${sourceType === "ai_agent" ? 'bg-background shadow-sm font-medium text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground hover:bg-muted/50'}`}
                            onClick={() => { setSourceType("ai_agent"); update({ source_type: "ai_agent" }); }}
                        >
                            <Brain className="h-3 w-3" /> Agente I.A
                        </button>
                    </div>

                    {sourceType === "custom" ? (
                        <div className="flex items-start gap-1">
                            <Textarea
                                ref={textareaRef}
                                value={message}
                                onChange={(e) => { setMessage(e.target.value); update({ message: e.target.value }); }}
                                placeholder="Digite a mensagem..."
                                rows={3}
                                className="text-xs resize-none nodrag nowheel flex-1"
                            />
                            <VariablePicker onInsert={handleInsertVariable} compact />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {aiAgentNodes.length === 0 ? (
                                <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
                                    <p className="text-[9px] text-amber-600 dark:text-amber-400">
                                        Nenhum "Agente I.A" no fluxo. Adicione um primeiro.
                                    </p>
                                </div>
                            ) : (
                                <Select value={sourceNodeId} onValueChange={(v) => { setSourceNodeId(v); update({ source_ai_node_id: v }); }}>
                                    <SelectTrigger className="h-8 text-xs nodrag">
                                        <SelectValue placeholder="Selecione o agente..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {aiAgentNodes.map((n: any) => (
                                            <SelectItem key={n.id} value={n.id} className="text-xs">
                                                <span className="flex items-center gap-1.5">
                                                    <Brain className="h-3 w-3 text-indigo-500" />
                                                    {n.data?.label || "Agente I.A"}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <p className="text-[9px] text-muted-foreground">
                                O texto gerado pelo Agente selecionado será enviado.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            <NodeStatsBar stats={(data as any)?.stats} />
            <NodeOutputPanel
                nodeId={id}
                nodeLabel={customLabel || "Enviar para Número"}
                nodeType="send_to_number"
                output={(data as any)?.nodeOutput}
                error={(data as any)?.nodeError}
                isPinned={(data as any)?.isPinned || false}
                isExecuting={(data as any)?.isExecuting || false}
                onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)}
                onPin={() => (data as any)?.onPinOutput?.(id)}
                onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
            />
            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-background" />
        </div>
    );
}

export const SendToNumberNode = memo(SendToNumberNodeComponent);
