import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Signpost, Plus, X, Brain, Sparkles, Key, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const OPENAI_MODELS = [
    { value: "gpt-5.4", label: "GPT-5.4 (Último)" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4o", label: "GPT-4o" },
];

const ROUTE_COLORS = [
    "bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-blue-500",
    "bg-emerald-500", "bg-amber-500", "bg-red-500", "bg-teal-500",
];

interface Credential {
    id: string;
    name: string;
    provider: string;
}

interface FunnelData { id: string; name: string; }
interface StageData { id: string; name: string; color: string; funnel_id: string; }

function IntentRouterNodeComponent({ id, data }: NodeProps) {
    const { currentOrganization } = useOrganization();
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";

    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [vittaCredentials, setVittaCredentials] = useState<{ openai: boolean; gemini: boolean }>({ openai: false, gemini: false });
    const [funnels, setFunnels] = useState<FunnelData[]>([]);
    const [stages, setStages] = useState<StageData[]>([]);

    // Node State
    const [intents, setIntents] = useState<string[]>(config.intents || ["ORÇAMENTO", "AGENDAMENTO"]);
    const [instruction, setInstruction] = useState(config.instruction || "Classifique a última mensagem do usuário.");
    const [credentialId, setCredentialId] = useState(config.credential_id || "vitta-openai");
    const [model, setModel] = useState(config.model || "gpt-4o-mini");
    const [contextWindow, setContextWindow] = useState<number>(config.context_window || 20);
    const [analyzeFullContext, setAnalyzeFullContext] = useState<boolean>(config.analyze_full_context !== false);

    useEffect(() => {
        if (config.intents) setIntents(config.intents);
        if (config.instruction) setInstruction(config.instruction);
        if (config.credential_id) setCredentialId(config.credential_id);
        if (config.model) setModel(config.model);
        if (config.context_window !== undefined) setContextWindow(config.context_window);
        if (config.analyze_full_context !== undefined) setAnalyzeFullContext(config.analyze_full_context);
    }, [JSON.stringify(config)]);

    useEffect(() => {
        if (!currentOrganization?.id) return;
        supabase
            .from("ai_agent_credentials")
            .select("id, name, provider")
            .eq("organization_id", currentOrganization.id)
            .then(({ data: creds }: any) => {
                if (creds) setCredentials(creds);
            });
        supabase
            .from("global_config")
            .select("key, value")
            .in("key", ["openai_api_key", "gemini_api_key"])
            .then(({ data: configs }: any) => {
                const hasOpenai = configs?.some((c: any) => c.key === "openai_api_key" && c.value);
                const hasGemini = configs?.some((c: any) => c.key === "gemini_api_key" && c.value);
                setVittaCredentials({ openai: !!hasOpenai, gemini: !!hasGemini });
            });

        Promise.all([
            (supabase as any).from("funnels").select("id, name").eq("organization_id", currentOrganization.id),
            (supabase as any).from("funnel_stages").select("id, name, color, funnel_id").eq("organization_id", currentOrganization.id).order("order_position"),
        ]).then(([fRes, sRes]) => {
            setFunnels(fRes.data || []);
            setStages(sRes.data || []);
        });
    }, [currentOrganization?.id]);

    const update = (patch: any) => {
        (data as any)?.onChange?.(id, {
            config: { ...config, ...patch },
        });
    };

    const addIntent = () => {
        const next = [...intents, `INTENÇÃO ${intents.length + 1}`];
        setIntents(next);
        update({ intents: next });
    };

    const removeIntent = (i: number) => {
        const next = intents.filter((_, idx) => idx !== i);
        setIntents(next);
        update({ intents: next });
    };

    const updateIntent = (i: number, val: string) => {
        const next = [...intents];
        next[i] = val.toUpperCase().replace(/\s+/g, "_");
        setIntents(next);
        update({ intents: next });
    };

    return (
        <div className="bg-card border-2 border-indigo-500/50 rounded-xl shadow-xl min-w-[340px] max-w-[400px] overflow-visible group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<Signpost className="h-4 w-4 text-white" />}
                defaultLabel="Classificador de Intenções"
                customLabel={customLabel}
                colorClass="bg-indigo-600"
                textColorClass="text-white"
                solidHeader
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-4">
                {/* Model Selection */}
                <div className="space-y-1.5 p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                    <div className="flex items-center gap-2 mb-1">
                        <Key className="h-3 w-3 text-indigo-500" />
                        <span className="text-[10px] font-bold text-indigo-600 uppercase">Configuração I.A</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Select value={credentialId} onValueChange={(v) => { setCredentialId(v); update({ credential_id: v }); }}>
                            <SelectTrigger className="h-7 text-[10px] nodrag">
                                <SelectValue placeholder="Credencial" />
                            </SelectTrigger>
                            <SelectContent>
                                {vittaCredentials.openai && <SelectItem value="vitta-openai" className="text-xs">🟣 Vitta I.A</SelectItem>}
                                {credentials.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={model} onValueChange={(v) => { setModel(v); update({ model: v }); }}>
                            <SelectTrigger className="h-7 text-[10px] nodrag">
                                <SelectValue placeholder="Modelo" />
                            </SelectTrigger>
                            <SelectContent>
                                {OPENAI_MODELS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Instructions */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <Brain className="h-3 w-3 text-indigo-500" />
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Critérios de Decisão</Label>
                    </div>
                    <Textarea
                        value={instruction}
                        onChange={(e) => { setInstruction(e.target.value); update({ instruction: e.target.value }); }}
                        className="text-xs min-h-[60px] nodrag bg-muted/30 border-border/50"
                        placeholder="Ex: Identifique se o cliente quer agendar, perguntar preço ou falar com suporte."
                    />
                </div>

                {/* Context Window */}
                <div className="space-y-1.5 p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-3 w-3 text-indigo-500" />
                        <Label className="text-[10px] font-bold text-indigo-600 uppercase">Contexto & Memória</Label>
                    </div>

                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground mr-2">Ler histórico completo da conversa?</Label>
                        <Switch
                            checked={analyzeFullContext}
                            onCheckedChange={(c) => { setAnalyzeFullContext(c); update({ analyze_full_context: c }); }}
                            className="scale-75 data-[state=checked]:bg-indigo-500"
                        />
                    </div>

                    {analyzeFullContext && (
                        <div className="flex items-center justify-between pt-1">
                            <Label className="text-[10px] text-muted-foreground shrink-0">Janela de mensagens analisadas</Label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={contextWindow}
                                onChange={(e) => {
                                    const v = Math.max(1, Math.min(100, parseInt(e.target.value) || 20));
                                    setContextWindow(v);
                                    update({ context_window: v });
                                }}
                                className="h-6 text-xs w-16 nodrag text-center"
                            />
                        </div>
                    )}
                </div>

                {/* Intents List */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-3 w-3 text-indigo-500" />
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Caminhos de Intenção</Label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {intents.map((intent, i) => {
                            const colorClass = ROUTE_COLORS[i % ROUTE_COLORS.length];

                            const routeConfig = config.intent_routes?.[intent] || {};
                            const fId = routeConfig.funnel_id || "";
                            const sId = routeConfig.stage_id || "";
                            const filteredStages = stages.filter(s => s.funnel_id === fId);

                            return (
                                <div key={i} className="flex flex-col gap-2 p-2 rounded-md bg-muted/20 border border-border/50 animate-in fade-in slide-in-from-left-2 duration-200">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-7 rounded-full ${colorClass} shrink-0`} />
                                        <Input
                                            value={intent}
                                            onChange={(e) => updateIntent(i, e.target.value)}
                                            className="h-8 text-xs font-bold uppercase nodrag"
                                            placeholder="INTENÇÃO"
                                        />
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeIntent(i)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {config.auto_crm_move && (
                                        <div className="grid grid-cols-2 gap-2 mt-1 pl-3.5 border-l-2 border-emerald-500/30">
                                            <Select value={fId} onValueChange={(v) => update({ intent_routes: { ...config.intent_routes, [intent]: { funnel_id: v, stage_id: "" } } })}>
                                                <SelectTrigger className="h-7 text-[10px] nodrag"><SelectValue placeholder="Funil" /></SelectTrigger>
                                                <SelectContent>{funnels.map(f => (<SelectItem key={f.id} value={f.id} className="text-[10px]">{f.name}</SelectItem>))}</SelectContent>
                                            </Select>
                                            <Select value={sId} disabled={!fId} onValueChange={(v) => update({ intent_routes: { ...config.intent_routes, [intent]: { funnel_id: fId, stage_id: v } } })}>
                                                <SelectTrigger className="h-7 text-[10px] nodrag"><SelectValue placeholder="Etapa" /></SelectTrigger>
                                                <SelectContent>{filteredStages.map(s => (<SelectItem key={s.id} value={s.id} className="text-[10px]">{s.name}</SelectItem>))}</SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50" onClick={addIntent}>
                        <Plus className="h-3 w-3" /> Adicionar Intenção
                    </Button>
                </div>

                {/* CRM Auto-Move Integration */}
                <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.auto_crm_move ?? false}
                            onChange={(e) => update({ auto_crm_move: e.target.checked })}
                            className="accent-emerald-500 w-3.5 h-3.5 nodrag"
                        />
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">🔄 Auto-mover CRM por intenção</span>
                    </label>
                    {config.auto_crm_move && (
                        <p className="text-[9px] text-muted-foreground leading-tight">
                            Agora os leads serão movidos automaticamente para os funis selecionados em cada intenção!
                        </p>
                    )}
                </div>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />
            <NodeOutputPanel
                nodeId={id}
                nodeLabel={customLabel || "Classificador"}
                output={(data as any)?.nodeOutput}
                error={(data as any)?.nodeError}
                isPinned={(data as any)?.isPinned}
                isExecuting={(data as any)?.isExecuting}
                onExecute={() => (data as any)?.onExecute?.(id)}
                onPin={() => (data as any)?.onPinOutput?.(id)}
                onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
            />

            {/* Dynamic Source Handles */}
            <div className="flex flex-wrap justify-center gap-4 px-4 pb-4 pt-2 border-t border-border/50 bg-muted/5">
                {intents.map((intent, i) => {
                    const colorClass = ROUTE_COLORS[i % ROUTE_COLORS.length];
                    return (
                        <div key={i} className="flex flex-col items-center gap-1 group/handle">
                            <span className="text-[9px] font-bold text-muted-foreground truncate max-w-[60px] group-hover/handle:text-foreground transition-colors">
                                {intent}
                            </span>
                            <Handle
                                type="source"
                                position={Position.Bottom}
                                id={intent}
                                className={`!w-3 !h-3 ${colorClass.replace("bg-", "!bg-")} !border-2 !border-background !relative !transform-none !left-auto !right-auto hover:scale-125 transition-transform shadow-sm`}
                            />
                        </div>
                    );
                })}
                <div className="flex flex-col items-center gap-1 group/handle">
                    <span className="text-[9px] font-bold text-muted-foreground group-hover/handle:text-foreground transition-colors">OUTROS</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="fallback"
                        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-background !relative !transform-none !left-auto !right-auto hover:scale-125 transition-transform shadow-sm"
                    />
                </div>
            </div>
        </div>
    );
}

export const IntentRouterNode = memo(IntentRouterNodeComponent);
