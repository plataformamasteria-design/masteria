import { memo, useState, useEffect, useMemo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

import { Brain, Plus, Trash2, Key, Database, Wrench, Settings2, Sparkles, Loader2, Crown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";

const OPENAI_MODELS = [
  { value: "gpt-5.4", label: "GPT-5.4 (Último)" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
  { value: "gpt-5.2", label: "GPT-5.2" },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
];

interface Credential {
  id: string;
  name: string;
  provider: string;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: string; // JSON string
}

function PromptSelector({ onSelect }: { onSelect: (content: string) => void }) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentOrganization } = useOrganization();

  const loadPrompts = async () => {
    if (!currentOrganization?.id || prompts.length > 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (!error && data) setPrompts(data);
    } catch (err) {
      console.error('Error loading prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(val) => { setOpen(val); if (val) loadPrompts(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2 border border-violet-500/20 hover:bg-violet-500/10">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-violet-400" />}
          Selecionar Modelo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar prompt..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-2 text-[10px] text-center">Nenhum prompt encontrado.</CommandEmpty>
            <CommandGroup heading="Biblioteca">
              {prompts.map((p) => {
                const metadata = p.fields?.find((f: any) => f.key === '_metadata')?.value;
                const parsedMeta = metadata ? JSON.parse(metadata) : null;
                const displayName = p.name || parsedMeta?.name || "Prompt sem nome";
                const displayDesc = p.description || parsedMeta?.description || "Sem descrição";

                return (
                  <CommandItem
                    key={p.id}
                    onSelect={() => {
                      const cleanFields = (p.fields || []).filter((f: any) => f.key !== '_metadata');
                      const content = cleanFields.map((f: any) => `${f.key}:\n${f.value}`).join('\n\n');
                      onSelect(content);
                      setOpen(false);
                    }}
                    className="text-xs flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                  >
                    <span className="font-semibold">{displayName}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">{displayDesc}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AIAgentNodeComponent({ id, data }: NodeProps) {
  const [activeTab, setActiveTab] = useState("agent");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [vittaCredentials, setVittaCredentials] = useState<{ openai: boolean; gemini: boolean }>({ openai: false, gemini: false });
  const [showNewCred, setShowNewCred] = useState(false);
  const [newCredName, setNewCredName] = useState("");
  const [newCredKey, setNewCredKey] = useState("");
  const [newCredProvider, setNewCredProvider] = useState("openai");
  const [savingCred, setSavingCred] = useState(false);
  const { currentOrganization } = useOrganization();

  const config = (data as any)?.config || {};
  const onChange = (data as any)?.onChange;
  const customLabel = (data as any)?.label || "";

  const provider = config.provider || "openai";
  const model = config.model || (provider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash");
  const credentialId = config.credential_id || "";
  const systemMessage = config.system_message || "";
  const prompt = config.prompt || "";
  const memoryKey = config.memory_key || "";
  const contextWindowLength = config.context_window_length || 5;
  const temperature = config.temperature ?? 0.7;
  const maxIterations = config.max_iterations || 5;
  const tools: ToolDef[] = config.tools || [];
  const formatForSend = config.format_for_send || false;
  const dialogueMode = config.dialogue_mode || false;
  const maxTurns = config.max_dialogue_turns || 10;
  const dialogueObjective = config.dialogue_objective || "";
  const dialogueDelaySeconds = config.dialogue_delay_seconds ?? 2;
  const debounceSeconds = config.debounce_seconds ?? 30;
  const requireGlobalBot = config.require_global_bot ?? true;
  const requireLeadBot = config.require_lead_bot ?? true;
  const humanizeText = config.humanize_text || false;
  const timeoutEnabled = config.timeout_enabled || false;
  const timeoutAmount = config.timeout_amount || "30";
  const timeoutUnit = config.timeout_unit || "minutes";
  const useHeadPrompt = config.use_head_prompt ?? false;

  const [headPromptName, setHeadPromptName] = useState<string | null>(null);
  const [headPromptContent, setHeadPromptContent] = useState<string | null>(null);

  const updateConfig = (patch: Record<string, any>) => {
    if (!onChange) return;
    onChange(id, { config: { ...config, ...patch } });
  };

  // Load org credentials + check Vitta I.A global keys
  useEffect(() => {
    if (!currentOrganization?.id) return;
    // Org credentials
    (supabase as any)
      .from("ai_agent_credentials")
      .select("id, name, provider")
      .eq("organization_id", currentOrganization.id)
      .then(({ data: creds }: any) => {
        if (creds) setCredentials(creds);
      });
    // Global Vitta I.A keys
    (supabase as any)
      .from("global_config")
      .select("key, value")
      .in("key", ["openai_api_key", "gemini_api_key"])
      .then(({ data: configs }: any) => {
        const hasOpenai = configs?.some((c: any) => c.key === "openai_api_key" && c.value);
        const hasGemini = configs?.some((c: any) => c.key === "gemini_api_key" && c.value);
        setVittaCredentials({ openai: !!hasOpenai, gemini: !!hasGemini });
      });
  }, [currentOrganization?.id]);

  // Load head prompt info
  useEffect(() => {
    if (!currentOrganization?.id) return;
    (supabase as any)
      .from("ai_prompts")
      .select("id, fields, persona")
      .eq("organization_id", currentOrganization.id)
      .then(({ data, error }: any) => {
        if (error || !data) {
          console.error('Error loading head prompt:', error);
          return;
        }
        const head = data.find((p: any) => {
          const fieldsArr = Array.isArray(p.fields) ? p.fields : [];
          const meta = fieldsArr.find((f: any) => f.key === '_metadata')?.value;
          if (!meta) return false;
          try { return JSON.parse(meta).is_head_prompt === true; } catch { return false; }
        });
        if (head) {
          const fieldsArr = Array.isArray(head.fields) ? head.fields : [];
          const meta = fieldsArr.find((f: any) => f.key === '_metadata')?.value;
          let parsedMeta: any = {};
          try { parsedMeta = meta ? JSON.parse(meta) : {}; } catch { }
          setHeadPromptName(parsedMeta?.name || head.persona || "Head Prompt");
          const cleanFields = fieldsArr.filter((f: any) => f.key !== '_metadata');
          setHeadPromptContent(cleanFields.map((f: any) => `## ${f.key}\n${f.value}`).join('\n\n'));
        } else {
          setHeadPromptName(null);
          setHeadPromptContent(null);
        }
      });
  }, [currentOrganization?.id]);

  const handleSaveCredential = async () => {
    if (!currentOrganization?.id || !newCredName || !newCredKey) return;
    setSavingCred(true);
    try {
      const { data: cred, error } = await (supabase as any)
        .from("ai_agent_credentials")
        .insert({
          organization_id: currentOrganization.id,
          name: newCredName,
          provider: newCredProvider,
          api_key: newCredKey,
        })
        .select("id, name, provider")
        .single();
      if (error) throw error;
      setCredentials((prev) => [...prev, cred]);
      updateConfig({ credential_id: cred.id, provider: cred.provider });
      setNewCredName("");
      setNewCredKey("");
      setShowNewCred(false);
      toast({ title: "Credencial salva!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setSavingCred(false);
    }
  };

  const addTool = () => {
    const newTool: ToolDef = { name: "", description: "", parameters: '{"type":"object","properties":{}}' };
    updateConfig({ tools: [...tools, newTool] });
  };

  const updateTool = (index: number, field: string, value: string) => {
    const updated = tools.map((t, i) => (i === index ? { ...t, [field]: value } : t));
    updateConfig({ tools: updated });
  };

  const removeTool = (index: number) => {
    updateConfig({ tools: tools.filter((_, i) => i !== index) });
  };

  const modelOptions = provider === "gemini" ? GEMINI_MODELS : OPENAI_MODELS;
  const isVittaCredential = credentialId === "vitta-openai" || credentialId === "vitta-gemini";
  const selectedCred = isVittaCredential
    ? { id: credentialId, name: credentialId === "vitta-openai" ? "Vitta I.A (OpenAI)" : "Vitta I.A (Gemini)", provider: credentialId === "vitta-openai" ? "openai" : "gemini" }
    : credentials.find((c) => c.id === credentialId);

  const handleDropOnPrompt = (e: React.DragEvent) => {
    e.preventDefault();
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        updateConfig({ prompt: prompt + parsed.ref });
      } catch { }
    }
  };

  const handleDropOnSystemMessage = (e: React.DragEvent) => {
    e.preventDefault();
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        updateConfig({ system_message: systemMessage + parsed.ref });
      } catch { }
    }
  };

  return (
    <div className="bg-card border-2 border-violet-500/60 rounded-xl shadow-lg min-w-[320px] max-w-[420px] overflow-visible">
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-violet-500 !border-2 !border-card" />
      <NodeHeader
        nodeId={id}
        icon={<Brain className="h-4 w-4 text-white" />}
        defaultLabel="Agente I.A"
        customLabel={customLabel}
        colorClass="bg-violet-600"
        textColorClass="text-white"
        solidHeader
        showOnHover={false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(label) => (data as any)?.onRename?.(id, label)}
      />

      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-border/40">
        <span className="text-[11px] font-bold text-violet-400">
          {provider === "openai" ? "OpenAI" : "Gemini"} — {model}
        </span>
        <span className="text-[11px] text-muted-foreground truncate flex-1">
          {selectedCred ? selectedCred.name : "Configurar..."}
        </span>
      </div>

      <div className="px-3 pb-3 pt-2 max-h-[600px] overflow-y-auto nowheel nodrag">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-8 grid grid-cols-4 mb-3">
            <TabsTrigger value="agent" className="text-[10px] gap-1 px-1">
              <Settings2 className="h-3 w-3" /> Agente
            </TabsTrigger>
            <TabsTrigger value="model" className="text-[10px] gap-1 px-1">
              <Key className="h-3 w-3" /> Modelo
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-[10px] gap-1 px-1">
              <Database className="h-3 w-3" /> Memória
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-[10px] gap-1 px-1">
              <Wrench className="h-3 w-3" /> Tools
            </TabsTrigger>
          </TabsList>

          {/* AGENT TAB */}
          <TabsContent value="agent" className="space-y-3 mt-0">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Importar Modelo</Label>
                <PromptSelector onSelect={(content) => updateConfig({ system_message: systemMessage ? systemMessage + '\n\n' + content : content })} />
              </div>
            </div>

            {/* Head Prompt Toggle */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 border border-amber-500/20">
              <div className="flex items-center gap-2 min-w-0">
                <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium">Head Prompt</p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {headPromptName ? headPromptName : "Nenhum Head Prompt definido"}
                  </p>
                </div>
              </div>
              <Switch
                checked={useHeadPrompt}
                onCheckedChange={(v) => updateConfig({ use_head_prompt: v })}
                disabled={!headPromptName}
              />
            </div>
            {useHeadPrompt && headPromptName && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
                <p className="text-[9px] text-amber-700 dark:text-amber-400">
                  👑 O conteúdo do Head Prompt <strong>"{headPromptName}"</strong> será injetado antes da System Message deste agente.
                </p>
              </div>
            )}
            {!headPromptName && (
              <div className="rounded-md bg-muted/40 border border-border/50 px-2 py-1.5">
                <p className="text-[9px] text-muted-foreground">
                  Defina um Head Prompt na aba <strong>Automação I.A</strong> para poder ativá-lo aqui.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Prompt (User Message)</Label>
              <Textarea
                value={prompt}
                onChange={(e) => updateConfig({ prompt: e.target.value })}
                onDrop={handleDropOnPrompt}
                onDragOver={(e) => e.preventDefault()}
                className="text-[11px] min-h-[80px] bg-zinc-950 text-zinc-100 border-zinc-700 nodrag nowheel"
                placeholder="{{ NóAnterior.$json.mensagem }}"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">System Message</Label>
              <Textarea
                value={systemMessage}
                onChange={(e) => updateConfig({ system_message: e.target.value })}
                onDrop={handleDropOnSystemMessage}
                onDragOver={(e) => e.preventDefault()}
                className="text-[11px] min-h-[140px] bg-zinc-950 text-zinc-100 border-zinc-700 nodrag nowheel"
                placeholder="Você é um assistente inteligente..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Max Iterations</Label>
              <Input
                type="number"
                value={maxIterations}
                onChange={(e) => updateConfig({ max_iterations: parseInt(e.target.value) || 5 })}
                className="h-7 text-[11px] nodrag"
                min={1}
                max={20}
              />
            </div>

            {/* Format for Send */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-2 border border-emerald-500/20">
              <div>
                <p className="text-[11px] font-medium">Formatar para envio</p>
                <p className="text-[9px] text-muted-foreground">Adiciona instrução ao prompt para dividir a resposta com delimitador automático</p>
              </div>
              <Switch
                checked={formatForSend}
                onCheckedChange={(v) => updateConfig({ format_for_send: v })}
              />
            </div>
            {formatForSend && (
              <div className="rounded-md bg-muted/40 border border-border/50 px-2 py-1.5">
                <p className="text-[9px] text-muted-foreground">
                  O agente receberá a instrução: <span className="font-mono text-emerald-500">"Separe cada parte da resposta com ⌁⌁⌁"</span>. Use o nó "Enviar Resposta I.A" para enviar automaticamente.
                </p>
              </div>
            )}

            {/* Dialogue Mode */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-500/10 px-2.5 py-2 border border-blue-500/20">
              <div>
                <p className="text-[11px] font-medium">Modo Diálogo</p>
                <p className="text-[9px] text-muted-foreground">O agente conversa em loop com o lead até concluir o objetivo definido</p>
              </div>
              <Switch
                checked={dialogueMode}
                onCheckedChange={(v) => {
                  const patch: Record<string, any> = { dialogue_mode: v };
                  if (v) patch.format_for_send = true;
                  updateConfig(patch);
                }}
              />
            </div>
            {dialogueMode && (
              <div className="space-y-3 pl-2 border-l-2 border-blue-500/30 ml-1">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">🎯 Objetivo do diálogo</Label>
                  <Textarea
                    value={dialogueObjective}
                    onChange={(e) => updateConfig({ dialogue_objective: e.target.value })}
                    className="text-[11px] min-h-[70px] nodrag nowheel"
                    placeholder="Ex: Agendar uma consulta com o cliente, coletar nome completo e horário desejado"
                  />
                  <p className="text-[9px] text-muted-foreground">O agente detecta automaticamente quando o objetivo foi alcançado e libera o fluxo</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Máx. turnos de conversa</Label>
                  <Input type="number" min={2} max={50} value={maxTurns}
                    onChange={(e) => updateConfig({ max_dialogue_turns: parseInt(e.target.value) || 10 })}
                    className="h-7 text-[11px] nodrag" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Delay entre mensagens (seg)</Label>
                  <Input type="number" min={0} max={60} step={0.5} value={dialogueDelaySeconds}
                    onChange={(e) => updateConfig({ dialogue_delay_seconds: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-[11px] nodrag" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">⏳ Tempo de espera por mensagens (seg)</Label>
                  <Input type="number" min={0} max={120} step={5} value={debounceSeconds}
                    onChange={(e) => updateConfig({ debounce_seconds: parseInt(e.target.value) || 0 })}
                    className="h-7 text-[11px] nodrag" />
                  <p className="text-[9px] text-muted-foreground">Aguarda X segundos antes de responder, compilando múltiplas mensagens do lead em uma única resposta</p>
                </div>
                <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-2">
                  <p className="text-[9px] text-blue-700 dark:text-blue-400 leading-relaxed">
                    💬 Em modo diálogo, o agente envia mensagens ao lead, aguarda a resposta e avalia se o objetivo foi concluído. Quando detectar que o objetivo foi atingido, o fluxo segue pela saída "Concluído". {timeoutEnabled ? 'Se o tempo limite for atingido sem resposta, segue pela saída "Tempo esgotado".' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Humanize text */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 border border-amber-500/20">
              <div>
                <p className="text-[11px] font-medium">Tratar texto</p>
                <p className="text-[9px] text-muted-foreground">Envia o output para a I.A novamente (sem memória) para humanizar a resposta, removendo excessos de emoji e formatação robótica</p>
              </div>
              <Switch checked={humanizeText} onCheckedChange={(v) => updateConfig({ humanize_text: v })} />
            </div>
            {humanizeText && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
                <p className="text-[9px] text-amber-700 dark:text-amber-400">
                  ✍️ O output será reprocessado para parecer que um humano escreveu. Os tokens serão somados (ex: 7108 + 281 = 7389 tokens) e o total é debitado do saldo.
                </p>
              </div>
            )}

            {/* Auto Finance Integration (3.3) */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-2 border border-emerald-500/20">
              <div>
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">💰 Venda Automática</p>
                <p className="text-[9px] text-muted-foreground leading-tight">O Agente poderá registrar transações financeiras (receitas/recorrentes) de forma autônoma no módulo Financeiro quando o cliente fechar negócio.</p>
              </div>
              <Switch checked={config.auto_finance_enabled || false} onCheckedChange={(v) => updateConfig({ auto_finance_enabled: v })} />
            </div>
            {config.auto_finance_enabled && (
              <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5">
                <p className="text-[9px] text-emerald-700 dark:text-emerald-400 leading-tight">
                  ✨ O agente de I.A recebeu uma "Tool" nativa. Ele vai preencher valor, produto e descrição sozinho usando <b>Function Calling</b>!
                </p>
              </div>
            )}

            {/* Timeout - OUTSIDE dialogue mode */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-red-500/10 px-2.5 py-2 border border-red-500/20">
              <div>
                <p className="text-[11px] font-medium">⏱️ Tempo limite de resposta</p>
                <p className="text-[9px] text-muted-foreground">Se o lead não responder no tempo definido, o fluxo segue pela saída "Tempo esgotado"</p>
              </div>
              <Switch checked={timeoutEnabled} onCheckedChange={(v) => updateConfig({ timeout_enabled: v })} />
            </div>
            {timeoutEnabled && (
              <div className="space-y-2 pl-2 border-l-2 border-red-500/30 ml-1">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Tempo de espera</Label>
                    <Input type="number" min={1} value={timeoutAmount}
                      onChange={(e) => updateConfig({ timeout_amount: e.target.value })}
                      className="h-7 text-[11px] nodrag" />
                  </div>
                  <div className="w-[100px] space-y-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Unidade</Label>
                    <Select value={timeoutUnit} onValueChange={(v) => updateConfig({ timeout_unit: v })}>
                      <SelectTrigger className="h-7 text-[11px] nodrag"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes" className="text-[11px]">Minutos</SelectItem>
                        <SelectItem value="hours" className="text-[11px]">Horas</SelectItem>
                        <SelectItem value="days" className="text-[11px]">Dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1.5">
                  <p className="text-[9px] text-red-700 dark:text-red-400">
                    ⏳ Após {timeoutAmount} {timeoutUnit === 'minutes' ? 'minutos' : timeoutUnit === 'hours' ? 'horas' : 'dias'}, se o lead não responder, o fluxo seguirá pela saída <strong>"Tempo esgotado"</strong>. Se responder, segue pela saída <strong>"Concluído"</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Bot Status Checks */}
            <div className="space-y-2 rounded-lg border border-orange-500/20 bg-orange-500/5 p-2.5">
              <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase">Verificação do Robô</p>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium">Exigir robô global ativo</p>
                  <p className="text-[9px] text-muted-foreground">Só gera resposta se o robô global estiver ligado</p>
                </div>
                <Switch
                  checked={requireGlobalBot}
                  onCheckedChange={(v) => updateConfig({ require_global_bot: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium">Exigir robô ativo para o lead</p>
                  <p className="text-[9px] text-muted-foreground">Só gera resposta se o robô estiver ativo para este lead</p>
                </div>
                <Switch
                  checked={requireLeadBot}
                  onCheckedChange={(v) => updateConfig({ require_lead_bot: v })}
                />
              </div>
            </div>
          </TabsContent>

          {/* MODEL TAB */}
          <TabsContent value="model" className="space-y-3 mt-0">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Credencial</Label>
              <Select
                value={credentialId}
                onValueChange={(v) => {
                  if (v === "vitta-openai") {
                    updateConfig({ credential_id: v, provider: "openai" });
                  } else if (v === "vitta-gemini") {
                    updateConfig({ credential_id: v, provider: "gemini" });
                  } else {
                    const cred = credentials.find((c) => c.id === v);
                    updateConfig({ credential_id: v, provider: cred?.provider || provider });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-[11px] nodrag">
                  <SelectValue placeholder="Selecione uma credencial" />
                </SelectTrigger>
                <SelectContent>
                  {/* Vitta I.A global credentials */}
                  {vittaCredentials.openai && (
                    <SelectItem value="vitta-openai" className="text-[11px]">
                      🟣 Vitta I.A (OpenAI)
                    </SelectItem>
                  )}
                  {vittaCredentials.gemini && (
                    <SelectItem value="vitta-gemini" className="text-[11px]">
                      🟣 Vitta I.A (Gemini)
                    </SelectItem>
                  )}
                  {(vittaCredentials.openai || vittaCredentials.gemini) && credentials.length > 0 && (
                    <SelectItem value="__separator__" disabled className="text-[9px] text-muted-foreground">
                      ── Credenciais da organização ──
                    </SelectItem>
                  )}
                  {credentials.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-[11px]">
                      {c.name} ({c.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="w-full h-7 text-[10px] mt-1" onClick={() => setShowNewCred(!showNewCred)}>
                <Plus className="h-3 w-3 mr-1" /> Nova Credencial
              </Button>
            </div>

            {showNewCred && (
              <div className="space-y-2 rounded-lg bg-muted/30 p-2 border border-border/50">
                <Select value={newCredProvider} onValueChange={setNewCredProvider}>
                  <SelectTrigger className="h-7 text-[11px] nodrag">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai" className="text-[11px]">OpenAI</SelectItem>
                    <SelectItem value="gemini" className="text-[11px]">Google Gemini</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nome da credencial"
                  value={newCredName}
                  onChange={(e) => setNewCredName(e.target.value)}
                  className="h-7 text-[11px] nodrag"
                />
                <Input
                  placeholder="API Key"
                  type="password"
                  value={newCredKey}
                  onChange={(e) => setNewCredKey(e.target.value)}
                  className="h-7 text-[11px] nodrag"
                />
                <Button size="sm" className="w-full h-7 text-[10px]" onClick={handleSaveCredential} disabled={savingCred}>
                  {savingCred ? "Salvando..." : "Salvar Credencial"}
                </Button>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Provedor</Label>
              <Select value={provider} onValueChange={(v) => {
                const defaultModel = v === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini";
                updateConfig({ provider: v, model: defaultModel });
              }}>
                <SelectTrigger className="h-7 text-[11px] nodrag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai" className="text-[11px]">OpenAI</SelectItem>
                  <SelectItem value="gemini" className="text-[11px]">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Modelo</Label>
              <Select value={model} onValueChange={(v) => updateConfig({ model: v })}>
                <SelectTrigger className="h-7 text-[11px] nodrag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-[11px]">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Temperature</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) || 0.7 })}
                className="h-7 text-[11px] nodrag"
              />
            </div>
          </TabsContent>

          {/* MEMORY TAB */}
          <TabsContent value="memory" className="space-y-3 mt-0">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 mb-2">
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                A memória armazena as interações por chave. Use uma chave única por conversa (ex: telefone do lead) para manter contexto entre execuções.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Chave da Memória</Label>
              <Input
                value={memoryKey}
                onChange={(e) => updateConfig({ memory_key: e.target.value })}
                onDrop={(e) => {
                  e.preventDefault();
                  const outputData = e.dataTransfer.getData("application/x-node-output");
                  if (outputData) {
                    try {
                      const parsed = JSON.parse(outputData);
                      updateConfig({ memory_key: memoryKey + parsed.ref });
                    } catch { }
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                className="h-7 text-[11px] nodrag"
                placeholder="{{ Trigger.$json.phone }}"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Janela de Contexto</Label>
              <Input
                type="number"
                value={contextWindowLength}
                onChange={(e) => updateConfig({ context_window_length: parseInt(e.target.value) || 5 })}
                className="h-7 text-[11px] nodrag"
                min={1}
                max={50}
              />
              <p className="text-[9px] text-muted-foreground">Quantas interações passadas o modelo recebe como contexto</p>
            </div>
          </TabsContent>

          {/* TOOLS TAB */}
          <TabsContent value="tools" className="space-y-3 mt-0">
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 mb-2">
              <p className="text-[10px] text-blue-600 dark:text-blue-400">
                Defina as ferramentas (tools) que o agente pode chamar. O agente decidirá quando usar cada tool com base na conversa.
              </p>
            </div>

            {tools.map((tool, i) => (
              <div key={i} className="space-y-2 rounded-lg bg-muted/30 p-2 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground">Tool {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeTool(i)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <Input
                  placeholder="Nome (ex: buscar_cliente)"
                  value={tool.name}
                  onChange={(e) => updateTool(i, "name", e.target.value)}
                  className="h-7 text-[11px] nodrag"
                />
                <Input
                  placeholder="Descrição"
                  value={tool.description}
                  onChange={(e) => updateTool(i, "description", e.target.value)}
                  className="h-7 text-[11px] nodrag"
                />
                <Textarea
                  placeholder='{"type":"object","properties":{"query":{"type":"string"}}}'
                  value={tool.parameters}
                  onChange={(e) => updateTool(i, "parameters", e.target.value)}
                  className="text-[11px] min-h-[60px] font-mono bg-zinc-950 text-zinc-100 border-zinc-700 nodrag nowheel"
                />
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={addTool}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar Tool
            </Button>
          </TabsContent>
        </Tabs>
      </div>



      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel
        nodeId={id}
        nodeLabel={customLabel || "Agente I.A"}
        nodeType="ai_agent"
        output={(data as any)?.nodeOutput}
        error={(data as any)?.nodeError}
        isPinned={(data as any)?.isPinned || false}
        isExecuting={(data as any)?.isExecuting || false}
        onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)}
        onPin={() => (data as any)?.onPinOutput?.(id)}
        onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
      />
      <div className="flex justify-around px-4 pb-3 pt-1">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-medium">Concluído</span>
          <Handle type="source" position={Position.Bottom} id="completed"
            className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-card !relative !transform-none !left-auto !right-auto" />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] text-red-600 dark:text-red-400 font-medium">Tempo esgotado</span>
          <Handle type="source" position={Position.Bottom} id="timeout"
            className="!w-2.5 !h-2.5 !bg-red-500 !border-2 !border-card !relative !transform-none !left-auto !right-auto" />
        </div>
      </div>
    </div>
  );
}

export const AIAgentNode = memo(AIAgentNodeComponent);
