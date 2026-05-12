import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
    Timer, CheckCircle2, AlertTriangle, XCircle, Users,
    MessageSquare, TrendingUp, Flame, Target
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn } from "@/lib/utils";

export default function SLAComplianceWidget() {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            // Fetch lead quality scores for SLA data
            const { data: scores } = await (supabase as any)
                .from("lead_quality_scores")
                .select("sla_compliance_score, sla_first_contact_ok, sla_violations, quality_tier, overall_quality_score, closing_probability")
                .eq("organization_id", orgId)
                .order("analyzed_at", { ascending: false })
                .limit(100);

            if (!scores || scores.length === 0) {
                setData(null);
                return;
            }

            const total = scores.length;
            const avgSLA = Math.round(scores.reduce((a: number, s: any) => a + (s.sla_compliance_score || 0), 0) / total);
            const slaOk = scores.filter((s: any) => s.sla_first_contact_ok).length;
            const slaOkPct = Math.round((slaOk / total) * 100);
            const totalViolations = scores.reduce((a: number, s: any) => a + (s.sla_violations?.length || 0), 0);

            const tiers = { hot: 0, warm: 0, cold: 0, dead: 0 };
            scores.forEach((s: any) => {
                tiers[s.quality_tier as keyof typeof tiers] = (tiers[s.quality_tier as keyof typeof tiers] || 0) + 1;
            });

            const avgClosing = Math.round(scores.reduce((a: number, s: any) => a + (s.closing_probability || 0), 0) / total);

            setData({
                total,
                avgSLA,
                slaOkPct,
                totalViolations,
                tiers,
                avgClosing,
            });
        } catch (e) {
            console.error("[SLAComplianceWidget] Error:", e);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <Card>
                <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-12 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card className="border-blue-500/20">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Timer className="h-4 w-4 text-blue-500" />
                        SLA & Qualidade de Leads
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4">
                        <Timer className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                            Analise conversas para ver métricas de SLA
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const getScoreColor = (s: number) =>
        s >= 80 ? "text-emerald-500" : s >= 60 ? "text-blue-500" : s >= 40 ? "text-amber-500" : "text-rose-500";

    return (
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4 text-blue-500" />
                    SLA & Qualidade de Leads
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Main Metrics */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                        <p className={cn("text-xl font-black", getScoreColor(data.avgSLA))}>{data.avgSLA}</p>
                        <p className="text-[9px] text-muted-foreground">SLA Score</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                        <p className={cn("text-xl font-black", data.slaOkPct >= 80 ? "text-emerald-500" : "text-rose-500")}>{data.slaOkPct}%</p>
                        <p className="text-[9px] text-muted-foreground">1º Contato OK</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                        <p className={cn("text-xl font-black", data.avgClosing >= 50 ? "text-emerald-500" : "text-amber-500")}>{data.avgClosing}%</p>
                        <p className="text-[9px] text-muted-foreground">Prob. Fech.</p>
                    </div>
                </div>

                {/* Lead Tier Distribution */}
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground">Distribuição de Leads</p>
                    <div className="flex gap-1.5">
                        {[
                            { key: "hot", label: "🔥 Hot", color: "bg-rose-500" },
                            { key: "warm", label: "🌡️ Warm", color: "bg-amber-500" },
                            { key: "cold", label: "❄️ Cold", color: "bg-blue-500" },
                            { key: "dead", label: "💀 Dead", color: "bg-muted-foreground" },
                        ].map(t => {
                            const count = data.tiers[t.key] || 0;
                            const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                            return (
                                <div key={t.key} className="flex-1 text-center">
                                    <div className="h-8 rounded bg-muted/50 relative overflow-hidden mb-0.5">
                                        <div className={cn("absolute bottom-0 w-full rounded transition-all", t.color)} style={{ height: `${pct}%`, opacity: 0.6 }} />
                                        <span className="relative text-[10px] font-bold">{count}</span>
                                    </div>
                                    <p className="text-[8px] text-muted-foreground">{t.label}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Violations */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className={cn("h-4 w-4", data.totalViolations > 0 ? "text-rose-500" : "text-emerald-500")} />
                        <span className="text-xs text-muted-foreground">Violações SLA</span>
                    </div>
                    <Badge variant="outline" className={cn("text-xs", data.totalViolations > 0 ? "text-rose-500 border-rose-500/20" : "text-emerald-500 border-emerald-500/20")}>
                        {data.totalViolations}
                    </Badge>
                </div>

                <p className="text-[8px] text-muted-foreground/60 text-center">
                    Baseado em {data.total} leads analisados
                </p>
            </CardContent>
        </Card>
    );
}
