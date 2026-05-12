import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Zap, Users, Shuffle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

interface TagData { id: string; name: string; color: string; }
interface AgentData { id: string; full_name: string; is_online?: boolean; }

function ActionNodeComponent({ id, data }: NodeProps) {
  const { currentOrganization } = useOrganization();
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [actionType, setActionType] = useState(config.action_type || "assign_agent");
  const [tags, setTags] = useState<TagData[]>([]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [teams, setTeams] = useState<{ id: string, name: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState(config.tag_id || config.agent_id || config.team_id || config.webhook_url || "");

  useEffect(() => { setActionType(config.action_type || "assign_agent"); }, [config.action_type]);
  useEffect(() => { setSelectedValue(config.tag_id || config.agent_id || config.team_id || config.webhook_url || ""); }, [config.tag_id, config.agent_id, config.team_id, config.webhook_url]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    Promise.all([
      (supabase as any).from("tags").select("id, name, color").eq("organization_id", currentOrganization.id),
      (supabase as any).from("profiles").select("id, full_name, is_online").eq("organization_id", currentOrganization.id).eq("approved", true),
      (supabase as any).from("teams").select("id, name").eq("organization_id", currentOrganization.id),
    ]).then(([tRes, aRes, teamRes]) => {
      setTags(tRes.data || []);
      setAgents(aRes.data || []);
      setTeams(teamRes.data || []);
    });
  }, [currentOrganization?.id]);

  const update = (updates: Record<string, string>) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };
  const handleTypeChange = (v: string) => { setActionType(v); setSelectedValue(""); update({ action_type: v, tag_id: "", agent_id: "", webhook_url: "", team_id: "" }); };
  const handleValueChange = (v: string) => {
    setSelectedValue(v);
    if (actionType === "add_tag" || actionType === "remove_tag") update({ tag_id: v });
    else if (actionType === "assign_agent") update({ agent_id: v });
    else if (actionType === "assign_team") update({ team_id: v });
    else if (actionType === "webhook") update({ webhook_url: v });
  };

  // Get unique team names from agents
  const uniqueTeams = [...new Set(agents.map(a => (a as any).team || "").filter(Boolean))];
  const onlineAgents = agents.filter(a => a.is_online);

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] overflow-hidden group">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-rose-500 !border-2 !border-background" />
      <NodeHeader nodeId={id} icon={<Zap className="h-4 w-4 text-rose-500" />} defaultLabel="Ação" customLabel={customLabel} colorClass="bg-rose-500/10" textColorClass="text-rose-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Tipo de ação</Label>
          <Select value={actionType} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-8 text-xs nodrag"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="assign_agent">Atribuir agente</SelectItem>
              <SelectItem value="assign_team">Atribuir equipe</SelectItem>
              <SelectItem value="assign_dynamic">
                <span className="flex items-center gap-1.5"><Shuffle className="h-3 w-3" /> Atribuir ao agente ativo</span>
              </SelectItem>
              <SelectItem value="add_tag">Adicionar tag</SelectItem>
              <SelectItem value="remove_tag">Remover tag</SelectItem>
              <SelectItem value="toggle_bot">Ativar/Desativar bot</SelectItem>
              <SelectItem value="webhook">Chamar webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tag selection */}
        {(actionType === "add_tag" || actionType === "remove_tag") && (
          <div><Label className="text-[10px] text-muted-foreground">Tag</Label>
            <Select value={selectedValue} onValueChange={handleValueChange}><SelectTrigger className="h-8 text-xs nodrag"><SelectValue placeholder="Selecionar tag" /></SelectTrigger><SelectContent>{tags.map((t) => (<SelectItem key={t.id} value={t.id}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />{t.name}</div></SelectItem>))}</SelectContent></Select></div>
        )}

        {/* Agent selection */}
        {actionType === "assign_agent" && (
          <div><Label className="text-[10px] text-muted-foreground">Agente</Label>
            <Select value={selectedValue} onValueChange={handleValueChange}><SelectTrigger className="h-8 text-xs nodrag"><SelectValue placeholder="Selecionar agente" /></SelectTrigger><SelectContent>{agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${a.is_online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  {a.full_name || a.id}
                </div>
              </SelectItem>
            ))}</SelectContent></Select></div>
        )}

        {/* Team assignment */}
        {actionType === "assign_team" && (
          <div><Label className="text-[10px] text-muted-foreground">Equipe</Label>
            <Select value={selectedValue} onValueChange={handleValueChange}><SelectTrigger className="h-8 text-xs nodrag"><SelectValue placeholder="Selecionar equipe" /></SelectTrigger><SelectContent>{teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  {t.name}
                </div>
              </SelectItem>
            ))}</SelectContent></Select></div>
        )}

        {/* Dynamic assignment info */}
        {actionType === "assign_dynamic" && (
          <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 space-y-1.5">
            <div className="flex items-center gap-2">
              <Shuffle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-[10px] font-semibold text-emerald-600">Distribuição inteligente</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Atribui automaticamente ao agente online com menor número de atendimentos ativos. Se nenhum agente estiver online, mantém não atribuído.
            </p>
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 font-medium">{onlineAgents.length} agente(s) online agora</span>
            </div>
          </div>
        )}

        {/* Webhook */}
        {actionType === "webhook" && (
          <div><Label className="text-[10px] text-muted-foreground">URL do Webhook</Label>
            <Input value={selectedValue} onChange={(e) => handleValueChange(e.target.value)} placeholder="https://..." className="h-8 text-xs nodrag" /></div>
        )}
      </div>
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Ação"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-rose-500 !border-2 !border-background" />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);
