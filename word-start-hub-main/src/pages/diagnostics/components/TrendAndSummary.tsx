import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { BarChart3 } from "lucide-react";

interface TrendAndSummaryProps {
    selectedYear: string;
    orgFunnels: any[];
    selectedFunnelId: string;
    setSelectedFunnelId: (id: string) => void;
    funnelStageData: any[];
    trendData: any[];
    totals: any;
    fmt: (v: number) => string;
}

export function TrendAndSummary({
    selectedYear,
    orgFunnels,
    selectedFunnelId,
    setSelectedFunnelId,
    funnelStageData,
    trendData,
    totals,
    fmt
}: TrendAndSummaryProps) {
    return (
        <>
            {/* Trend Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">Evolução do Funil ({selectedYear})</CardTitle>
                            {orgFunnels.length > 0 && (
                                <select value={selectedFunnelId} onChange={e => setSelectedFunnelId(e.target.value)} className="h-7 text-[11px] rounded-md border border-input bg-background px-2 max-w-[180px]">
                                    {orgFunnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {funnelStageData.length > 0 ? (
                            <div className="space-y-3">
                                {funnelStageData.map((stage) => {
                                    const maxCount = Math.max(...funnelStageData.map(s => s.count), 1);
                                    return (
                                        <div key={stage.name} className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0 truncate">{stage.name}</span>
                                            <div className="flex-1 h-6 bg-muted/50 rounded-md overflow-hidden relative">
                                                <div className="h-full rounded-md transition-all duration-700 opacity-80" style={{ width: `${(stage.count / maxCount) * 100}%`, backgroundColor: stage.color }} />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold">{stage.count}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="pt-3 border-t border-border/50">
                                    <ResponsiveContainer width="100%" height={160}>
                                        <AreaChart data={trendData}>
                                            <defs>
                                                <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gradContratos" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                            <XAxis dataKey="month" className="text-[10px]" />
                                            <YAxis className="text-[10px]" />
                                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                                            <Area type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" fill="url(#gradLeads)" strokeWidth={2} />
                                            <Area type="monotone" dataKey="contratos" name="Fechamentos" stroke="hsl(142 76% 36%)" fill="url(#gradContratos)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="gradLeads2" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradContratos2" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="month" className="text-[10px]" />
                                    <YAxis className="text-[10px]" />
                                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Area type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" fill="url(#gradLeads2)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="contratos" name="Fechamentos" stroke="hsl(142 76% 36%)" fill="url(#gradContratos2)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">MRR vs Investimento ({selectedYear})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="gradMrr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradAdSpend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="month" className="text-[10px]" />
                                <YAxis className="text-[10px]" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => fmt(v)} />
                                <Legend wrapperStyle={{ fontSize: "11px" }} />
                                <Area type="monotone" dataKey="mrr" name="MRR" stroke="hsl(142 76% 36%)" fill="url(#gradMrr)" strokeWidth={2} />
                                <Area type="monotone" dataKey="adSpend" name="Investimento" stroke="hsl(var(--destructive))" fill="url(#gradAdSpend)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Year Summary */}
            <Card className="mt-4">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Resumo Anual {selectedYear}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {[
                            { label: "Total Leads", value: totals.total_leads.toString() },
                            { label: "Agendamentos", value: totals.meetings_scheduled.toString() },
                            { label: "Fechamentos", value: totals.contracts_won.toString() },
                            { label: "Conversão", value: totals.total_leads > 0 ? `${((totals.contracts_won / totals.total_leads) * 100).toFixed(1)}%` : "0%" },
                            { label: "Receita Total", value: fmt(totals.mrr) },
                            { label: "Investimento", value: fmt(totals.ad_spend) },
                            { label: "ROAS Médio", value: totals.ad_spend > 0 ? `${(totals.mrr / totals.ad_spend).toFixed(2)}x` : "0x" },
                        ].map(s => (
                            <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                                <p className="text-sm font-bold mt-0.5">{s.value}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
