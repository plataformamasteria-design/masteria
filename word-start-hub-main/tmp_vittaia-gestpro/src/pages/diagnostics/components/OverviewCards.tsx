import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users, Calendar, CheckCircle2, DollarSign, Calculator, TrendingUp,
    Lightbulb, AlertTriangle, ArrowUpRight, Activity, Eye, Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OverviewCardsProps {
    d: any; // Using any to quickly bridge, but should be DiagnosticData
    p: any;
    currentAdSeg: any;
    healthScore: { overall: number; label: string; color: string; };
    smartAlerts: any[];
    projection: { nextMonth: number; trend: string; };
    lifetimeMode: boolean;
    trueLifetimeMode: boolean;
    selectedYear: string;
    editMode: boolean;
    setEditMode: (v: boolean) => void;
    getMonthName: (v: number) => string;
    fmt: (v: number) => string;
}

const delta = (current: number, previous?: number): { value: string; positive: boolean } | null => {
    if (!previous) return null;
    if (previous === 0) return current > 0 ? { value: '+100.0', positive: true } : { value: '0.0', positive: true };
    const pct = ((current - previous) / previous) * 100;
    return { value: Math.abs(pct).toFixed(1), positive: pct >= 0 };
};

export function OverviewCards({
    d,
    p,
    currentAdSeg,
    healthScore,
    smartAlerts,
    projection,
    lifetimeMode,
    trueLifetimeMode,
    selectedYear,
    editMode,
    setEditMode,
    getMonthName,
    fmt
}: OverviewCardsProps) {
    return (
        <>
            {/* Month Title */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-bold capitalize">{trueLifetimeMode ? 'Período Vitalício' : lifetimeMode ? `Todo Período — ${selectedYear}` : `${getMonthName(d.reference_month)} ${selectedYear}`}</h2>
                    {d.total_leads > 0 && (
                        <Badge variant="outline" className="text-xs">
                            {d.total_leads} leads · {d.contracts_won} fechamentos
                        </Badge>
                    )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                    {editMode ? <Eye className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
                    {editMode ? "Visualizar" : "Editar"}
                </Button>
            </div>

            {/* Health Score + Main KPIs Row */}
            <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 xl:gap-4">
                {/* Health Score Card */}
                <div className="col-span-2 lg:col-span-1 group relative overflow-hidden rounded-2xl border-2 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300" style={{ borderColor: healthScore.overall >= 80 ? 'hsl(142 76% 36% / 0.3)' : healthScore.overall >= 60 ? 'hsl(217 91% 60% / 0.3)' : healthScore.overall >= 40 ? 'hsl(38 92% 50% / 0.3)' : 'hsl(0 84% 60% / 0.3)' }}>
                    <div className="p-3 md:p-4 h-full flex flex-col justify-between relative z-10 gap-3">
                        <div className="flex items-center gap-1.5 xl:gap-2">
                            <Activity className={cn("h-4 w-4", healthScore.color)} />
                            <span className="text-[9px] xl:text-[10px] text-muted-foreground font-bold uppercase leading-tight tracking-wider">Health Score</span>
                        </div>
                        <div>
                            <p className={cn("text-4xl xl:text-5xl font-black tracking-tighter", healthScore.color)}>{healthScore.overall}</p>
                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 mt-1 border-current bg-transparent tracking-widest uppercase", healthScore.color)}>{healthScore.label}</Badge>
                        </div>
                    </div>
                </div>

                {[
                    { label: "Leads", value: d.total_leads, fmt: (v: number) => v.toString(), icon: Users, color: "text-primary", prev: p?.total_leads, sub: currentAdSeg.ad_leads > 0 ? `${currentAdSeg.ad_leads} de anúncios` : undefined },
                    { label: "Agendamentos", value: d.meetings_scheduled, fmt: (v: number) => v.toString(), icon: Calendar, color: "text-blue-500", prev: p?.meetings_scheduled },
                    { label: "Fechamentos", value: d.contracts_won, fmt: (v: number) => v.toString(), icon: CheckCircle2, color: "text-emerald-500", prev: p?.contracts_won },
                    { label: "MRR", value: d.mrr, fmt, icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400", prev: p?.mrr },
                    { label: "CPL", value: d.cpl, fmt, icon: Calculator, color: "text-orange-500", prev: p?.cpl, invertColor: true },
                    { label: "ROAS", value: d.roas, fmt: (v: number) => `${v.toFixed(2)}x`, icon: TrendingUp, color: "text-purple-500", prev: p?.roas },
                ].map((kpi, index) => {
                    const change = delta(kpi.value, kpi.prev);
                    const isPositive = change?.positive;
                    const good = kpi.invertColor ? !isPositive : isPositive;
                    const bad = kpi.invertColor ? isPositive : !isPositive;
                    let deltaColor = 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';
                    if (change && Number(change.value) !== 0) {
                        if (good) deltaColor = 'text-emerald-700 bg-emerald-100/50 dark:text-emerald-400 dark:bg-emerald-500/10';
                        if (bad) deltaColor = 'text-red-700 bg-red-100/50 dark:text-red-400 dark:bg-red-500/10';
                    }

                    return (
                        <div key={kpi.label} className="col-span-1 group relative overflow-hidden rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
                            <div className="p-3 md:p-4 h-full flex flex-col justify-between relative z-10 gap-3">
                                <div className="flex items-start justify-between gap-1 flex-wrap sm:flex-nowrap">
                                    <div className="flex items-start gap-1.5 xl:gap-2">
                                        <kpi.icon className={cn("w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0 mt-0.5", kpi.color)} />
                                        <span className="text-[9px] xl:text-[10px] text-muted-foreground font-bold uppercase leading-tight uppercase tracking-wider">{kpi.label}</span>
                                    </div>
                                    {change && Number(change.value) !== 0 && (
                                        <div className={`px-1 py-0.5 mt-[-2px] rounded-md text-[8px] font-bold flex items-center gap-0.5 whitespace-nowrap shrink-0 ${deltaColor}`}>
                                            {change.positive ? '↗' : '↘'} {change.value}%
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xl xl:text-2xl font-black tracking-tighter truncate text-foreground">{kpi.fmt(kpi.value)}</p>
                                    {(kpi as any).sub && (
                                        <p className="text-[9px] text-primary/70 font-bold uppercase mt-0.5 tracking-wider truncate">{(kpi as any).sub}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Smart Alerts */}
            {smartAlerts.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 backdrop-blur-xl shadow-sm overflow-hidden mt-4">
                    <div className="p-4 border-b border-amber-500/10 bg-amber-500/10 dark:bg-transparent">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <Lightbulb className="h-4 w-4" />
                            Alertas Inteligentes
                            <Badge variant="secondary" className="text-[10px] h-5 ml-auto bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/30 border-none">{smartAlerts.length}</Badge>
                        </h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {smartAlerts.map((alert, idx) => (
                            <div key={idx} className={cn("flex items-start gap-2.5 p-3 rounded-xl border border-white/10 dark:border-white/5",
                                alert.type === 'success' ? "bg-emerald-500/10" : alert.type === 'danger' ? "bg-destructive/10" : "bg-amber-500/10"
                            )}>
                                {alert.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> :
                                    alert.type === 'danger' ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> :
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-xs font-bold leading-tight",
                                        alert.type === 'success' ? "text-emerald-700 dark:text-emerald-400" :
                                            alert.type === 'danger' ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                                    )}>{alert.message}</p>
                                    {alert.action && (
                                        <p className="text-[10px] text-muted-foreground mt-1 font-medium leading-snug">💡 {alert.action}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Revenue Projection */}
            {projection.nextMonth > 0 && !lifetimeMode && !trueLifetimeMode && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-xl shadow-sm overflow-hidden mt-4">
                    <div className="p-5 flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                            <ArrowUpRight className={cn("h-6 w-6", projection.trend === 'up' ? "text-emerald-500" : projection.trend === 'down' ? "text-destructive" : "text-primary")} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Projeção de Receita — Próximo Mês</p>
                            <p className="text-2xl font-black tracking-tight">{fmt(projection.nextMonth)}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider px-2 py-1",
                            projection.trend === 'up' ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" :
                                projection.trend === 'down' ? "text-destructive border-destructive/30 bg-destructive/10" :
                                    "text-muted-foreground border-border bg-muted/50"
                        )}>
                            {projection.trend === 'up' ? '📈 Crescimento' : projection.trend === 'down' ? '📉 Queda' : '➡️ Estável'}
                        </Badge>
                    </div>
                </div>
            )}
        </>
    );
}
