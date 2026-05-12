import {
    BarChart3, Users, Calendar, CheckCircle2, Target, XCircle,
    Pencil, PieChart as PieChartIcon, Zap, HandCoins, DollarSign
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { FunnelStep } from "./FunnelStep";
import { cn } from "@/lib/utils";

interface FunnelAndAccountingProps {
    d: any; // DiagnosticData
    selectedEnriched: any; // EnrichedMonthData
    editMode: boolean;
    updateField: (field: string, value: number) => void;
    orgUsers: any[];
    healthScore: { conversion: number; roas: number; velocity: number; noShow: number; };
    fmt: (v: number) => string;
}

export function FunnelAndAccounting({
    d,
    selectedEnriched,
    editMode,
    updateField,
    orgUsers,
    healthScore,
    fmt
}: FunnelAndAccountingProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xl:gap-4 mt-6">
            {/* Funnel */}
            <div className="lg:col-span-1 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="p-4 border-b border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-transparent">
                    <h3 className="text-xs uppercase tracking-wider font-bold flex items-center gap-2 text-foreground">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Funil de Vendas
                    </h3>
                </div>
                <div className="p-5 flex-1 space-y-4">
                    <FunnelStep label="Leads Captados" value={d.total_leads} nextValue={d.meetings_scheduled}
                        icon={Users} color="bg-primary/10 text-primary" />
                    <div className="ml-5 border-l-2 border-dashed border-border/60 h-4" />
                    <FunnelStep label="Agendamentos" value={d.meetings_scheduled} nextValue={d.meetings_done}
                        icon={Calendar} color="bg-blue-500/10 text-blue-500" />
                    <div className="ml-5 border-l-2 border-dashed border-border/60 h-4" />
                    <FunnelStep label="Realizados" value={d.meetings_done} nextValue={d.contracts_won}
                        icon={CheckCircle2} color="bg-emerald-500/10 text-emerald-500" />
                    <div className="ml-5 border-l-2 border-dashed border-border/60 h-4" />
                    <FunnelStep label="Fechamentos" value={d.contracts_won}
                        icon={Target} color="bg-green-500/10 text-green-500" />

                    {d.no_show > 0 && (
                        <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-xs text-destructive font-bold">
                                {d.no_show} No-Show ({d.meetings_scheduled > 0 ? ((d.no_show / d.meetings_scheduled) * 100).toFixed(1) : 0}%)
                            </span>
                        </div>
                    )}

                    {/* Bookings data */}
                    {selectedEnriched && (selectedEnriched.bookings_confirmed > 0 || selectedEnriched.bookings_cancelled > 0) && (
                        <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bookings do Calendário</p>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-medium">Confirmados</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedEnriched.bookings_confirmed}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-medium">Cancelados</span>
                                <span className="font-bold text-destructive">{selectedEnriched.bookings_cancelled}</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2 font-medium">
                            <span className="uppercase tracking-wider">Conversão Lead → Contrato</span>
                            <span className="font-bold text-foreground text-sm">{d.conversion_rate.toFixed(1)}%</span>
                        </div>
                        <Progress value={Math.min(d.conversion_rate, 100)} className="h-2 bg-neutral-200 dark:bg-white/10" />
                    </div>
                </div>
            </div>

            {/* Fechamento Contábil (Edit Panel/P&L) */}
            <div className="lg:col-span-1 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="p-4 border-b border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-transparent">
                    <h3 className="text-xs uppercase tracking-wider font-bold flex items-center gap-2 text-foreground">
                        {editMode ? <Pencil className="h-4 w-4 text-primary" /> : <PieChartIcon className="h-4 w-4 text-primary" />}
                        {editMode ? "Parametrização" : "Fechamento Contábil"}
                    </h3>
                </div>
                <div className="p-5 flex-1">
                    {editMode ? (
                        <div className="space-y-4">
                            <p className="text-[10px] text-muted-foreground bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl font-medium">⚠️ Algumas métricas são imutáveis (extraídas diretamente das integrações). Ajuste Custos Fixos e Custo/Equipe aqui.</p>
                            <div className="space-y-2 mt-4">
                                {[
                                    { label: "Investimento Ads (R$)", key: "ad_spend" as const, icon: Zap },
                                    { label: "Taxa Comissão (%)", key: "commission_rate" as const, icon: HandCoins },
                                    { label: "Custo por Funcionário (R$)", key: "team_cost_per_person" as const, icon: Users },
                                    { label: "Custos Fixos Base (R$)", key: "fixed_costs" as const, icon: DollarSign },
                                ].map(f => (
                                    <div key={f.key} className="flex items-center gap-3">
                                        <f.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <label className="text-xs font-bold text-foreground w-40 shrink-0">{f.label}</label>
                                        <Input type="number" value={(d[f.key] as number) || ""} onChange={e => updateField(f.key, parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right bg-transparent border-neutral-300 dark:border-white/10" />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-6 mb-2 border-b border-border/50 pb-1">Datalake Indexador</p>
                            <div className="space-y-1.5 opacity-80 pointer-events-none">
                                {[
                                    { label: "Leads", value: d.total_leads, icon: Users },
                                    { label: "Agendamentos", value: d.meetings_scheduled, icon: Calendar },
                                    { label: "Realizados", value: d.meetings_done, icon: CheckCircle2 },
                                    { label: "No Show", value: d.no_show, icon: XCircle },
                                    { label: "Fechamentos", value: d.contracts_won, icon: Target },
                                    { label: "Receita", value: d.mrr || d.ltv_total, icon: DollarSign },
                                ].map(f => (
                                    <div key={f.label} className="flex items-center gap-2">
                                        <f.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <label className="text-[11px] text-muted-foreground w-36 shrink-0">{f.label}</label>
                                        <span className="text-xs font-bold text-right flex-1">{typeof f.value === 'number' && f.value > 999 ? fmt(f.value) : f.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="space-y-2.5">
                                {(() => {
                                    const eqCount = orgUsers?.length || 0;
                                    const tCosts = ((d.team_cost_per_person as number) || 0) * eqCount;
                                    const fCosts = (d.fixed_costs as number) || 0;
                                    const liquidProfit = (d.mrr || 0) - (d.ad_spend || 0) - tCosts - (d.commission_total || 0) - fCosts;
                                    return (
                                        <>
                                            <div className="flex justify-between items-center group">
                                                <span className="text-xs font-bold text-foreground uppercase tracking-widest">Receita Total Recebida</span>
                                                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{fmt(d.mrr)}</span>
                                            </div>
                                            <div className="flex justify-between items-center opacity-80 pt-2 text-muted-foreground">
                                                <span className="text-[11px] font-medium">(-) Investimento em Ads</span>
                                                <span className="text-xs font-bold text-destructive">-{fmt(d.ad_spend)}</span>
                                            </div>
                                            <div className="flex justify-between items-center opacity-80 text-muted-foreground">
                                                <span className="text-[11px] font-medium">(-) Equipe ({eqCount} func)</span>
                                                <span className="text-xs font-bold text-destructive">-{fmt(tCosts)}</span>
                                            </div>
                                            <div className="flex justify-between items-center opacity-80 text-muted-foreground">
                                                <span className="text-[11px] font-medium">(-) Comissões Totais</span>
                                                <span className="text-xs font-bold text-destructive">-{fmt(d.commission_total)}</span>
                                            </div>
                                            <div className="flex justify-between items-center opacity-80 text-muted-foreground pb-2">
                                                <span className="text-[11px] font-medium">(-) Custos Fixos</span>
                                                <span className="text-xs font-bold text-destructive">-{fmt(fCosts)}</span>
                                            </div>
                                            <div className="border-t border-border/60 pt-3 flex justify-between items-center bg-muted/20 p-2 rounded-xl -mx-2">
                                                <span className="text-xs font-bold uppercase tracking-widest pl-2 pt-1">Lucro Líquido</span>
                                                <span className={cn("text-2xl font-black tracking-tighter pr-2", liquidProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                                                    {fmt(liquidProfit)}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Health Score Breakdown */}
                            <div className="pt-4 border-t border-border/60">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Health Score Detalhado</p>
                                <div className="space-y-1.5 grid grid-cols-2 gap-x-4">
                                    {[
                                        { label: "Conversão", value: healthScore.conversion, weight: "35%" },
                                        { label: "ROAS", value: healthScore.roas, weight: "30%" },
                                        { label: "Velocidade", value: healthScore.velocity, weight: "20%" },
                                        { label: "No-Show", value: healthScore.noShow, weight: "15%" },
                                    ].map(item => (
                                        <div key={item.label} className="col-span-2 flex items-center justify-between">
                                            <span className="text-[10px] font-medium text-muted-foreground">{item.label} <span className="opacity-50">({item.weight})</span></span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                    <div className={cn("h-full rounded-full transition-all duration-700", item.value >= 70 ? "bg-emerald-500" : item.value >= 40 ? "bg-amber-500" : "bg-destructive")} style={{ width: `${item.value}%` }} />
                                                </div>
                                                <span className={cn("text-[10px] font-bold w-5 text-right", item.value >= 70 ? "text-emerald-600 dark:text-emerald-400" : item.value >= 40 ? "text-amber-500" : "text-destructive")}>{Math.round(item.value)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
