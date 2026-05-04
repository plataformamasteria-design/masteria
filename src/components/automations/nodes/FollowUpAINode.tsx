import { memo, useEffect, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageSquareHeart, Clock3, Key, MessageCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
];

const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

interface Credential {
  id: string;
  name: string;
  provider: string;
}

function FollowUpAINodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const onChange = (data as any)?.onChange;
  const customLabel = (data as any)?.label || "";
  const { currentOrganization } = useOrganization();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [vittaCredentials, setVittaCredentials] = useState<{ openai: boolean; gemini: boolean }>({ openai: false, gemini: false });
  const [showNewCred, setShowNewCred] = useState(false);
  const [newCredName, setNewCredName] = useState("");
  const [newCredKey, setNewCredKey] = useState("");
  const [newCredProvider, setNewCredProvider] = useState("openai");
  const [savingCred, setSavingCred] = useState(false);

  const provider = config.provider || "openai";
  const model = config.model || (provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");
  const credentialId = config.credential_id || "";
  const followupPrompt = config.followup_prompt || "";
  const historyCount = config.history_count || 20;
  const formatForSend = config.format_for_send ?? true;
  const timeoutAmount = config.timeout_amount || "8";
  const timeoutUnit = config.timeout_unit || "hours";
  const humanizeText = config.humanize_text || false;
  const requireGlobalBot = config.require_global_bot ?? true;
  const requireLeadBot = config.require_lead_bot ?? true;

  const updateConfig = (patch: Record<string, any>) => {
    if (!onChange) return;
    onChange(id, { config: { ...config, ...patch } });
  };

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setCredentials([]);
    import("@/app/actions/automations-builder").then(m => m.getSystemGlobalAiStatus()).then(status => {
      setVittaCredentials(status);
    });
  }, [currentOrganization?.id]);

  const handleSaveCredential = async () => {
    toast({ title: "Esta função Requer Configuração Personalizada." });
  };

  const modelOptions = provider === "gemini" ? GEMINI_MODELS : OPENAI_MODELS;

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] w-[340px] overflow-visible transition-all hover:shadow-xl group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-blue-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />

      <NodeHeader
        nodeId={id}
        icon={<MessageSquareHeart className="h-4 w-4 text-white" />}
        defaultLabel="Follow Up I.A"
        customLabel={customLabel}
        colorClass="bg-blue-600"
        textColorClass="text-white"
        solidHeader
        showOnHover={false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(label) => (data as any)?.onRename?.(id, label)}
      />

      <div className="px-3 py-3 space-y-2.5 nodrag nowheel max-h-[520px] overflow-y-auto">
        {/* Provider & Model row */}
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Provedor</Label>
            <Select value={provider} onValueChange={(v) => updateConfig({ provider: v, model: v === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini" })}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai" className="text-[11px]">OpenAI</SelectItem>
                <SelectItem value="gemini" className="text-[11px]">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Modelo</Label>
            <Select value={model} onValueChange={(v) => updateConfig({ model: v })}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {((Array.isArray(modelOptions) ? modelOptions : []) || []).map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-[11px]">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Credential */}
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Credencial</Label>
          <Select
            value={credentialId}
            onValueChange={(v) => {
              if (v === "vitta-openai") updateConfig({ credential_id: v, provider: "openai" });
              else if (v === "vitta-gemini") updateConfig({ credential_id: v, provider: "gemini" });
              else { const cred = credentials.find((c) => c.id === v); updateConfig({ credential_id: v, provider: cred?.provider || provider }); }
            }}
          >
            <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {vittaCredentials.openai && <SelectItem value="vitta-openai" className="text-[11px]">🟣 Vitta I.A (OpenAI)</SelectItem>}
              {vittaCredentials.gemini && <SelectItem value="vitta-gemini" className="text-[11px]">🟣 Vitta I.A (Gemini)</SelectItem>}
              {((Array.isArray(credentials) ? credentials : []) || []).map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-[11px]">{c.name} ({c.provider})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="w-full h-6 text-[10px]" onClick={() => setShowNewCred(!showNewCred)}>
            <Key className="h-3 w-3 mr-1" /> Nova Credencial
          </Button>
        </div>

        {showNewCred && (
          <div className="space-y-1.5 rounded-lg bg-muted/30 p-2 border border-slate-200 dark:border-zinc-800/50">
            <Select value={newCredProvider} onValueChange={setNewCredProvider}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai" className="text-[11px]">OpenAI</SelectItem>
                <SelectItem value="gemini" className="text-[11px]">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Nome" value={newCredName} onChange={(e) => setNewCredName(e.target.value)} className="h-7 text-[11px]" />
            <Input placeholder="API Key" type="password" value={newCredKey} onChange={(e) => setNewCredKey(e.target.value)} className="h-7 text-[11px]" />
            <Button size="sm" className="w-full h-7 text-[10px]" onClick={handleSaveCredential} disabled={savingCred}>
              {savingCred ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}

        {/* Follow-up Prompt */}
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Prompt de Follow-up</Label>
          <Textarea
            value={followupPrompt}
            onChange={(e) => updateConfig({ followup_prompt: e.target.value })}
            className="text-[11px] min-h-[80px] bg-zinc-950 text-zinc-100 border-zinc-700"
            placeholder="Gere um follow-up curto, empático e objetivo para reengajar o lead com base no histórico abaixo."
          />
        </div>

        {/* History info */}
        <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-1.5 flex items-start gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-[9px] text-blue-700 dark:text-blue-400 leading-relaxed">
            O histórico das últimas mensagens do chat do lead será usado automaticamente como contexto (user message) para a I.A gerar o follow-up personalizado. A resposta é gerada automaticamente ao chegar neste nó.
          </p>
        </div>

        {/* History count */}
        <div className="flex items-center gap-2">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">Histórico (msgs)</Label>
          <Input
            type="number" min={6} max={80} value={historyCount}
            onChange={(e) => updateConfig({ history_count: parseInt(e.target.value) || 20 })}
            className="h-7 text-[11px] w-20"
          />
        </div>

        {/* Format for send */}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-2 py-1.5 border border-emerald-500/20">
          <div>
            <p className="text-[11px] font-medium">Formatar para envio</p>
            <p className="text-[9px] text-muted-foreground">Divide a resposta com delimitador ⌁⌁⌁</p>
          </div>
          <Switch checked={formatForSend} onCheckedChange={(v) => updateConfig({ format_for_send: v })} />
        </div>

        {/* Humanize text */}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-2 py-1.5 border border-amber-500/20">
          <div>
            <p className="text-[11px] font-medium">Tratar texto</p>
            <p className="text-[9px] text-muted-foreground">Humaniza a resposta removendo tom robótico</p>
          </div>
          <Switch checked={humanizeText} onCheckedChange={(v) => updateConfig({ humanize_text: v })} />
        </div>

        {/* Timer */}
        <div className="space-y-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2">
          <p className="text-[10px] font-semibold uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" /> Temporizador de resposta
          </p>
          <div className="flex gap-2">
            <Input type="number" min={1} value={timeoutAmount}
              onChange={(e) => updateConfig({ timeout_amount: e.target.value })}
              className="h-7 text-[11px] w-20" />
            <Select value={timeoutUnit} onValueChange={(v) => updateConfig({ timeout_unit: v })}>
              <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes" className="text-[11px]">Minutos</SelectItem>
                <SelectItem value="hours" className="text-[11px]">Horas</SelectItem>
                <SelectItem value="days" className="text-[11px]">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-[9px] text-muted-foreground">
            Saídas: <strong>Respondeu</strong> (no prazo) · <strong>Não respondeu</strong> (expirou)
          </p>
        </div>

        {/* Bot checks */}
        <div className="space-y-1.5 rounded-lg border border-orange-500/20 bg-orange-500/5 p-2">
          <p className="text-[10px] font-semibold uppercase text-orange-600 dark:text-orange-400">Verificação do robô</p>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium">Exigir robô global ativo</p>
              <p className="text-[9px] text-muted-foreground">Só envia follow-up se o robô global estiver ligado</p>
            </div>
            <Switch checked={requireGlobalBot} onCheckedChange={(v) => updateConfig({ require_global_bot: v })} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium">Exigir robô ativo para o lead</p>
              <p className="text-[9px] text-muted-foreground">Só envia follow-up se o robô estiver ativo para este lead</p>
            </div>
            <Switch checked={requireLeadBot} onCheckedChange={(v) => updateConfig({ require_lead_bot: v })} />
          </div>
        </div>
      </div>

      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id} nodeLabel={customLabel || "Follow Up I.A"}
        nodeType="follow_up_ai"
        output={(data as any)?.nodeOutput} error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false}
        onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />

      <div className="flex justify-around px-4 pb-4 pt-1">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase mb-1">Respondeu</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold text-orange-600 dark:text-orange-400 tracking-wider uppercase mb-1">Não respondeu</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="responded" className="!w-4 !h-4 !bg-emerald-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="not_responded" className="!w-4 !h-4 !bg-orange-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" style={{ left: '75%' }} />
    </div>
  );
}

export const FollowUpAINode = memo(FollowUpAINodeComponent);
