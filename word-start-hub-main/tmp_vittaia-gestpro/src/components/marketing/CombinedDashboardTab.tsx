import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { Users, DollarSign, Eye, MousePointerClick, Target, TrendingUp, ArrowDownRight, MessageCircle, PlayCircle, BarChart3 } from "lucide-react";
import type { Campaign, SocialProfile } from "./MarketingComponents";
import type { DashboardDiagnostic } from "./AdsDashboardTab";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))'];

function KpiCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: string }) {
    return (
        <Card className="relative rounded-2xl border border-white/5 dark:border-white/10 shadow-lg dark:bg-neutral-900/50 bg-white/50 backdrop-blur-md overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-400 ease-out group">
            <div className="p-5 flex flex-col justify-center h-full relative z-10">
                <p className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase mb-2 group-hover:text-primary transition-colors duration-300 flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" /> {label}
                </p>
                <p className={`text-2xl md:text-3xl font-black tracking-tight ${highlight || 'text-foreground'}`}>{value}</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 pointer-events-none" />
        </Card>
    );
}

function AdsFunnelStep({ label, value, nextValue, icon: Icon, color }: {
    label: string; value: number; nextValue?: number; icon: any; color: string;
}) {
    const convRate = nextValue !== undefined && value > 0 ? ((nextValue / value) * 100).toFixed(1) : null;
    return (
        <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold">{value.toLocaleString('pt-BR')}</p>
            </div>
            {convRate && (
                <div className="flex items-center gap-1 shrink-0">
                    <ArrowDownRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{convRate}%</span>
                </div>
            )}
        </div>
    );
}

export function CombinedDashboardTab({
    campaigns,
    diagnostics,
    profiles
}: {
    campaigns: Campaign[];
    diagnostics: DashboardDiagnostic[];
    profiles: SocialProfile[];
}) {
    const accountTotal = campaigns.find(c => c.raw_data?.is_account_total);
    const regularCampaigns = campaigns.filter(c => !c.raw_data?.is_account_total);
    const googleCampaigns = regularCampaigns.filter(c => c.platform === 'google_ads');
    const metaCampaigns = regularCampaigns.filter(c => c.platform === 'meta_ads');

    const isMessageObj = (c: Campaign) => c.raw_data?.objective === 'MESSAGES' || c.raw_data?.objective === 'OUTCOME_ENGAGEMENT' || c.campaign_name.includes('[MSGS]');

    // "Leads Reais" / "Contatos" = Formulários de Conversões do Wpp / Direct
    const totalLeadsReais = metaCampaigns.filter(isMessageObj).reduce((sum, c) => sum + (c.conversions || 0), 0) + googleCampaigns.reduce((s, c) => s + (c.conversions || 0), 0);

    // "Formulários"
    const totalFormularios = metaCampaigns.filter(c => !isMessageObj(c)).reduce((sum, c) => sum + (c.conversions || 0), 0);

    const totalInvestimento = (accountTotal ? (accountTotal.spend || 0) : metaCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0)) + googleCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalClicks = (accountTotal ? (accountTotal.clicks || 0) : metaCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0)) + googleCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalImpressions = (accountTotal ? (accountTotal.impressions || 0) : metaCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0)) + googleCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);

    const totalClientes = diagnostics.reduce((sum, d) => sum + (d.contracts_won || 0), 0);
    const totalReceita = diagnostics.reduce((sum, d) => sum + (d.ltv_total || 0), 0);

    const totalReach = (accountTotal ? (accountTotal.raw_data?.reach || 0) : metaCampaigns.reduce((sum, c) => sum + (c.raw_data?.reach || 0), 0));
    const totalVideoViews = (accountTotal ? (accountTotal.raw_data?.video_views || 0) : metaCampaigns.reduce((sum, c) => sum + (c.raw_data?.video_views || 0), 0));
    const totalLinkClicks = (accountTotal ? (accountTotal.raw_data?.link_clicks || 0) : metaCampaigns.reduce((sum, c) => sum + (c.raw_data?.link_clicks || 0), 0)) + googleCampaigns.reduce((sum, c) => sum + (c.raw_data?.link_clicks || 0), 0);

    const cac = totalClientes > 0 ? totalInvestimento / totalClientes : 0;
    const cpl = totalLeadsReais > 0 ? totalInvestimento / totalLeadsReais : 0;
    const roas = totalInvestimento > 0 ? totalReceita / totalInvestimento : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;

    // --- Deltas / Previous Period ---
    const getPrev = (c: Campaign, field: string) => Number(c.raw_data?.previous_period?.[field] || 0);

    const prevLeadsReais = metaCampaigns.filter(isMessageObj).reduce((sum, c) => sum + getPrev(c, 'leads'), 0) + googleCampaigns.reduce((s, c) => s + getPrev(c, 'conversions'), 0);
    const prevFormularios = metaCampaigns.filter(c => !isMessageObj(c)).reduce((sum, c) => sum + getPrev(c, 'leads'), 0);
    const prevInvestimento = (accountTotal ? getPrev(accountTotal, 'spend') : metaCampaigns.reduce((sum, c) => sum + getPrev(c, 'spend'), 0)) + googleCampaigns.reduce((sum, c) => sum + getPrev(c, 'spend'), 0);
    const prevClicks = (accountTotal ? getPrev(accountTotal, 'clicks') : metaCampaigns.reduce((sum, c) => sum + getPrev(c, 'clicks'), 0)) + googleCampaigns.reduce((sum, c) => sum + getPrev(c, 'clicks'), 0);
    const prevImpressions = (accountTotal ? getPrev(accountTotal, 'impressions') : metaCampaigns.reduce((sum, c) => sum + getPrev(c, 'impressions'), 0)) + googleCampaigns.reduce((sum, c) => sum + getPrev(c, 'impressions'), 0);
    const prevReach = (accountTotal ? getPrev(accountTotal, 'reach') : metaCampaigns.reduce((sum, c) => sum + getPrev(c, 'reach'), 0));
    const prevVideoViews = (accountTotal ? getPrev(accountTotal, 'video_views') : metaCampaigns.reduce((sum, c) => sum + getPrev(c, 'video_views'), 0));
    const prevLinkClicks = (accountTotal ? getPrev(accountTotal, 'link_clicks') : metaCampaigns.reduce((sum, c) => sum + getPrev(c, 'link_clicks'), 0)) + googleCampaigns.reduce((sum, c) => sum + getPrev(c, 'link_clicks'), 0);

    const prevCpl = prevLeadsReais > 0 ? prevInvestimento / prevLeadsReais : 0;
    const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
    const prevCpc = prevClicks > 0 ? prevInvestimento / prevClicks : 0;
    const prevFrequency = prevReach > 0 ? prevImpressions / prevReach : 0;

    const calcDelta = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : null;

    // Gráfico Diário de Performance (Gasto x Cliques)
    const dailyMap: Record<string, { date: string, investimento: number, cliques: number }> = {};
    let hasDailyData = false;

    regularCampaigns.forEach(c => {
        if (c.raw_data?.daily_insights && Array.isArray(c.raw_data.daily_insights)) {
            if (c.raw_data.daily_insights.length > 0) hasDailyData = true;
            c.raw_data.daily_insights.forEach((d: any) => {
                const date = d.date_start;
                if (!dailyMap[date]) dailyMap[date] = { date, investimento: 0, cliques: 0 };
                dailyMap[date].investimento += parseFloat(d.spend || 0);
                dailyMap[date].cliques += parseInt(d.clicks || 0);
            });
        }
    });

    const chartData = hasDailyData
        ? Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
        : [];

    const mockDemographics = [
        { age: "18-24", M: 15, F: 25 },
        { age: "25-34", M: 35, F: 45 },
        { age: "35-44", M: 25, F: 20 },
        { age: "45-54", M: 10, F: 15 },
        { age: "55+", M: 5, F: 5 },
    ];

    const totalM = mockDemographics.reduce((acc, curr) => acc + curr.M, 0);
    const totalF = mockDemographics.reduce((acc, curr) => acc + curr.F, 0);

    const genderPieData = [
        { name: 'Mulheres', value: totalF, color: 'hsl(var(--primary))' },
        { name: 'Homens', value: totalM, color: 'hsl(var(--chart-2))' }
    ];

    function PremiumKpiCard({ icon: Icon, label, value, colorClass, delta, invertDelta }: { icon: any; label: string; value: number | string; colorClass?: string; delta?: number | null; invertDelta?: boolean; }) {
        let deltaColor = 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';
        if (delta !== undefined && delta !== null) {
            const isPositive = delta > 0;
            const good = invertDelta ? !isPositive : isPositive;
            const bad = invertDelta ? isPositive : !isPositive;
            if (good && delta !== 0) deltaColor = 'text-emerald-700 bg-emerald-100/50 dark:text-emerald-400 dark:bg-emerald-500/10';
            if (bad && delta !== 0) deltaColor = 'text-red-700 bg-red-100/50 dark:text-red-400 dark:bg-red-500/10';
        }

        return (
            <div className="group relative overflow-hidden rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="p-3 sm:p-4 h-full flex flex-col justify-between relative z-10 gap-3">
                    <div className="flex items-start justify-between gap-1 flex-wrap sm:flex-nowrap">
                        <div className="flex items-start gap-1.5 xl:gap-2.5">
                            {Icon && <Icon className={`w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0 mt-0.5 ${colorClass || 'text-zinc-500'}`} />}
                            <p className="text-[8px] xl:text-[10px] font-bold text-muted-foreground uppercase leading-tight line-clamp-2">{label}</p>
                        </div>
                        {delta !== undefined && delta !== null && delta !== 0 ? (
                            <div className={`px-1 py-0.5 mt-[-2px] rounded-md text-[8px] font-bold flex items-center gap-0.5 whitespace-nowrap shrink-0 ${deltaColor}`}>
                                {delta > 0 ? '↗' : '↘'} {Math.abs(delta).toFixed(1)}%
                            </div>
                        ) : null}
                    </div>
                    <h4 className="text-xl xl:text-2xl font-black tracking-tight text-foreground truncate">{value}</h4>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-4 animate-in fade-in zoom-in-95 duration-500">
            {/* Top KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                {/* Hero / Financials */}
                <div className="xl:col-span-1 rounded-2xl border border-zinc-200/60 dark:border-white/5 bg-white dark:bg-zinc-950 p-6 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <DollarSign className="w-24 h-24 text-zinc-900 dark:text-white" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Investimento Total</p>
                    <div className="flex items-center gap-3 mb-6 mt-2 flex-wrap">
                        <h3 className="text-3xl xl:text-4xl font-black tracking-tight">
                            R$ {totalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                        {(() => {
                            const d = calcDelta(totalInvestimento, prevInvestimento);
                            if (d === null) return null;
                            return (
                                <div className="px-2 py-0.5 rounded text-xs font-bold flex items-center gap-0.5 whitespace-nowrap bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                    {d > 0 ? '↗' : '↘'} {Math.abs(d).toFixed(1)}% (vs ant.)
                                </div>
                            )
                        })()}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-auto">
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-white/5">
                            <p className="text-[9px] xl:text-[10px] text-muted-foreground font-bold uppercase mb-0.5">ROAS Global</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{roas.toFixed(2)}x</p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-white/5">
                            <p className="text-[9px] xl:text-[10px] text-muted-foreground font-bold uppercase mb-0.5">CPL Médio</p>
                            <p className="font-bold text-zinc-700 dark:text-zinc-300 text-lg">R$ {cpl.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                {/* Conversion & Leads Cluster (col-span-1) */}
                <div className="xl:col-span-1 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <PremiumKpiCard icon={MessageCircle} label="Leads (Msgs)" value={totalLeadsReais.toLocaleString('pt-BR')} colorClass="text-emerald-600 dark:text-emerald-400" delta={calcDelta(totalLeadsReais, prevLeadsReais)} />
                    </div>
                    <PremiumKpiCard icon={Target} label="Custo / Lead" value={`R$ ${cpl.toFixed(2)}`} colorClass="text-amber-600 dark:text-amber-400" delta={calcDelta(cpl, prevCpl)} invertDelta={true} />
                    <PremiumKpiCard icon={Users} label="Cadastros" value={totalFormularios.toLocaleString('pt-BR')} colorClass="text-blue-500" delta={calcDelta(totalFormularios, prevFormularios)} />
                </div>

                {/* Traffic & Engagement Cluster (col-span-1) */}
                <div className="xl:col-span-1 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <PremiumKpiCard icon={MousePointerClick} label="Cliques no Site" value={totalLinkClicks.toLocaleString('pt-BR')} colorClass="text-indigo-500" delta={calcDelta(totalLinkClicks, prevLinkClicks)} />
                    </div>
                    <PremiumKpiCard icon={MousePointerClick} label="Cliques (Todos)" value={totalClicks.toLocaleString('pt-BR')} colorClass="text-zinc-500" delta={calcDelta(totalClicks, prevClicks)} />
                    <PremiumKpiCard icon={PlayCircle} label="Views Vídeo" value={totalVideoViews.toLocaleString('pt-BR')} colorClass="text-purple-500" delta={calcDelta(totalVideoViews, prevVideoViews)} />
                </div>

                {/* Health & Volume Cluster (col-span-1) */}
                <div className="xl:col-span-1 grid grid-cols-2 gap-4">
                    <PremiumKpiCard icon={BarChart3} label="CTR Médio" value={`${avgCtr.toFixed(2)}%`} colorClass="text-zinc-500" delta={calcDelta(avgCtr, prevCtr)} />
                    <PremiumKpiCard icon={TrendingUp} label="CPC Médio" value={`R$ ${totalClicks > 0 ? (totalInvestimento / totalClicks).toFixed(2) : '0.00'}`} colorClass="text-zinc-500" delta={calcDelta(((totalInvestimento / totalClicks) || 0), prevCpc)} invertDelta={true} />
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <PremiumKpiCard icon={Eye} label="Impressões" value={totalImpressions > 10000 ? (totalImpressions / 1000).toFixed(1) + 'k' : totalImpressions.toLocaleString('pt-BR')} colorClass="text-sky-500" delta={calcDelta(totalImpressions, prevImpressions)} />
                        <PremiumKpiCard icon={TrendingUp} label="Frequência" value={avgFrequency.toFixed(2)} colorClass="text-rose-500" delta={calcDelta(avgFrequency, prevFrequency)} invertDelta={true} />
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Funnel Box */}
                <Card className="col-span-1 border-primary/20 bg-card rounded-2xl shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-3">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Funil de Tração</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <AdsFunnelStep label="Impressões" value={totalImpressions} nextValue={totalClicks} icon={Eye} color="bg-blue-500/10 text-blue-500" />
                        <div className="ml-5 border-l-2 border-dashed border-border h-4" />
                        <AdsFunnelStep label="Cliques" value={totalClicks} nextValue={totalLeadsReais} icon={MousePointerClick} color="bg-emerald-500/10 text-emerald-500" />
                        <div className="ml-5 border-l-2 border-dashed border-border h-4" />
                        <AdsFunnelStep label="Leads (Msgs)" value={totalLeadsReais} nextValue={totalClientes > 0 ? totalClientes : undefined} icon={Target} color="bg-purple-500/10 text-purple-500" />
                        <div className="ml-5 border-l-2 border-dashed border-border h-4" />
                        <AdsFunnelStep label="Clientes Fechados" value={totalClientes} icon={Users} color="bg-amber-500/10 text-amber-500" />
                    </CardContent>
                </Card>

                {/* Main Graph */}
                <Card className="col-span-1 md:col-span-2 lg:col-span-2 rounded-2xl shadow-sm border-border">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Evolução de Performance Diária</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 h-full pb-6">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorInvest2" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs text-muted-foreground" tickFormatter={(v) => v.split('-').slice(1).reverse().join('/')} />

                                    <YAxis yAxisId="left" tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} axisLine={false} tickLine={false} className="text-xs text-muted-foreground" width={55} />
                                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}`} axisLine={false} tickLine={false} className="text-xs text-muted-foreground" width={40} />

                                    <Tooltip
                                        labelFormatter={(label) => label.split('-').reverse().join('/')}
                                        formatter={(v: number, name: string) => {
                                            if (name === 'investimento') return [`R$ ${v.toFixed(2)}`, 'Gasto'];
                                            if (name === 'cliques') return [v, 'Cliques'];
                                            return [v, name];
                                        }}
                                        labelClassName="text-foreground font-bold mb-2"
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Area yAxisId="left" type="monotone" dataKey="investimento" name="investimento" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#colorInvest2)" />

                                    {/* Adicionar linha para Cliques no eixo Y direito */}
                                    <Area yAxisId="right" type="monotone" dataKey="cliques" name="cliques" stroke="hsl(var(--primary))" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem insights diários para o período. Resincronize as campanhas.</div>
                        )}
                    </CardContent>
                </Card>

                {/* Demographics / Distribution Bento */}
                <div className="col-span-1 flex flex-col gap-4">
                    <Card className="rounded-2xl flex-1 shadow-sm border-border">
                        <CardHeader className="pb-0">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Gênero</CardTitle>
                        </CardHeader>
                        <CardContent className="h-full flex flex-col items-center justify-center pb-4">
                            <ResponsiveContainer width="100%" height={100}>
                                <PieChart>
                                    <Pie data={genderPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" stroke="none">
                                        {genderPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => [`${((value / (totalM + totalF)) * 100).toFixed(1)}%`, '']} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', fontSize: '12px', border: 'none' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-4 mt-1">
                                <span className="text-[10px] flex items-center gap-1 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-primary" /> Mulheres</span>
                                <span className="text-[10px] flex items-center gap-1 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-chart-2" /> Homens</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl flex-1 shadow-sm border-border">
                        <CardHeader className="pb-0">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Idade e Gênero</CardTitle>
                        </CardHeader>
                        <CardContent className="h-full flex flex-col justify-center pb-4 pt-2">
                            <ResponsiveContainer width="100%" height={110}>
                                <BarChart data={mockDemographics}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                                    <XAxis dataKey="age" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', fontSize: '12px' }} />
                                    <Bar dataKey="F" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="M" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export function BentoAdvancedMetric({ icon: Icon, label, value, color, bgColor, borderColor }: { icon: any; label: string; value: number | string; color: string; bgColor: string; borderColor: string; }) {
    return (
        <Card className={`border ${borderColor} bg-background/50 hover:bg-background/80 transition-colors`}>
            <CardContent className="p-4 flex flex-col justify-center h-full">
                <div className={`p-2 w-8 h-8 rounded-lg ${bgColor} mb-3 flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <h4 className="text-xl md:text-2xl font-black">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</h4>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-semibold">{label}</p>
            </CardContent>
        </Card>
    );
}
