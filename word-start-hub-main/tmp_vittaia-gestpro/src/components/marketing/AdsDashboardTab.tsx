import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, Users, CheckCircle, DollarSign, Activity, Target, MessageSquare, Briefcase } from "lucide-react";
import type { Campaign } from "./MarketingComponents";

export interface DashboardDiagnostic {
    id: string;
    reference_month: string;
    ad_spend: number;
    campaign_impressions: number;
    campaign_clicks: number;
    campaign_conversions: number;
    total_leads: number;
    meetings_scheduled: number;
    meetings_done: number;
    no_show: number;
    contracts_won: number;
    ltv_total: number;
}

export function AdsDashboardTab({
    campaigns,
    diagnostics
}: {
    campaigns: Campaign[];
    diagnostics: DashboardDiagnostic[];
}) {
    // Top-Level Aggregations (Marketing + CRM)
    // IMPORTANT: Marketing metrics (Spend, Leads) must come EXCLUSIVELY from 'campaigns' 
    // because 'campaigns' perfectly matches the requested date_range. 
    // 'diagnostics' is historical monthly blocks; summing it would ignore the date filter!
    const totalLeads = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    const totalInvestimento = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);

    // CRM Metrics (these do not have daily resolution currently in DB, so we sum diagnostics, 
    // recognizing they might be monthly estimations if date_range is small)
    const totalClientes = diagnostics.reduce((sum, d) => sum + (d.contracts_won || 0), 0);
    const totalReceita = diagnostics.reduce((sum, d) => sum + (d.ltv_total || 0), 0);

    const cac = totalClientes > 0 ? totalInvestimento / totalClientes : 0;
    const roi = totalInvestimento > 0 ? ((totalReceita - totalInvestimento) / totalInvestimento) * 100 : 0;
    const ticketMedio = totalClientes > 0 ? totalReceita / totalClientes : 0;
    const txCliente = totalLeads > 0 ? (totalClientes / totalLeads) * 100 : 0;

    // Funnel Steps 
    // Mapped roughly: Contatos -> totalLeads, Qualificados -> scheduled, Reuniões -> done, Propostas -> ?, Clientes -> won
    const funnelSteps = [
        { label: "Lead", value: totalLeads },
        { label: "Qualificado", value: diagnostics.reduce((sum, d) => sum + (d.meetings_scheduled || 0), 0) },
        { label: "Reunião", value: diagnostics.reduce((sum, d) => sum + (d.meetings_done || 0), 0) },
        { label: "Proposta", value: totalClientes > 0 ? totalClientes + 1 : 0 }, // fallback estimation if 0
        { label: "Comprou", value: totalClientes }
    ];

    const leadsSemReceita = totalLeads - totalClientes;
    const txQualif = funnelSteps[0].value > 0 ? (funnelSteps[1].value / funnelSteps[0].value) * 100 : 0;
    const txReuniao = funnelSteps[1].value > 0 ? (funnelSteps[2].value / funnelSteps[1].value) * 100 : 0;
    const txProposta = funnelSteps[2].value > 0 ? (funnelSteps[3].value / funnelSteps[2].value) * 100 : 0;

    // Campaigns Table
    const topCampaigns = [...campaigns]
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 10)
        .map(c => ({
            name: c.campaign_name,
            leads: c.conversions,
            clientes: 0, // In standard Meta Ads, we don't have direct customer count without server-side matching
            receita: 0,
            investimento: c.spend,
            roi: 0,
            status: c.status
        }));

    // Monthly Trend Chart
    const monthlyData = diagnostics.map(d => ({
        month: d.reference_month,
        leads: d.total_leads,
        clientes: d.contracts_won,
        receita: d.ltv_total,
        investimento: d.ad_spend,
        roi: d.ad_spend > 0 ? ((d.ltv_total - d.ad_spend) / d.ad_spend) * 100 : 0
    })).sort((a, b) => a.month.localeCompare(b.month));

    return (
        <div className="space-y-6 mt-4">
            {/* Header KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="TOTAL LEADS" value={totalLeads.toLocaleString()} badge="" />
                <KpiCard label="CLIENTES" value={totalClientes.toLocaleString()} badge="" highlight="text-emerald-500" />
                <KpiCard label="RECEITA" value={`R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} highlight="text-emerald-500" />
                <KpiCard label="INVESTIMENTO" value={`R$ ${totalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} highlight="text-amber-500" />
                <KpiCard label="CAC" value={`R$ ${cac.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <SecondaryKpi label="ROI" value={`${roi.toFixed(1)}%`} isNegative={roi < 0} />
                <SecondaryKpi label="TICKET MÉDIO" value={`R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <SecondaryKpi label="TX CLIENTE" value={`${txCliente.toFixed(1)}%`} />
                <SecondaryKpi label="TX QUALIF." value={`${txQualif.toFixed(1)}%`} />
                <SecondaryKpi label="TX REUNIÃO" value={`${txReuniao.toFixed(1)}%`} />
                <SecondaryKpi label="LEADS S/ RECEITA" value={leadsSemReceita.toLocaleString()} />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Funnel */}
                <Card className="col-span-1 border-primary/20 bg-card rounded-2xl shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-4 border-b">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Funil de Vendas</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">Etapa</th>
                                    <th className="px-4 py-2 text-right font-medium">Qtd</th>
                                    <th className="px-4 py-2 text-right font-medium">Conv.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {funnelSteps.map((step, i) => {
                                    const prevValue = i === 0 ? step.value : funnelSteps[i - 1].value;
                                    const convRate = prevValue > 0 ? (step.value / prevValue) * 100 : 0;
                                    return (
                                        <tr key={step.label} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-3 font-medium text-foreground">{step.label}</td>
                                            <td className="px-4 py-3 text-right font-bold">{step.value.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">{i === 0 ? '-' : `${convRate.toFixed(1)}%`}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Monthly Trend Chart */}
                <Card className="col-span-2 rounded-2xl shadow-sm border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tendência Mensal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorInvestimento" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(val) => `R$${val / 1000}k`} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                        formatter={(val: number, name: string) => {
                                            if (name === 'Receita' || name === 'Invest.') return [`R$ ${val.toFixed(2)}`, name];
                                            return [val, name];
                                        }}
                                    />
                                    <Area yAxisId="left" type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorReceita)" strokeWidth={2} />
                                    <Area yAxisId="left" type="monotone" dataKey="investimento" name="Invest." stroke="hsl(var(--chart-2))" fillOpacity={1} fill="url(#colorInvestimento)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados suficientes</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Top Campaigns */}
            <Card className="rounded-2xl shadow-sm border-border overflow-hidden">
                <CardHeader className="bg-muted/20 pb-4 border-b">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Top Campanhas</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Campanha</th>
                                <th className="px-4 py-3 text-right font-medium">Leads</th>
                                <th className="px-4 py-3 text-right font-medium">Clientes</th>
                                <th className="px-4 py-3 text-right font-medium">Receita</th>
                                <th className="px-4 py-3 text-right font-medium">Invest.</th>
                                <th className="px-4 py-3 text-right font-medium">ROI</th>
                                <th className="px-4 py-3 text-center font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {topCampaigns.length > 0 ? topCampaigns.map((c, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate" title={c.name}>{c.name}</td>
                                    <td className="px-4 py-3 text-right">{c.leads.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">-</td>
                                    <td className="px-4 py-3 text-right">-</td>
                                    <td className="px-4 py-3 text-right">R$ {c.investimento.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right text-muted-foreground">-</td>
                                    <td className="px-4 py-3 text-center">
                                        <Badge variant="outline" className={`text-[10px] ${c.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}`}>
                                            {c.status}
                                        </Badge>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma campanha encontrada</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}

function KpiCard({ label, value, badge, highlight }: { label: string; value: string; badge?: string; highlight?: string }) {
    return (
        <Card className="relative rounded-2xl border border-white/5 dark:border-white/10 shadow-lg dark:bg-neutral-900/50 bg-white/50 backdrop-blur-md overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-400 ease-out group">
            <div className="p-5 flex flex-col justify-center h-full relative z-10">
                <p className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase mb-2 group-hover:text-primary transition-colors duration-300">{label}</p>
                <div className="flex items-baseline gap-2">
                    <p className={`text-2xl md:text-3xl font-black tracking-tight ${highlight || 'text-foreground'}`}>{value}</p>
                    {badge && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">{badge}</span>}
                </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none" />
        </Card>
    );
}

function SecondaryKpi({ label, value, isNegative }: { label: string; value: string; isNegative?: boolean }) {
    return (
        <Card className="relative rounded-xl border border-white/5 dark:border-white/10 dark:bg-neutral-900/40 bg-white/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 ease-out group">
            <div className="p-4 text-center relative z-10">
                <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-1.5 group-hover:text-primary transition-colors duration-300">{label}</p>
                <p className={`text-lg font-black tracking-tight ${isNegative ? 'text-destructive drop-shadow-sm' : 'text-foreground'}`}>{value}</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0 pointer-events-none" />
        </Card>
    );
}
