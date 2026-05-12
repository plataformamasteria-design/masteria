import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Megaphone, PieChart as PieChartIcon, Leaf, TrendingUp, Target, Activity } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, AreaChart, CartesianGrid, XAxis, YAxis, Area } from "recharts";
import { cn } from "@/lib/utils";
import type { AdSegmentedData } from "../types";

interface TrendData {
    month: string;
    leads: number;
    contratos: number;
    adLeads: number;
    organicLeads: number;
    mrr: number;
    adSpend: number;
}

interface SourcesTabContentProps {
    currentAdSeg: AdSegmentedData;
    trendData: TrendData[];
    d: any;
    fmt: (v: number) => string;
}

export function SourcesTabContent({ currentAdSeg, trendData, d, fmt }: SourcesTabContentProps) {
    return (
        <div className="space-y-4 mt-0 border-none p-0 outline-none">
            {/* Source Split Header */}
            <div className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Origem dos Leads</h2>
                <Badge variant="outline" className="text-xs">
                    {currentAdSeg.ad_leads + currentAdSeg.organic_leads} leads no período
                </Badge>
            </div>

            {/* Source Split Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pie Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <PieChartIcon className="h-4 w-4 text-primary" />
                            Distribuição por Origem
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {currentAdSeg.ad_leads + currentAdSeg.organic_leads > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Anúncios', value: currentAdSeg.ad_leads, fill: 'hsl(262 83% 58%)' },
                                            { name: 'Orgânicos', value: currentAdSeg.organic_leads, fill: 'hsl(142 76% 36%)' },
                                        ]}
                                        cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                        paddingAngle={3} dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        <Cell fill="hsl(262 83% 58%)" />
                                        <Cell fill="hsl(142 76% 36%)" />
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sem dados de leads no período</div>
                        )}
                    </CardContent>
                </Card>

                {/* Comparative KPIs */}
                <div className="grid grid-cols-2 gap-3">
                    {[
                        {
                            label: 'Total de Leads',
                            ad: currentAdSeg.ad_leads,
                            organic: currentAdSeg.organic_leads,
                            fmtFn: (v: number) => v.toString(),
                        },
                        {
                            label: 'Taxa de Conversão',
                            ad: currentAdSeg.ad_leads > 0 ? (currentAdSeg.ad_converted / currentAdSeg.ad_leads) * 100 : 0,
                            organic: currentAdSeg.organic_leads > 0 ? (currentAdSeg.organic_converted / currentAdSeg.organic_leads) * 100 : 0,
                            fmtFn: (v: number) => `${v.toFixed(1)}%`,
                        },
                        {
                            label: 'Qualificados',
                            ad: currentAdSeg.ad_qualified,
                            organic: currentAdSeg.organic_qualified,
                            fmtFn: (v: number) => v.toString(),
                        },
                        {
                            label: 'Tempo Médio (h)',
                            ad: currentAdSeg.ad_avg_hours,
                            organic: currentAdSeg.organic_avg_hours,
                            fmtFn: (v: number) => v > 0 ? `${v.toFixed(0)}h` : '—',
                        },
                    ].map(kpi => (
                        <Card key={kpi.label}>
                            <CardContent className="p-3">
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">{kpi.label}</p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                            <Megaphone className="h-3 w-3 text-purple-500" />
                                            <span className="text-[9px] text-purple-500 font-medium">Anúncio</span>
                                        </div>
                                        <p className="text-base font-bold text-purple-600 dark:text-purple-400">{kpi.fmtFn(kpi.ad)}</p>
                                    </div>
                                    <div className="h-8 w-px bg-border" />
                                    <div className="flex-1 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                            <Leaf className="h-3 w-3 text-emerald-500" />
                                            <span className="text-[9px] text-emerald-500 font-medium">Orgânico</span>
                                        </div>
                                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{kpi.fmtFn(kpi.organic)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Ad Leads Trend */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Leads por Origem — Tendência Mensal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Area type="monotone" dataKey="adLeads" name="Anúncios" stackId="1" stroke="hsl(262 83% 58%)" fill="hsl(262 83% 58% / 0.4)" />
                            <Area type="monotone" dataKey="organicLeads" name="Orgânicos" stackId="1" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.4)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Campaign Breakdown Table */}
            {currentAdSeg.campaign_breakdown.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" />
                            Desempenho por Campanha
                            <Badge variant="secondary" className="text-[10px] h-5 ml-auto">{currentAdSeg.campaign_breakdown.length} campanhas</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Campanha</th>
                                        <th className="text-center py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Leads</th>
                                        <th className="text-center py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Qualificados</th>
                                        <th className="text-center py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Convertidos</th>
                                        <th className="text-center py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Perdidos</th>
                                        <th className="text-center py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Conversão</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentAdSeg.campaign_breakdown.map((c, idx) => (
                                        <tr key={c.campaign_id} className={cn("border-b border-border/30", idx % 2 === 0 ? 'bg-muted/20' : '')}>
                                            <td className="py-2 px-2 font-medium text-xs max-w-[250px] truncate" title={c.campaign_name}>{c.campaign_name}</td>
                                            <td className="py-2 px-2 text-center font-bold">{c.count}</td>
                                            <td className="py-2 px-2 text-center text-blue-500 font-medium">{c.qualified}</td>
                                            <td className="py-2 px-2 text-center text-emerald-500 font-bold">{c.converted}</td>
                                            <td className="py-2 px-2 text-center text-red-500 font-medium">{c.lost}</td>
                                            <td className="py-2 px-2 text-center">
                                                <Badge variant="outline" className={cn("text-[10px]",
                                                    c.count > 0 && (c.converted / c.count) * 100 >= 10 ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'
                                                )}>
                                                    {c.count > 0 ? `${((c.converted / c.count) * 100).toFixed(1)}%` : '0%'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Ad vs Organic Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-purple-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Megaphone className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-semibold">Leads de Anúncios</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total</span><span className="font-bold">{currentAdSeg.ad_leads}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Qualificados</span><span className="font-medium text-blue-500">{currentAdSeg.ad_qualified}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Convertidos</span><span className="font-bold text-emerald-500">{currentAdSeg.ad_converted}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Perdidos</span><span className="font-medium text-red-500">{currentAdSeg.ad_lost}</span></div>
                            <Progress value={currentAdSeg.ad_leads > 0 ? (currentAdSeg.ad_converted / currentAdSeg.ad_leads) * 100 : 0} className="h-1.5 mt-1" />
                            <p className="text-[10px] text-muted-foreground text-right">
                                Conversão: {currentAdSeg.ad_leads > 0 ? ((currentAdSeg.ad_converted / currentAdSeg.ad_leads) * 100).toFixed(1) : '0'}%
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-emerald-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Leaf className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-semibold">Leads Orgânicos</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total</span><span className="font-bold">{currentAdSeg.organic_leads}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Qualificados</span><span className="font-medium text-blue-500">{currentAdSeg.organic_qualified}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Convertidos</span><span className="font-bold text-emerald-500">{currentAdSeg.organic_converted}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Perdidos</span><span className="font-medium text-red-500">{currentAdSeg.organic_lost}</span></div>
                            <Progress value={currentAdSeg.organic_leads > 0 ? (currentAdSeg.organic_converted / currentAdSeg.organic_leads) * 100 : 0} className="h-1.5 mt-1" />
                            <p className="text-[10px] text-muted-foreground text-right">
                                Conversão: {currentAdSeg.organic_leads > 0 ? ((currentAdSeg.organic_converted / currentAdSeg.organic_leads) * 100).toFixed(1) : '0'}%
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Comparativo</span>
                        </div>
                        <div className="space-y-3">
                            {(() => {
                                const adConv = currentAdSeg.ad_leads > 0 ? (currentAdSeg.ad_converted / currentAdSeg.ad_leads) * 100 : 0;
                                const orgConv = currentAdSeg.organic_leads > 0 ? (currentAdSeg.organic_converted / currentAdSeg.organic_leads) * 100 : 0;
                                const diff = adConv - orgConv;
                                return (
                                    <>
                                        <div className="p-2 rounded-lg bg-muted/50">
                                            <p className="text-[10px] text-muted-foreground mb-1">Diferença de Conversão</p>
                                            <p className={cn("text-lg font-bold", diff > 0 ? 'text-purple-500' : diff < 0 ? 'text-emerald-500' : 'text-muted-foreground')}>
                                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {diff > 0 ? 'Anúncios convertem mais' : diff < 0 ? 'Orgânicos convertem mais' : 'Desempenho igual'}
                                            </p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-muted/50">
                                            <p className="text-[10px] text-muted-foreground mb-1">CPL de Anúncios</p>
                                            <p className="text-lg font-bold">
                                                {currentAdSeg.ad_leads > 0 && d.ad_spend > 0 ? fmt(d.ad_spend / currentAdSeg.ad_leads) : '—'}
                                            </p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-muted/50">
                                            <p className="text-[10px] text-muted-foreground mb-1">CAC de Anúncios</p>
                                            <p className="text-lg font-bold">
                                                {currentAdSeg.ad_converted > 0 && d.ad_spend > 0 ? fmt(d.ad_spend / currentAdSeg.ad_converted) : '—'}
                                            </p>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
