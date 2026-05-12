import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Tag } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

function CheckTagNodeComponent({ id, data }: NodeProps) {
    const { currentOrganization } = useOrganization();
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const [tagId, setTagId] = useState(config.tag_id || "");
    const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);

    useEffect(() => { if (config.tag_id) setTagId(config.tag_id); }, [config.tag_id]);

    useEffect(() => {
        if (!currentOrganization?.id) return;
        (supabase as any).from("tags").select("id, name, color").eq("organization_id", currentOrganization.id)
            .then(({ data: d }: any) => { if (d) setTags(d); });
    }, [currentOrganization?.id]);

    const update = (patch: any) => {
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...patch } });
    };

    const selectedTag = tags.find((t) => t.id === tagId);

    return (
        <div className="bg-card border-2 border-fuchsia-500/50 rounded-xl shadow-xl min-w-[260px] overflow-visible group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-fuchsia-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<Tag className="h-4 w-4 text-white" />}
                defaultLabel="Verificar Tag"
                customLabel={customLabel}
                colorClass="bg-gradient-to-r from-fuchsia-600 to-purple-600"
                textColorClass="text-white"
                solidHeader
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-2">
                <div>
                    <Label className="text-[10px] text-muted-foreground">Tag para verificar</Label>
                    <Select value={tagId} onValueChange={(v) => { setTagId(v); update({ tag_id: v }); }}>
                        <SelectTrigger className="h-8 text-xs nodrag mt-1"><SelectValue placeholder="Selecione uma tag" /></SelectTrigger>
                        <SelectContent>
                            {tags.map((t) => (
                                <SelectItem key={t.id} value={t.id} className="text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                        {t.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {selectedTag && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-fuchsia-500/5 border border-fuchsia-500/10">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selectedTag.color }} />
                        <span className="text-xs font-medium">{selectedTag.name}</span>
                    </div>
                )}
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />
            <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Verificar Tag"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />

            <div className="flex justify-center gap-8 px-4 pb-4 pt-2 border-t border-border/50 bg-muted/5">
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-emerald-500">✅ Tem Tag</span>
                    <Handle type="source" position={Position.Bottom} id="yes" className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !relative !transform-none !left-auto hover:scale-125 transition-transform" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-red-400">❌ Não Tem</span>
                    <Handle type="source" position={Position.Bottom} id="no" className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !relative !transform-none !left-auto hover:scale-125 transition-transform" />
                </div>
            </div>
        </div>
    );
}

export const CheckTagNode = memo(CheckTagNodeComponent);
