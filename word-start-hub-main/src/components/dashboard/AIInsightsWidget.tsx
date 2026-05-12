import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Sparkles, Rocket, PauseCircle, Wrench, AlertTriangle,
    CheckCircle, XCircle, RefreshCw, Loader2, Brain, Check, Megaphone, Users, Target, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Insight {
    id: string;
    insight_type: string;
    reference_id: string | null;
    action: string;
    title: string;
    description: string;
    confidence: number;
    status: string;
    created_at: string;
    data?: Record<string, any>;
}

const actionIcons: Record<string, any> = {
    scale: Rocket,
    pause: PauseCircle,
    improve: Wrench,
    adjust: Wrench,
    alert: AlertTriangle,
};

const actionColors: Record<string, string> = {
    scale: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    pause: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    improve: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    adjust: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    alert: "text-orange-500 bg-orange-500/10 border-orange-500/20",
};

export default function AIInsightsWidget({ className }: { className?: string }) {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");

    const fetchInsights = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("ai_insights")
                .select("*")
                .eq("organization_id", orgId)
                .eq("insight_type", "sale_pattern")
                .eq("status", "active")
                .order("confidence", { ascending: false });

            if (data) {
                setInsights(data);
            } else {
                setInsights([]);
            }
        } catch (e) {
            console.error("[AIInsightsWidget] Error:", e);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    const runAnalysis = async () => {
        if (!orgId) return;
        setAnalyzing(true);
        try {
            const { data, error } = await supabase.functions.invoke("ai-performance-analyzer", {
                body: { organization_id: orgId, period_months: 1, model: selectedModel },
            });

            if (error) throw error;
            if (data?.error_message) {
                toast.error(data.error_message);
                return;
            }

            toast.success(`Análise concluída: ${(data as any)?.insights_count || 0} insights gerados`);
            await fetchInsights();
        } catch (e: any) {
            console.error("Analysis error:", e);
            toast.error("Erro ao executar análise");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleAction = async (insightId: string, newStatus: "applied" | "dismissed") => {
        try {
            await supabase
                .from("ai_insights")
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", insightId);

            setInsights(prev => prev.filter(i => i.id !== insightId));
            toast.success(newStatus === "applied" ? "Insight aplicado!" : "Insight dispensado");
        } catch (e) {
            console.error("Error updating insight:", e);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 w-full">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
        );
    }

    const campaignInsights = insights.filter(i => i.data?.category === 'campaign' || i.data?.category === 'campanha');
    const creativeInsights = insights.filter(i => i.data?.category === 'creative' || i.data?.category === 'criativo');
    const generalInsights = insights.filter(i => !['campaign', 'campanha', 'creative', 'criativo'].includes(i.data?.category));

    return (
        <Card className={cn("border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-purple-500/5 shadow-xl", className)}>
            <CardHeader className="pb-4 border-b border-white/5 bg-background/50 rounded-t-xl shrink-0">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <div className="p-2 bg-violet-500/20 rounded-xl">
                                <Brain className="h-6 w-6 text-violet-500" />
                            </div>
                            Central de Inteligência
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            {insights.length} Recomendações Críticas Pendentes
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={selectedModel}
                            onChange={e => setSelectedModel(e.target.value)}
                            className="h-9 text-xs rounded-lg border border-violet-500/30 bg-background/80 px-3 outline-none text-foreground focus:border-violet-500 transition-colors shadow-sm"
                            disabled={analyzing}
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 (Recomendado)</option>
                            <option value="gpt-4o">GPT-4o (Avançado)</option>
                        </select>
                        <Button
                            className="h-9 text-xs gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20"
                            onClick={runAnalysis}
                            disabled={analyzing}
                        >
                            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {analyzing ? "Processando Volume..." : "Analisar Agora"}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {insights.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <div className="w-20 h-20 bg-violet-500/10 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="h-10 w-10 text-violet-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Ambiente Otimizado</h3>
                        <p className="text-sm text-muted-foreground max-w-md mt-2">
                            O algoritmo não identificou gargalos críticos ou perdas de ROI no momento. Clique em Analisar para forçar uma verificação profunda.
                        </p>
                    </div>
                ) : (
                    <Tabs defaultValue="creatives" className="w-full">
                        <div className="px-6 py-4 border-b border-border/40 bg-muted/20">
                            <TabsList className="bg-background/80 max-w-md w-full grid grid-cols-3 h-10 shadow-sm border border-border/50">
                                <TabsTrigger value="creatives" className="text-xs font-semibold">
                                    <Megaphone className="w-3.5 h-3.5 mr-2" />
                                    Criativos ({creativeInsights.length})
                                </TabsTrigger>
                                <TabsTrigger value="campaigns" className="text-xs font-semibold">
                                    <Target className="w-3.5 h-3.5 mr-2" />
                                    Campanhas ({campaignInsights.length})
                                </TabsTrigger>
                                <TabsTrigger value="general" className="text-xs font-semibold">
                                    <Users className="w-3.5 h-3.5 mr-2" />
                                    Operação ({generalInsights.length})
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="p-6">
                            <TabsContent value="creatives" className="m-0 focus:outline-none">
                                {creativeInsights.length === 0 && <EmptyState tab="Criativos" />}
                                <div className="space-y-6">
                                    {creativeInsights.map((insight) => (
                                        <CreativeInsightCard key={insight.id} insight={insight} onAction={handleAction} />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="campaigns" className="m-0 focus:outline-none">
                                {campaignInsights.length === 0 && <EmptyState tab="Campanhas" />}
                                <div className="space-y-4">
                                    {campaignInsights.map((insight) => (
                                        <StandardInsightCard key={insight.id} insight={insight} onAction={handleAction} />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="general" className="m-0 focus:outline-none">
                                {generalInsights.length === 0 && <EmptyState tab="Operação" />}
                                <div className="space-y-4">
                                    {generalInsights.map((insight) => (
                                        <StandardInsightCard key={insight.id} insight={insight} onAction={handleAction} />
                                    ))}
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                )}
            </CardContent>
        </Card>
    );
}

function EmptyState({ tab }: { tab: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-background/40 rounded-xl border border-dashed border-border/50">
            <CheckCircle className="h-8 w-8 text-emerald-500/50 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">Tudo certo em {tab}</p>
        </div>
    );
}

function StandardInsightCard({ insight, onAction }: { insight: Insight, onAction: (id: string, action: "applied" | "dismissed") => void }) {
    const Icon = actionIcons[insight.action] || AlertTriangle;
    const colorClass = actionColors[insight.action] || "text-gray-500 bg-gray-500/10 border-gray-500/20";
    const [textColor, bgColor, borderColor] = colorClass.split(" ");

    return (
        <div className={`p-5 rounded-xl border ${borderColor} bg-background/80 hover:bg-background shadow-sm transition-all flex flex-col md:flex-row gap-5 items-start`}>
            <div className={`p-4 rounded-2xl ${bgColor} shrink-0`}>
                <Icon className={`h-6 w-6 ${textColor}`} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className={`${bgColor} ${textColor} border-transparent text-[10px] font-bold uppercase tracking-wider`}>
                        Ação: {insight.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        Confiança: {insight.confidence}%
                    </span>
                </div>

                <h4 className="text-base font-bold text-foreground mb-1.5 leading-snug">{insight.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
            </div>

            <div className="flex md:flex-col gap-2 shrink-0 md:self-stretch justify-center w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-border/50">
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1 md:flex-none gap-2" onClick={() => onAction(insight.id, "applied")}>
                    <Check className="h-4 w-4" /> Aplicar
                </Button>
                <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30" onClick={() => onAction(insight.id, "dismissed")}>
                    <XCircle className="h-4 w-4" /> Dispensar
                </Button>
            </div>
        </div>
    );
}

function CreativeInsightCard({ insight, onAction }: { insight: Insight, onAction: (id: string, action: "applied" | "dismissed") => void }) {
    const Icon = actionIcons[insight.action] || AlertTriangle;
    const colorClass = actionColors[insight.action] || "text-gray-500 bg-gray-500/10 border-gray-500/20";
    const [textColor, bgColor, borderColor] = colorClass.split(" ");

    const currentCopy = insight.data?.current_copy;
    const suggestedCopy = insight.data?.suggested_copy;

    return (
        <div className={`rounded-xl border ${borderColor} bg-background/80 shadow-sm overflow-hidden flex flex-col`}>
            {/* Header section */}
            <div className="p-5 flex flex-col md:flex-row gap-5 items-start border-b border-border/50">
                <div className={`p-4 rounded-2xl ${bgColor} shrink-0`}>
                    <Icon className={`h-6 w-6 ${textColor}`} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline" className={`${bgColor} ${textColor} border-transparent text-[10px] font-bold uppercase tracking-wider`}>
                            Ação: {insight.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">Confiança: {insight.confidence}%</span>
                        {insight.data?.reference_id && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                Ref: {insight.data.reference_id.substring(0, 20)}
                            </span>
                        )}
                    </div>
                    <h4 className="text-lg font-bold text-foreground mb-1.5 leading-snug">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{insight.description}</p>
                </div>

                <div className="flex gap-2 shrink-0 md:self-center">
                    <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => onAction(insight.id, "applied")}>
                        <Check className="h-4 w-4 mr-1.5" /> Entendido
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onAction(insight.id, "dismissed")}>
                        <XCircle className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Before / After Section */}
            {(currentCopy || suggestedCopy) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/50 bg-muted/10">
                    {/* Atual */}
                    {currentCopy && (
                        <div className="p-5 flex flex-col gap-3">
                            <h5 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-400" />
                                Copy Original (Rodando)
                            </h5>
                            <div className="space-y-4">
                                {currentCopy.headline && (
                                    <div className="bg-background rounded-lg border p-3 border-l-4 border-slate-300">
                                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase">Título (Headline)</p>
                                        <p className="text-sm font-medium">{currentCopy.headline}</p>
                                    </div>
                                )}
                                {currentCopy.body_text && (
                                    <div className="bg-background rounded-lg border p-3 border-l-4 border-slate-300">
                                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase">Descrição Principal</p>
                                        <p className="text-sm text-muted-foreground line-clamp-4 hover:line-clamp-none transition-all">{currentCopy.body_text}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Sugestão */}
                    {suggestedCopy && (
                        <div className="p-5 flex flex-col gap-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <Sparkles className="w-32 h-32 text-violet-500" />
                            </div>
                            <h5 className="text-[11px] font-bold tracking-widest uppercase text-violet-600 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                                Suggestão IA Optimizada
                            </h5>
                            <div className="space-y-4 relative z-10">
                                {suggestedCopy.headline && (
                                    <div className="bg-violet-500/5 rounded-lg border border-violet-500/20 p-3 border-l-4 border-l-violet-500 shadow-sm">
                                        <p className="text-[10px] text-violet-600/70 mb-1 font-semibold uppercase">Novo Título (Headline)</p>
                                        <p className="text-sm font-bold text-violet-950 dark:text-violet-100">{suggestedCopy.headline}</p>
                                    </div>
                                )}
                                {suggestedCopy.body_text && (
                                    <div className="bg-violet-500/5 rounded-lg border border-violet-500/20 p-3 border-l-4 border-l-violet-500 shadow-sm">
                                        <p className="text-[10px] text-violet-600/70 mb-1 font-semibold uppercase">Nova Descrição Estratégica</p>
                                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{suggestedCopy.body_text}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
