import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Brain, Sparkles, Loader2, TrendingUp, TrendingDown, AlertTriangle,
    CheckCircle, XCircle, Users, Target, Shield, Zap, Trophy,
    ArrowUpRight, ArrowDownRight, DollarSign, BarChart3, RefreshCw,
    Lightbulb, MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Insight {
    id: string;
    insight_type: string;
    title: string;
    description: string;
    action: string;
    confidence: number;
    data: Record<string, any>;
    status: string;
    period: string;
}

interface CloserBenchmark {
    id: string;
    user_id: string;
    period: string;
    total_leads: number;
    total_conversions: number;
    conversion_rate: number;
    avg_response_time_minutes: number;
    total_revenue: number;
    objection_handling_score: number;
    strengths: string[];
    weaknesses: string[];
    coaching_tips: string[];
    tier: string;
}

const actionIcons: Record<string, any> = {
    scale: TrendingUp,
    pause: XCircle,
    improve: Lightbulb,
    adjust: RefreshCw,
    alert: AlertTriangle,
    celebrate: Trophy,
};

const actionColors: Record<string, string> = {
    scale: "text-emerald-500 bg-emerald-500/10",
    pause: "text-rose-500 bg-rose-500/10",
    improve: "text-amber-500 bg-amber-500/10",
    adjust: "text-blue-500 bg-blue-500/10",
    alert: "text-orange-500 bg-orange-500/10",
    celebrate: "text-violet-500 bg-violet-500/10",
};

const typeLabels: Record<string, string> = {
    sale_pattern: "Padrão de Venda",
    objection: "Objeção",
    coaching: "Coaching",
    bottleneck: "Gargalo",
    campaign: "Campanha",
    forecast: "Previsão",
};

const tierInfo: Record<string, { label: string; color: string; icon: any }> = {
    top: { label: "Top Performer", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", icon: Trophy },
    above_average: { label: "Acima da Média", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", icon: TrendingUp },
    average: { label: "Na Média", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: Target },
    below_average: { label: "Abaixo da Média", color: "text-orange-500 bg-orange-500/10 border-orange-500/20", icon: TrendingDown },
    needs_training: { label: "Precisa Treinar", color: "text-rose-500 bg-rose-500/10 border-rose-500/20", icon: AlertTriangle },
};

interface Props {
    orgId?: string;
}

export default function SalesIntelligencePanel({ orgId: propOrgId }: Props) {
    const { currentOrganization } = useOrganization();
    const orgId = propOrgId || currentOrganization?.id;
    const [insights, setInsights] = useState<Insight[]>([]);
    const [benchmarks, setBenchmarks] = useState<CloserBenchmark[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
    const [profiles, setProfiles] = useState<Record<string, string>>({});

    const fetchData = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const currentPeriod = new Date().toISOString().slice(0, 7);

            const [insightsRes, benchmarksRes] = await Promise.all([
                (supabase as any)
                    .from("ai_insights")
                    .select("*")
                    .eq("organization_id", orgId)
                    .in("status", ["active"])
                    .order("confidence", { ascending: false })
                    .limit(50),
                (supabase as any)
                    .from("closer_benchmarks")
                    .select("*")
                    .eq("organization_id", orgId)
                    .eq("period", currentPeriod)
                    .order("conversion_rate", { ascending: false }),
            ]);

            const salesData = (insightsRes.data || []).filter((i: any) =>
                i.data?.category !== "campaign" &&
                i.data?.category !== "creative" &&
                i.data?.category !== "general"
            ).slice(0, 10);

            setInsights(salesData);
            setBenchmarks(benchmarksRes.data || []);

            // Fetch profile names
            const userIds = (benchmarksRes.data || []).map((b: any) => b.user_id);
            if (userIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from("profiles")
                    .select("id, full_name")
                    .in("id", userIds);
                const map: Record<string, string> = {};
                (profilesData || []).forEach((p: any) => { map[p.id] = p.full_name || "Sem nome"; });
                setProfiles(map);
            }
        } catch (e) {
            console.error("[SalesIntelligencePanel] Error:", e);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const runAnalysis = async () => {
        if (!orgId) return;
        setAnalyzing(true);
        try {
            const { data, error } = await supabase.functions.invoke("ai-sales-intelligence", {
                body: { organization_id: orgId, period_months: 1, model: selectedModel },
            });
            if (error) throw error;
            toast.success(`Análise concluída: ${(data as any)?.insights_count || 0} insights gerados`);
            await fetchData();
        } catch (e: any) {
            console.error("[SalesIntelligencePanel] Error:", e);
            toast.error("Erro ao executar análise de inteligência");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleInsightAction = async (id: string, status: "applied" | "dismissed") => {
        try {
            await (supabase as any)
                .from("ai_insights")
                .update({ status })
                .eq("id", id);
            setInsights(prev => prev.filter(i => i.id !== id));
            toast.success(status === "applied" ? "Insight aplicado!" : "Insight dispensado");
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
            </div>
        );
    }

    const insightsByType = {
        sale_pattern: insights.filter(i => i.insight_type === "sale_pattern"),
        objection: insights.filter(i => i.insight_type === "objection"),
        coaching: insights.filter(i => i.insight_type === "coaching"),
        bottleneck: insights.filter(i => i.insight_type === "bottleneck"),
        forecast: insights.filter(i => i.insight_type === "forecast"),
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-violet-500" />
                    <h3 className="text-lg font-bold">Inteligência Comercial</h3>
                    <Badge variant="outline" className="text-[10px] h-5">
                        {insights.length} insights ativos
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedModel}
                        onChange={e => setSelectedModel(e.target.value)}
                        className="h-7 text-[10px] rounded-md border border-violet-500/30 bg-background px-1.5 w-26 outline-none text-muted-foreground focus:border-violet-500"
                        disabled={analyzing}
                    >
                        <option value="gemini-2.5-flash">Gemini 2.5</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-4o">GPT-4o</option>
                    </select>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-violet-500/30 text-violet-600 hover:bg-violet-500/10"
                        onClick={runAnalysis}
                        disabled={analyzing}
                    >
                        {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {analyzing ? "Analisando..." : "Gerar Insights"}
                    </Button>
                </div>
            </div>

            {insights.length === 0 && benchmarks.length === 0 ? (
                <Card className="border-violet-500/20">
                    <CardContent className="py-12 text-center">
                        <Brain className="h-12 w-12 text-violet-500/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-1">Nenhum insight gerado ainda</p>
                        <p className="text-xs text-muted-foreground/60 mb-4">
                            Analise conversas individuais primeiro, depois gere insights de inteligência comercial
                        </p>
                        <Button
                            size="sm"
                            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                            onClick={runAnalysis}
                            disabled={analyzing}
                        >
                            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            Gerar Análise Completa
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="patterns" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 h-8">
                        <TabsTrigger value="patterns" className="text-[10px] gap-1">
                            <TrendingUp className="h-3 w-3" /> Padrões
                        </TabsTrigger>
                        <TabsTrigger value="objections" className="text-[10px] gap-1">
                            <Shield className="h-3 w-3" /> Objeções
                        </TabsTrigger>
                        <TabsTrigger value="coaching" className="text-[10px] gap-1">
                            <Trophy className="h-3 w-3" /> Coaching
                        </TabsTrigger>
                        <TabsTrigger value="bottlenecks" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> Gargalos
                        </TabsTrigger>
                    </TabsList>

                    {/* PATTERNS TAB */}
                    <TabsContent value="patterns" className="mt-3 space-y-3">
                        {insightsByType.sale_pattern.length === 0 ? (
                            <EmptyInsightState type="padrões de venda" />
                        ) : (
                            insightsByType.sale_pattern.map(insight => (
                                <InsightCard key={insight.id} insight={insight} onAction={handleInsightAction} />
                            ))
                        )}
                        {insightsByType.forecast.map(insight => (
                            <InsightCard key={insight.id} insight={insight} onAction={handleInsightAction} />
                        ))}
                    </TabsContent>

                    {/* OBJECTIONS TAB */}
                    <TabsContent value="objections" className="mt-3 space-y-3">
                        {insightsByType.objection.length === 0 ? (
                            <EmptyInsightState type="objeções" />
                        ) : (
                            insightsByType.objection.map(insight => (
                                <InsightCard key={insight.id} insight={insight} onAction={handleInsightAction} />
                            ))
                        )}
                    </TabsContent>

                    {/* COACHING TAB */}
                    <TabsContent value="coaching" className="mt-3 space-y-3">
                        {benchmarks.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {benchmarks.map((b, idx) => {
                                    const ti = tierInfo[b.tier] || tierInfo.average;
                                    const TierIcon = ti.icon;
                                    return (
                                        <Card key={b.id} className="border-border/50">
                                            <CardContent className="p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center text-sm font-bold">
                                                            #{idx + 1}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold">{profiles[b.user_id] || "Closer"}</p>
                                                            <Badge className={cn("text-[9px] h-4 border", ti.color)}>
                                                                <TierIcon className="h-2.5 w-2.5 mr-0.5" />
                                                                {ti.label}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-1.5 text-center">
                                                    <div className="p-1 rounded bg-muted/50">
                                                        <p className="text-xs font-bold">{b.conversion_rate}%</p>
                                                        <p className="text-[8px] text-muted-foreground">Conversão</p>
                                                    </div>
                                                    <div className="p-1 rounded bg-muted/50">
                                                        <p className="text-xs font-bold">{b.total_leads}</p>
                                                        <p className="text-[8px] text-muted-foreground">Leads</p>
                                                    </div>
                                                    <div className="p-1 rounded bg-muted/50">
                                                        <p className="text-xs font-bold">{b.objection_handling_score}</p>
                                                        <p className="text-[8px] text-muted-foreground">Objeções</p>
                                                    </div>
                                                </div>

                                                {b.coaching_tips?.length > 0 && (
                                                    <div className="space-y-0.5">
                                                        <p className="text-[9px] font-semibold text-violet-600 uppercase tracking-wider">Dicas de Coaching</p>
                                                        {b.coaching_tips.slice(0, 2).map((tip, i) => (
                                                            <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                                                                <Lightbulb className="h-2.5 w-2.5 text-amber-500 shrink-0 mt-0.5" />
                                                                <span>{tip}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                        {insightsByType.coaching.map(insight => (
                            <InsightCard key={insight.id} insight={insight} onAction={handleInsightAction} />
                        ))}
                        {benchmarks.length === 0 && insightsByType.coaching.length === 0 && (
                            <EmptyInsightState type="coaching de closers" />
                        )}
                    </TabsContent>

                    {/* BOTTLENECKS TAB */}
                    <TabsContent value="bottlenecks" className="mt-3 space-y-3">
                        {insightsByType.bottleneck.length === 0 ? (
                            <EmptyInsightState type="gargalos" />
                        ) : (
                            insightsByType.bottleneck.map(insight => (
                                <InsightCard key={insight.id} insight={insight} onAction={handleInsightAction} />
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

function InsightCard({ insight, onAction }: { insight: Insight; onAction: (id: string, status: "applied" | "dismissed") => void }) {
    const Icon = actionIcons[insight.action] || AlertTriangle;
    const colorClass = actionColors[insight.action] || "text-gray-500 bg-gray-500/10";
    const [textColor, bgColor] = colorClass.split(" ");

    return (
        <Card className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                    <div className={cn("p-1.5 rounded-lg shrink-0 mt-0.5", bgColor)}>
                        <Icon className={cn("h-4 w-4", textColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-semibold">{insight.title}</p>
                            <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                {typeLabels[insight.insight_type] || insight.insight_type}
                            </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>

                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-1">
                                    <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full", textColor.replace("text-", "bg-"))}
                                            style={{ width: `${insight.confidence}%` }}
                                        />
                                    </div>
                                    <span className="text-[9px] text-muted-foreground">{insight.confidence}%</span>
                                </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-emerald-500 hover:bg-emerald-500/10"
                                    onClick={() => onAction(insight.id, "applied")}
                                    title="Aplicar"
                                >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:bg-muted"
                                    onClick={() => onAction(insight.id, "dismissed")}
                                    title="Dispensar"
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyInsightState({ type }: { type: string }) {
    return (
        <div className="text-center py-8 border border-dashed border-border/50 rounded-lg">
            <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum insight de {type} encontrado</p>
            <p className="text-[10px] text-muted-foreground/60">Clique em "Gerar Insights" para analisar</p>
        </div>
    );
}
