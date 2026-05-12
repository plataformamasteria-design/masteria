import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import { VariablePicker } from "../VariablePicker";

function SendEmailNodeComponent({ id, data }: NodeProps) {
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const [to, setTo] = useState(config.to || "{{email}}");
    const [subject, setSubject] = useState(config.subject || "");
    const [body, setBody] = useState(config.body || "");
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { if (config.to) setTo(config.to); }, [config.to]);
    useEffect(() => { if (config.subject) setSubject(config.subject); }, [config.subject]);
    useEffect(() => { if (config.body) setBody(config.body); }, [config.body]);

    const update = (patch: any) => {
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...patch } });
    };

    const handleInsertVariable = (variable: string) => {
        const ta = bodyRef.current;
        if (ta) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newVal = body.substring(0, start) + variable + body.substring(end);
            setBody(newVal);
            update({ body: newVal });
        } else {
            setBody(body + variable);
            update({ body: body + variable });
        }
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-lg min-w-[280px] overflow-hidden group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<Mail className="h-4 w-4 text-orange-500" />}
                defaultLabel="Enviar E-mail"
                customLabel={customLabel}
                colorClass="bg-orange-500/10"
                textColorClass="text-orange-500"
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-2">
                <div>
                    <Label className="text-[10px] text-muted-foreground">Destinatário</Label>
                    <Input value={to} onChange={(e) => { setTo(e.target.value); update({ to: e.target.value }); }} placeholder="{{email}} ou email@example.com" className="h-7 text-xs nodrag mt-1" />
                </div>
                <div>
                    <Label className="text-[10px] text-muted-foreground">Assunto</Label>
                    <Input value={subject} onChange={(e) => { setSubject(e.target.value); update({ subject: e.target.value }); }} placeholder="Assunto do e-mail" className="h-7 text-xs nodrag mt-1" />
                </div>
                <div>
                    <Label className="text-[10px] text-muted-foreground">Corpo</Label>
                    <div className="flex items-start gap-1">
                        <Textarea ref={bodyRef} value={body} onChange={(e) => { setBody(e.target.value); update({ body: e.target.value }); }} placeholder="Conteúdo do e-mail..." rows={3} className="text-xs resize-none nodrag nowheel flex-1 mt-1" />
                        <VariablePicker onInsert={handleInsertVariable} compact />
                    </div>
                </div>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />
            <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Enviar E-mail"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />

            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-orange-500 !border-2 !border-background" />
        </div>
    );
}

export const SendEmailNode = memo(SendEmailNodeComponent);
