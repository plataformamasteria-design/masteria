import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { ArrowRightLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

interface FunnelData { id: string; name: string; }
interface StageData { id: string; name: string; color: string; funnel_id: string; }

function CrmMoveNodeComponent({ id, data }: NodeProps) {
  const { currentOrganization } = useOrganization();
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [funnels, setFunnels] = useState<FunnelData[]>([]);
  const [stages, setStages] = useState<StageData[]>([]);
  const [funnelId, setFunnelId] = useState(config.funnel_id || "");
  const [stageId, setStageId] = useState(config.stage_id || "");

  useEffect(() => { setFunnelId(config.funnel_id || ""); }, [config.funnel_id]);
  useEffect(() => { setStageId(config.stage_id || ""); }, [config.stage_id]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    Promise.all([
      (supabase as any).from("funnels").select("id, name").eq("organization_id", currentOrganization.id),
      (supabase as any).from("funnel_stages").select("id, name, color, funnel_id").eq("organization_id", currentOrganization.id).order("order_position"),
    ]).then(([fRes, sRes]) => { setFunnels(fRes.data || []); setStages(sRes.data || []); });
  }, [currentOrganization?.id]);

  const filteredStages = stages.filter((s) => s.funnel_id === funnelId);
  const update = (field: string, value: string) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, [field]: value } }); };

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg min-w-[240px] overflow-hidden group">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-500 !border-2 !border-background" />
      <NodeHeader nodeId={id} icon={<ArrowRightLeft className="h-4 w-4 text-orange-500" />} defaultLabel="Mover no CRM" customLabel={customLabel} colorClass="bg-orange-500/10" textColorClass="text-orange-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Funil</Label>
          <Select value={funnelId} onValueChange={(v) => { setFunnelId(v); setStageId(""); update("funnel_id", v); }}>
            <SelectTrigger className="h-8 text-xs nodrag"><SelectValue placeholder="Selecionar funil" /></SelectTrigger>
            <SelectContent>{funnels.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        {funnelId && (
          <div>
            <Label className="text-[10px] text-muted-foreground">Etapa destino</Label>
            <Select value={stageId} onValueChange={(v) => { setStageId(v); update("stage_id", v); }}>
              <SelectTrigger className="h-8 text-xs nodrag"><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
              <SelectContent>{filteredStages.map((s) => (<SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</div></SelectItem>))}</SelectContent>
            </Select>
          </div>
        )}
      </div>
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Mover no CRM"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-orange-500 !border-2 !border-background" />
    </div>
  );
}

export const CrmMoveNode = memo(CrmMoveNodeComponent);
