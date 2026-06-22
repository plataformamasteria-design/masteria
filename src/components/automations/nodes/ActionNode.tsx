import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTagsForDropdown, getUsersForDropdown } from "@/app/actions/automations-builder";
import { useOrganization } from "@/contexts/OrganizationContext";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

interface TagData { id: string; name: string; color: string; }
interface AgentData { id: string; full_name: string; }

function ActionNodeComponent({ id, data }: NodeProps) {
  const { currentOrganization } = useOrganization();
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [actionType, setActionType] = useState(config.action_type || "assign_agent");
  const [tags, setTags] = useState<TagData[]>([]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [selectedValue, setSelectedValue] = useState(config.tag_id || config.agent_id || config.webhook_url || "");

  useEffect(() => { setActionType(config.action_type || "assign_agent"); }, [config.action_type]);
  useEffect(() => { setSelectedValue(config.tag_id || config.agent_id || config.webhook_url || ""); }, [config.tag_id, config.agent_id, config.webhook_url]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    Promise.all([
      getTagsForDropdown().then(res => ({ data: res })),
      getUsersForDropdown().then(res => ({ data: res })),
    ]).then(([tRes, aRes]) => { setTags(tRes.data || []); setAgents(aRes.data || []); });
  }, [currentOrganization?.id]);

  const update = (updates: Record<string, string>) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };
  const handleTypeChange = (v: string) => { setActionType(v); setSelectedValue(""); update({ action_type: v, tag_id: "", agent_id: "", webhook_url: "" }); };
  const handleValueChange = (v: string) => {
    setSelectedValue(v);
    if (actionType === "add_tag" || actionType === "remove_tag") update({ tag_id: v });
    else if (actionType === "assign_agent") update({ agent_id: v });
    else if (actionType === "webhook") update({ webhook_url: v });
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[260px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-rose-50 dark:bg-rose-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader nodeId={id} icon={<Zap className="h-4 w-4 text-rose-500" />} defaultLabel="Ação" customLabel={customLabel} colorClass="bg-rose-50 dark:bg-rose-900/30" textColorClass="text-rose-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Tipo de ação</Label>
          <Select value={actionType} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-8 text-xs nodrag"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="assign_agent">Atribuir agente</SelectItem>
              <SelectItem value="add_tag">Adicionar tag</SelectItem>
              <SelectItem value="remove_tag">Remover tag</SelectItem>
              <SelectItem value="toggle_bot">Ativar/Desativar bot</SelectItem>
              <SelectItem value="webhook">Chamar webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(actionType === "add_tag" || actionType === "remove_tag") && (
          <div><Label className="text-[10px] text-muted-foreground">Tag</Label>
            <Select value={selectedValue} onValueChange={handleValueChange}><SelectTrigger className="h-8 text-xs nodrag"><SelectValue placeholder="Selecionar tag" /></SelectTrigger><SelectContent>{((Array.isArray(tags) ? tags : []) || []).map((t) => (<SelectItem key={t.id} value={t.id}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />{t.name}</div></SelectItem>))}</SelectContent></Select></div>
        )}
        {actionType === "assign_agent" && (
          <div><Label className="text-[10px] text-muted-foreground">Agente</Label>
            <Select value={selectedValue} onValueChange={handleValueChange}><SelectTrigger className="h-8 text-xs nodrag"><SelectValue placeholder="Selecionar agente" /></SelectTrigger><SelectContent>{((Array.isArray(agents) ? agents : []) || []).map((a) => (<SelectItem key={a.id} value={a.id}>{a.full_name || a.id}</SelectItem>))}</SelectContent></Select></div>
        )}
        {actionType === "webhook" && (
          <div><Label className="text-[10px] text-muted-foreground">URL do Webhook</Label>
            <Input value={selectedValue} onChange={(e) => handleValueChange(e.target.value)} placeholder="https://..." className="h-8 text-xs nodrag" /></div>
        )}
      </div>
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Ação"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-rose-50 dark:bg-rose-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);
