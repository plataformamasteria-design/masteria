import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { UserPlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { getCustomFieldsForDropdown } from "@/app/actions/automations-builder";
import { useOrganization } from "@/contexts/OrganizationContext";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

interface CustomField { id: string; field_key: string; field_label: string; field_type: string; is_system: boolean; }

function CaptureInfoNodeComponent({ id, data }: NodeProps) {
  const { currentOrganization } = useOrganization();
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [question, setQuestion] = useState(config.question || "");
  const [fieldKey, setFieldKey] = useState(config.field_key || "");
  const [fields, setFields] = useState<CustomField[]>([]);

  useEffect(() => { setQuestion(config.question || ""); }, [config.question]);
  useEffect(() => { setFieldKey(config.field_key || ""); }, [config.field_key]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    (async () => {
      const fieldsData = await getCustomFieldsForDropdown();
      if (fieldsData) setFields(fieldsData);
    })();
  }, [currentOrganization?.id]);

  const updateConfig = (updates: any) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };
  const selectedField = fields.find(f => f.field_key === fieldKey);

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[280px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-violet-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader nodeId={id} icon={<UserPlus className="h-4 w-4 text-violet-500" />} defaultLabel="Capturar Informação" customLabel={customLabel} colorClass="bg-violet-500/10" textColorClass="text-violet-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Campo a capturar</Label>
          <Select value={fieldKey} onValueChange={(v) => { setFieldKey(v); updateConfig({ field_key: v }); }}>
            <SelectTrigger className="h-8 text-xs nodrag"><SelectValue placeholder="Selecione o campo" /></SelectTrigger>
            <SelectContent>{((Array.isArray(fields) ? fields : []) || []).map((f) => (<SelectItem key={f.id} value={f.field_key}><div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full shrink-0 ${f.is_system ? 'bg-violet-500' : 'bg-emerald-500'}`} />{f.field_label}</div></SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Mensagem de solicitação</Label>
          <Textarea value={question} onChange={(e) => { setQuestion(e.target.value); updateConfig({ question: e.target.value }); }} placeholder={selectedField ? `Ex: Qual é o seu ${selectedField.field_label.toLowerCase()}?` : "Mensagem enviada ao lead..."} rows={2} className="text-xs resize-none nodrag nowheel" />
        </div>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Capturar Informação"} nodeType="capture_info" output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-violet-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const CaptureInfoNode = memo(CaptureInfoNodeComponent);
