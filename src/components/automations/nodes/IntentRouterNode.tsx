import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Signpost, Plus, X, Brain, Sparkles, Key, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import { useOrganization } from "@/contexts/OrganizationContext";

const OPENAI_MODELS = [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Recomendado)" },
    { value: "gpt-4o", label: "GPT-4o" },
];

const ROUTE_COLORS = [
    "bg-indigo-50 dark:bg-indigo-900/300", "bg-purple-50 dark:bg-purple-900/300", "bg-pink-50 dark:bg-pink-900/300", "bg-blue-50 dark:bg-blue-900/300",
    "bg-emerald-50 dark:bg-emerald-900/300", "bg-amber-50 dark:bg-amber-900/300", "bg-red-50 dark:bg-red-900/300", "bg-teal-50 dark:bg-teal-900/300",
];

interface Credential {
    id: string;
    name: string;
    provider: string;
}

function IntentRouterNodeComponent({ id, data }: NodeProps) {
    const { currentOrganization } = useOrganization();
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";

    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [vittaCredentials, setVittaCredentials] = useState<{ openai: boolean; gemini: boolean }>({ openai: false, gemini: false });

    // Node State
    const [intents, setIntents] = useState<string[]>(config.intents || ["ORÇAMENTO", "AGENDAMENTO"]);
    const [instruction, setInstruction] = useState(config.instruction || "Classifique a última mensagem do usuário.");
    const [credentialId, setCredentialId] = useState(config.credential_id || "vitta-openai");
    const [model, setModel] = useState(config.model || "gpt-4o-mini");
    const [contextWindow, setContextWindow] = useState<number>(config.context_window || 20);

    useEffect(() => {
        if (config.intents) setIntents(config.intents);
        if (config.instruction) setInstruction(config.instruction);
        if (config.credential_id) setCredentialId(config.credential_id);
        if (config.model) setModel(config.model);
        if (config.context_window) setContextWindow(config.context_window);
    }, [JSON.stringify(config)]);

    useEffect(() => {
        if (!currentOrganization?.id) return;
        setCredentials([]);
        import("@/app/actions/automations-builder").then(m => m.getSystemGlobalAiStatus()).then(status => {
            setVittaCredentials(status);
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
        <div className="bg-white dark:bg-zinc-950 border-2 border-indigo-500/50 rounded-xl shadow-xl min-w-[340px] max-w-[400px] overflow-visible group">
            <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-indigo-50 dark:bg-indigo-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />

            <NodeHeader
                nodeId={id}
                icon={<Signpost className="h-4 w-4 text-zinc-900 dark:text-white" />}
                defaultLabel="Classificador de Intenções"
                customLabel={customLabel}
                colorClass="bg-indigo-600"
                textColorClass="text-zinc-900 dark:text-white"
                solidHeader
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-4">
                {/* Model Selection */}
                <div className="space-y-1.5 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-500/10">
                    <div className="flex items-center gap-2 mb-1">
                        <Key className="h-3 w-3 text-indigo-500" />
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Configuração I.A</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Select value={credentialId} onValueChange={(v) => { setCredentialId(v); update({ credential_id: v }); }}>
                            <SelectTrigger className="h-7 text-[10px] nodrag">
                                <SelectValue placeholder="Credencial" />
                            </SelectTrigger>
                            <SelectContent>
                                {vittaCredentials.openai && <SelectItem value="vitta-openai" className="text-xs">🟣 Vitta I.A</SelectItem>}
                                {((Array.isArray(credentials) ? credentials : []) || []).map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={model} onValueChange={(v) => { setModel(v); update({ model: v }); }}>
                            <SelectTrigger className="h-7 text-[10px] nodrag">
                                <SelectValue placeholder="Modelo" />
                            </SelectTrigger>
                            <SelectContent>
                                {((Array.isArray(OPENAI_MODELS) ? OPENAI_MODELS : []) || []).map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
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
                        className="text-xs min-h-[60px] nodrag bg-muted/30 border-slate-200 dark:border-zinc-800/50"
                        placeholder="Ex: Identifique se o cliente quer agendar, perguntar preço ou falar com suporte."
                    />
                </div>

                {/* Context Window */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3 text-indigo-500" />
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Janela de Contexto</Label>
                    </div>
                    <div className="flex items-center gap-2">
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
                            className="h-7 text-xs w-20 nodrag"
                        />
                        <span className="text-[10px] text-muted-foreground">últimas mensagens analisadas</span>
                    </div>
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
                        {((Array.isArray(intents) ? intents : []) || []).map((intent, i) => {
                            const colorClass = ROUTE_COLORS[i % ROUTE_COLORS.length];
                            return (
                                <div key={i} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                    <div className={`w-1.5 h-7 rounded-full ${colorClass} shrink-0`} />
                                    <Input
                                        value={intent}
                                        onChange={(e) => updateIntent(i, e.target.value)}
                                        className="h-8 text-xs font-bold uppercase nodrag"
                                        placeholder="INTENÇÃO"
                                    />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeIntent(i)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1 border-dashed border-indigo-300 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/30" onClick={addIntent}>
                        <Plus className="h-3 w-3" /> Adicionar Intenção
                    </Button>
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
            <div className="flex flex-wrap justify-center gap-4 px-4 pb-4 pt-2 border-t border-slate-200 dark:border-zinc-800/50 bg-muted/5">
                {((Array.isArray(intents) ? intents : []) || []).map((intent, i) => {
                    const colorClass = ROUTE_COLORS[i % ROUTE_COLORS.length];
                    return (
                        <div key={i} className="flex flex-col items-center gap-1 group/handle relative">
                            <span className="text-[9px] font-bold text-muted-foreground truncate max-w-[60px] group-hover/handle:text-foreground transition-colors mb-1">
                                {intent}
                            </span>
                            <Handle
                                type="source"
                                position={Position.Bottom}
                                id={intent}
                                className={`!w-3 !h-3 ${colorClass.replace("bg-", "!bg-")} !border-2 !border-background hover:scale-125 transition-transform shadow-sm`}
                            />
                        </div>
                    );
                })}
                <div className="flex flex-col items-center gap-1 group/handle relative">
                    <span className="text-[9px] font-bold text-muted-foreground group-hover/handle:text-foreground transition-colors mb-1">OUTROS</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="fallback"
                        className="!w-4 !h-4 !bg-slate-400 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 hover:scale-125 transition-transform shadow-sm"
                    />
                </div>
            </div>
        </div>
    );
}

export const IntentRouterNode = memo(IntentRouterNodeComponent);
