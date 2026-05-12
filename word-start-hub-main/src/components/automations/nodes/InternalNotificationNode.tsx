import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Bell } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

function InternalNotificationNodeComponent({ id, data }: NodeProps) {
    const { currentOrganization } = useOrganization();
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const [message, setMessage] = useState(config.message || "");
    const [agentId, setAgentId] = useState(config.agent_id || "all");
    const [notifyAll, setNotifyAll] = useState(config.notify_all ?? true);
    const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]);

    useEffect(() => { if (config.message) setMessage(config.message); }, [config.message]);
    useEffect(() => { if (config.agent_id) setAgentId(config.agent_id); }, [config.agent_id]);
    useEffect(() => { setNotifyAll(config.notify_all ?? true); }, [config.notify_all]);

    useEffect(() => {
        if (!currentOrganization?.id) return;
        (supabase as any).from("profiles").select("id, full_name").eq("organization_id", currentOrganization.id).eq("approved", true)
            .then(({ data: d }: any) => { if (d) setAgents(d); });
    }, [currentOrganization?.id]);

    const update = (patch: any) => {
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...patch } });
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-yellow-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<Bell className="h-4 w-4 text-yellow-500" />}
                defaultLabel="Notificação Interna"
                customLabel={customLabel}
                colorClass="bg-yellow-500/10"
                textColorClass="text-yellow-500"
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Toda equipe?</Label>
                    <Switch checked={notifyAll} onCheckedChange={(c) => { setNotifyAll(c); update({ notify_all: c }); }} className="scale-75 data-[state=checked]:bg-yellow-500" />
                </div>
                {!notifyAll && (
                    <div>
                        <Label className="text-[10px] text-muted-foreground">Agente específico</Label>
                        <Select value={agentId} onValueChange={(v) => { setAgentId(v); update({ agent_id: v }); }}>
                            <SelectTrigger className="h-7 text-xs nodrag mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                            <SelectContent>
                                {agents.map((a) => <SelectItem key={a.id} value={a.id} className="text-xs">{a.full_name || a.id}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div>
                    <Label className="text-[10px] text-muted-foreground">Mensagem</Label>
                    <Textarea value={message} onChange={(e) => { setMessage(e.target.value); update({ message: e.target.value }); }} placeholder="Atenção: Lead VIP entrou no fluxo!" rows={2} className="text-xs resize-none nodrag nowheel mt-1" />
                </div>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />
            <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Notificação"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />

            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-yellow-500 !border-2 !border-background" />
        </div>
    );
}

export const InternalNotificationNode = memo(InternalNotificationNodeComponent);
