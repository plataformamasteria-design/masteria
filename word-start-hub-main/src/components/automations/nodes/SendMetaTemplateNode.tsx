import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageSquareShare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function SendMetaTemplateNodeComponent({ id, data }: NodeProps) {
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const { currentOrganization } = useOrganization();

    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(config.template_id || "");

    const { data: templates, isLoading } = useQuery({
        queryKey: ['wa_official_templates', currentOrganization?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('wa_official_templates')
                .select('*')
                .eq('organization_id', currentOrganization?.id)
                .eq('status', 'APPROVED');

            if (error) throw error;
            return data || [];
        },
        enabled: !!currentOrganization?.id,
    });

    useEffect(() => { setSelectedTemplateId(config.template_id || ""); }, [config.template_id]);

    const update = (updates: Record<string, any>) => {
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } });
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-lg min-w-[280px] w-[300px] overflow-hidden group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<MessageSquareShare className="h-4 w-4 text-emerald-500" />}
                defaultLabel="Enviar Template (Meta)"
                customLabel={customLabel}
                colorClass="bg-emerald-500/10"
                textColorClass="text-emerald-500"
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-4 space-y-4">
                <div>
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1 block">Template Oficial (Meta API)</Label>
                    <Select value={selectedTemplateId} onValueChange={(val) => { setSelectedTemplateId(val); update({ template_id: val }); }}>
                        <SelectTrigger className="h-9 nodrag border-emerald-500/20 w-full">
                            <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione o template..."} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="nodrag">
                            {templates?.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name} <span className="text-muted-foreground ml-1">({t.language})</span>
                                </SelectItem>
                            ))}
                            {templates?.length === 0 && (
                                <p className="text-xs text-muted-foreground p-2">Nenhum template APROVADO encontrado.</p>
                            )}
                        </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                        O despacho será gerado via Meta Cloud API. Caso o número do lead responda dentro de 24h, a janela de conversação será reaberta para atendimento orgânico.
                    </p>
                </div>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />

            <NodeOutputPanel
                nodeId={id}
                nodeLabel={customLabel || "Envio Meta Template"}
                output={(data as any)?.nodeOutput}
                error={(data as any)?.nodeError}
                isPinned={(data as any)?.isPinned || false}
                isExecuting={(data as any)?.isExecuting || false}
                onExecute={() => (data as any)?.onExecute?.(id)}
                onPin={() => (data as any)?.onPinOutput?.(id)}
                onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
            />

            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background" />
        </div>
    );
}

export const SendMetaTemplateNode = memo(SendMetaTemplateNodeComponent);
