import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Brain, Clock, MessageSquare, Zap, ShieldCheck,
    Loader2, AlertTriangle, CheckCircle2, XCircle, Lightbulb,
    Target, Eye, Shield, Flame, Thermometer, Ghost, TrendingUp,
    Timer, ArrowRight, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScoreData {
    response_time_score: number;
    followup_score: number;
    tone_score: number;
    cta_score: number;
    clarity_score: number;
    objection_handling_score: number;
    overall_score: number;
    classification: string;
    diagnosis: string;
    suggestions: string[];
    strengths: string[];
    weaknesses: string[];
    raw_analysis: Record<string, any>;
    analyzed_at: string;
    // New v2 fields
    lead_quality_score: number;
    lead_quality_tier: string;
    intent_signals: string[];
    objections_detected: string[];
    closing_probability: number;
    sla_violations: any[];
    sale_patterns: Record<string, any>;
    revenue_per_lead: number;
}

interface LeadQualityData {
    engagement_score: number;
    response_speed_score: number;
    intent_score: number;
    ghost_risk: number;
    overall_quality_score: number;
    quality_tier: string;
    intent_signals: string[];
    objections: string[];
    closing_probability: number;
    recommended_next_action: string;
    sla_first_contact_minutes: number;
    sla_first_contact_ok: boolean;
    sla_followup_gaps: any[];
    sla_total_attempts: number;
    sla_violations: any[];
    sla_compliance_score: number;
    revenue_per_lead: number;
}

interface Props {
    chatId: string;
    isResolved?: boolean;
}

type ScoreKey = "response_time_score" | "followup_score" | "tone_score" | "cta_score" | "clarity_score" | "objection_handling_score";

const scoreLabels: { key: ScoreKey; label: string; icon: any; color: string }[] = [
    { key: "objection_handling_score", label: "Quebra de Objeções", icon: Shield, color: "text-rose-500" },
    { key: "followup_score", label: "Follow-up", icon: MessageSquare, color: "text-violet-500" },
    { key: "cta_score", label: "Call to Action", icon: Target, color: "text-amber-500" },
    { key: "response_time_score", label: "Tempo de Resposta", icon: Clock, color: "text-blue-500" },
    { key: "tone_score", label: "Tom e Linguagem", icon: ShieldCheck, color: "text-emerald-500" },
    { key: "clarity_score", label: "Clareza", icon: Eye, color: "text-cyan-500" },
];

const leadScoreLabels = [
    { key: "engagement_score", label: "Engajamento", icon: Zap, color: "text-amber-500" },
    { key: "response_speed_score", label: "Velocidade de Resposta", icon: Timer, color: "text-blue-500" },
    { key: "intent_score", label: "Intenção de Compra", icon: Target, color: "text-emerald-500" },
    { key: "ghost_risk", label: "Risco de Ghost", icon: Ghost, color: "text-rose-500", inverted: true },
];

const getClassification = (score: number) => {
    if (score >= 80) return { label: "Excelente", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 };
    if (score >= 60) return { label: "Bom", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", icon: CheckCircle2 };
    if (score >= 40) return { label: "Precisa Melhorar", color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: AlertTriangle };
    return { label: "Ruim", color: "text-rose-500 bg-rose-500/10 border-rose-500/20", icon: XCircle };
};

const getTierInfo = (tier: string) => {
    switch (tier) {
        case "hot": return { label: "🔥 Hot", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" };
        case "warm": return { label: "🌡️ Warm", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
        case "cold": return { label: "❄️ Cold", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
        case "dead": return { label: "💀 Dead", color: "text-muted-foreground bg-muted/50 border-border" };
        default: return { label: tier, color: "text-muted-foreground bg-muted/50 border-border" };
    }
};

const getScoreColor = (score: number) => {
    if (score >= 80) return "from-emerald-500 to-green-500";
    if (score >= 60) return "from-blue-500 to-cyan-500";
    if (score >= 40) return "from-amber-500 to-orange-500";
    return "from-rose-500 to-red-500";
};

const getProgressColor = (score: number) => {
    if (score >= 80) return "[&>div]:bg-emerald-500";
    if (score >= 60) return "[&>div]:bg-blue-500";
    if (score >= 40) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-rose-500";
};

export default function AttendanceScoreCard({ chatId }: Props) {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [score, setScore] = useState<ScoreData | null>(null);
    const [leadQuality, setLeadQuality] = useState<LeadQualityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);

    const fetchScore = useCallback(async () => {
        if (!chatId) return;
        setLoading(true);
        try {
            const [analysisRes, leadRes] = await Promise.all([
                (supabase as any)
                    .from("ai_conversation_analysis")
                    .select("*")
                    .eq("chat_id", chatId)
                    .maybeSingle(),
                (supabase as any)
                    .from("lead_quality_scores")
                    .select("*")
                    .eq("chat_id", chatId)
                    .maybeSingle(),
            ]);

            setScore(analysisRes.data || null);
            setLeadQuality(leadRes.data || null);
        } catch (e) {
            console.error("[AttendanceScoreCard] Error:", e);
        } finally {
            setLoading(false);
        }
    }, [chatId]);

    useEffect(() => {
        fetchScore();
    }, [fetchScore]);

    const runAnalysis = async () => {
        if (!chatId || !orgId) return;
        setAnalyzing(true);
        try {
            const { data, error } = await supabase.functions.invoke("analyze-conversation", {
                body: { chat_id: chatId, organization_id: orgId },
            });

            if (error) {
                let errorMsg = "Erro ao analisar conversa";
                try {
                    const ctx = (error as any).context;
                    if (ctx && typeof ctx.json === "function") {
                        const body = await ctx.json();
                        errorMsg = body?.error || errorMsg;
                    }
                } catch { /* fallback */ }
                throw new Error(errorMsg);
            }
            toast.success("Análise completa concluída com IA!");
            await fetchScore();
        } catch (e: any) {
            console.error("[AttendanceScoreCard] Analysis error:", e);
            toast.error(e?.message || "Erro ao analisar conversa");
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) {
        return (
            <Card className="border-violet-500/20">
                <CardHeader className="pb-2"><Skeleton className="h-4 w-36" /></CardHeader>
                <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
        );
    }

    if (!score) {
        return (
            <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Brain className="h-4 w-4 text-violet-500" />
                        Análise Inteligente
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-3">
                            <Brain className="h-7 w-7 text-violet-500/60" />
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                            Análise completa: Atendimento + Lead + SLA
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mb-4">
                            Score de qualidade, objeções, sinais de compra e compliance
                        </p>
                        <Button
                            size="sm"
                            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25"
                            onClick={runAnalysis}
                            disabled={analyzing}
                        >
                            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                            {analyzing ? "Analisando com IA..." : "Analisar Conversa"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const cls = getClassification(score.overall_score);
    const ClsIcon = cls.icon;
    const scoreColor = getScoreColor(score.overall_score);
    const tierInfo = getTierInfo(score.lead_quality_tier || leadQuality?.quality_tier || "cold");

    return (
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-purple-500/5 overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Brain className="h-4 w-4 text-violet-500" />
                        Análise Inteligente
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                        <Badge className={cn("text-[10px] h-5 gap-1 border", tierInfo.color)}>
                            {tierInfo.label}
                        </Badge>
                        <Badge className={cn("text-[10px] h-5 gap-1 border", cls.color)}>
                            <ClsIcon className="h-3 w-3" />
                            {cls.label}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-violet-500 hover:bg-violet-500/10"
                            onClick={runAnalysis}
                            disabled={analyzing}
                            title="Reanalisar"
                        >
                            {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <Tabs defaultValue="attendance" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 h-7">
                        <TabsTrigger value="attendance" className="text-[10px] h-5 data-[state=active]:bg-violet-500/10">
                            Atendente
                        </TabsTrigger>
                        <TabsTrigger value="lead" className="text-[10px] h-5 data-[state=active]:bg-amber-500/10">
                            Lead
                        </TabsTrigger>
                        <TabsTrigger value="sla" className="text-[10px] h-5 data-[state=active]:bg-blue-500/10">
                            SLA
                        </TabsTrigger>
                    </TabsList>

                    {/* ========== TAB: ATENDENTE ========== */}
                    <TabsContent value="attendance" className="space-y-3 mt-3">
                        {/* Overall Score Gauge */}
                        <div className="flex items-center justify-center py-1">
                            <div className="relative">
                                <div className={cn("h-16 w-16 rounded-full flex items-center justify-center bg-gradient-to-br shadow-lg", scoreColor)}>
                                    <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center">
                                        <div className="text-center">
                                            <span className="text-xl font-black leading-none">{score.overall_score}</span>
                                            <span className="text-[8px] text-muted-foreground block">/100</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Individual Scores */}
                        <div className="space-y-1.5">
                            {scoreLabels.map(sl => {
                                const val = (score as any)[sl.key] as number || 0;
                                return (
                                    <div key={sl.key} className="flex items-center gap-2">
                                        <sl.icon className={cn("h-3 w-3 shrink-0", sl.color)} />
                                        <span className="text-[10px] text-muted-foreground w-28 shrink-0">{sl.label}</span>
                                        <div className="flex-1">
                                            <Progress value={val} className={cn("h-1.5", getProgressColor(val))} />
                                        </div>
                                        <span className={cn("text-[10px] font-bold w-6 text-right",
                                            val >= 80 ? "text-emerald-500" : val >= 60 ? "text-blue-500" : val >= 40 ? "text-amber-500" : "text-rose-500"
                                        )}>{val}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Diagnosis + Strengths/Weaknesses */}
                        {score.diagnosis && (
                            <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                                <p className="text-[10px] text-muted-foreground leading-relaxed">{score.diagnosis}</p>
                            </div>
                        )}

                        {score.strengths?.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle2 className="h-2.5 w-2.5" /> Pontos Fortes
                                </p>
                                {score.strengths.map((s, i) => (
                                    <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                                        <span className="text-emerald-500 shrink-0">✓</span><span>{s}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {score.weaknesses?.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[9px] font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                    <XCircle className="h-2.5 w-2.5" /> Pontos Fracos
                                </p>
                                {score.weaknesses.map((s, i) => (
                                    <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                                        <span className="text-rose-500 shrink-0">✗</span><span>{s}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {score.suggestions?.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                                    <Lightbulb className="h-2.5 w-2.5" /> Sugestões
                                </p>
                                {score.suggestions.map((s, i) => (
                                    <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                                        <span className="text-amber-500 shrink-0">💡</span><span>{s}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ========== TAB: LEAD QUALITY ========== */}
                    <TabsContent value="lead" className="space-y-3 mt-3">
                        {/* Lead Score Gauge */}
                        <div className="flex items-center justify-center gap-4 py-1">
                            <div className="text-center">
                                <div className={cn("h-14 w-14 rounded-full flex items-center justify-center bg-gradient-to-br shadow-md",
                                    getScoreColor(leadQuality?.overall_quality_score || score.lead_quality_score || 0)
                                )}>
                                    <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center">
                                        <span className="text-lg font-black">{leadQuality?.overall_quality_score || score.lead_quality_score || 0}</span>
                                    </div>
                                </div>
                                <span className="text-[8px] text-muted-foreground mt-1 block">Score Lead</span>
                            </div>
                            <div className="text-center">
                                <div className={cn("h-14 w-14 rounded-full flex items-center justify-center bg-gradient-to-br shadow-md",
                                    getScoreColor(leadQuality?.closing_probability || score.closing_probability || 0)
                                )}>
                                    <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center">
                                        <span className="text-lg font-black">{leadQuality?.closing_probability || score.closing_probability || 0}%</span>
                                    </div>
                                </div>
                                <span className="text-[8px] text-muted-foreground mt-1 block">Prob. Fech.</span>
                            </div>
                        </div>

                        {/* Lead Score Bars */}
                        <div className="space-y-1.5">
                            {leadScoreLabels.map(sl => {
                                const val = (leadQuality as any)?.[sl.key] || 0;
                                const displayVal = (sl as any).inverted ? val : val;
                                const colorVal = (sl as any).inverted ? (100 - val) : val;
                                return (
                                    <div key={sl.key} className="flex items-center gap-2">
                                        <sl.icon className={cn("h-3 w-3 shrink-0", sl.color)} />
                                        <span className="text-[10px] text-muted-foreground w-32 shrink-0">{sl.label}</span>
                                        <div className="flex-1">
                                            <Progress value={displayVal} className={cn("h-1.5", getProgressColor(colorVal))} />
                                        </div>
                                        <span className={cn("text-[10px] font-bold w-6 text-right",
                                            colorVal >= 80 ? "text-emerald-500" : colorVal >= 60 ? "text-blue-500" : colorVal >= 40 ? "text-amber-500" : "text-rose-500"
                                        )}>{displayVal}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Intent Signals */}
                        {(leadQuality?.intent_signals || score.intent_signals)?.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                                    <TrendingUp className="h-2.5 w-2.5" /> Sinais de Compra
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {(leadQuality?.intent_signals || score.intent_signals || []).map((s, i) => (
                                        <Badge key={i} variant="outline" className="text-[9px] h-4 bg-emerald-500/5 border-emerald-500/20 text-emerald-600">
                                            {s}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Objections */}
                        {(leadQuality?.objections || score.objections_detected)?.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[9px] font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                    <Shield className="h-2.5 w-2.5" /> Objeções Detectadas
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {(leadQuality?.objections || score.objections_detected || []).map((s, i) => (
                                        <Badge key={i} variant="outline" className="text-[9px] h-4 bg-rose-500/5 border-rose-500/20 text-rose-600">
                                            {s}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Next Action */}
                        {leadQuality?.recommended_next_action && (
                            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                <p className="text-[9px] font-semibold text-amber-600 flex items-center gap-1 mb-0.5">
                                    <ArrowRight className="h-2.5 w-2.5" /> Próxima Ação Recomendada
                                </p>
                                <p className="text-[10px] text-foreground">{leadQuality.recommended_next_action}</p>
                            </div>
                        )}

                        {/* Revenue */}
                        {(leadQuality?.revenue_per_lead || score.revenue_per_lead || 0) > 0 && (
                            <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                <p className="text-[9px] text-muted-foreground">Receita gerada</p>
                                <p className="text-sm font-bold text-emerald-600">
                                    R$ {(leadQuality?.revenue_per_lead || score.revenue_per_lead || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        )}

                        {/* Sale Stage */}
                        {score.sale_patterns?.sale_stage && (
                            <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="text-[9px] h-4">
                                    Estágio: {score.sale_patterns.sale_stage}
                                </Badge>
                                {score.sale_patterns.objection_category && score.sale_patterns.objection_category !== "none" && (
                                    <Badge variant="outline" className="text-[9px] h-4 text-rose-600 border-rose-500/20">
                                        Objeção: {score.sale_patterns.objection_category}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* ========== TAB: SLA ========== */}
                    <TabsContent value="sla" className="space-y-3 mt-3">
                        {leadQuality ? (
                            <>
                                {/* SLA Compliance Score */}
                                <div className="flex items-center justify-center py-1">
                                    <div className={cn("h-14 w-14 rounded-full flex items-center justify-center bg-gradient-to-br shadow-md",
                                        getScoreColor(leadQuality.sla_compliance_score)
                                    )}>
                                        <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center">
                                            <span className="text-lg font-black">{leadQuality.sla_compliance_score}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-[9px] text-muted-foreground">Score de Compliance SLA</p>

                                {/* SLA Metrics */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-lg bg-muted/50 border border-border/50 text-center">
                                        <Timer className="h-3.5 w-3.5 mx-auto text-blue-500 mb-1" />
                                        <p className="text-[9px] text-muted-foreground">1º Contato</p>
                                        <p className={cn("text-sm font-bold", leadQuality.sla_first_contact_ok ? "text-emerald-500" : "text-rose-500")}>
                                            {leadQuality.sla_first_contact_minutes}min
                                        </p>
                                        <Badge className={cn("text-[8px] h-3.5 mt-0.5", leadQuality.sla_first_contact_ok ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20")} variant="outline">
                                            {leadQuality.sla_first_contact_ok ? "✓ OK" : "✗ Atrasado"}
                                        </Badge>
                                    </div>
                                    <div className="p-2 rounded-lg bg-muted/50 border border-border/50 text-center">
                                        <MessageSquare className="h-3.5 w-3.5 mx-auto text-violet-500 mb-1" />
                                        <p className="text-[9px] text-muted-foreground">Tentativas</p>
                                        <p className="text-sm font-bold">{leadQuality.sla_total_attempts}</p>
                                        <p className="text-[8px] text-muted-foreground">contatos</p>
                                    </div>
                                </div>

                                {/* SLA Violations */}
                                {leadQuality.sla_violations?.length > 0 ? (
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                            <AlertCircle className="h-2.5 w-2.5" /> Violações
                                        </p>
                                        {leadQuality.sla_violations.map((v: any, i: number) => (
                                            <div key={i} className="flex items-start gap-1 text-[10px] text-rose-600 bg-rose-500/5 p-1.5 rounded border border-rose-500/10">
                                                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                                                <span>{typeof v === "string" ? v : JSON.stringify(v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                                        <p className="text-[10px] text-emerald-600 font-medium">Nenhuma violação de SLA</p>
                                    </div>
                                )}

                                {/* Followup Gaps */}
                                {leadQuality.sla_followup_gaps?.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider">Gaps de Follow-up</p>
                                        {leadQuality.sla_followup_gaps.map((g: any, i: number) => (
                                            <div key={i} className="text-[10px] text-amber-600 bg-amber-500/5 p-1.5 rounded border border-amber-500/10">
                                                Gap de {g.gap_hours || "?"}h após mensagem #{g.after_message || "?"}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-4">
                                <Timer className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-[10px] text-muted-foreground">Dados de SLA disponíveis após análise</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {/* Raw stats + analyzed_at */}
                {score.raw_analysis && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                        {[
                            { label: "Msgs", value: score.raw_analysis.total_messages },
                            { label: "Atendente", value: score.raw_analysis.agent_messages },
                            { label: "Lead", value: score.raw_analysis.lead_messages },
                            { label: "1ª Resp.", value: `${score.raw_analysis.response_time_minutes || 0}min` },
                        ].map(s => (
                            <div key={s.label} className="text-center px-2 py-0.5 rounded-md bg-muted/50 border border-border/30">
                                <p className="text-[8px] text-muted-foreground">{s.label}</p>
                                <p className="text-[10px] font-bold">{s.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {score.analyzed_at && (
                    <p className="text-[8px] text-muted-foreground/60 text-center">
                        Analisado em {new Date(score.analyzed_at).toLocaleString("pt-BR")}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
