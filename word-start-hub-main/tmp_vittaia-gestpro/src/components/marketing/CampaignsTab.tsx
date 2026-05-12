import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ChevronDown, ChevronUp, AlertTriangle, Image as ImageIcon,
    MessageCircle, Users, Eye, MousePointerClick, PlayCircle, BarChart3, TrendingUp, Target, DollarSign
} from "lucide-react";
import type { Campaign } from "./MarketingComponents";
import type { DateRange } from "./DateRangePicker";
import { CampaignLeadsDialog } from "./MarketingComponents";

export function CampaignsTab({ campaigns, platformFilter, targetCpl, targetRoas, targetCpc, targetCtr, targetCpm, dateRange }: {
    campaigns: Campaign[]; platformFilter?: string;
    targetCpl?: number | null; targetRoas?: number | null;
    targetCpc?: number | null; targetCtr?: number | null; targetCpm?: number | null;
    dateRange?: DateRange;
}) {
    const filtered = platformFilter ? campaigns.filter(c => c.platform === platformFilter) : campaigns;
    if (filtered.length === 0) return (
        <Card className="border-dashed mt-4 bg-transparent border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Target className="w-10 h-10 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-foreground mb-1">Sem dados de Campanhas</h3>
            </CardContent>
        </Card>
    );

    const isFiltered = platformFilter && platformFilter !== 'all' && platformFilter !== 'meta_ads';
    const accountTotal = !isFiltered ? campaigns.find(c => c.raw_data?.is_account_total) : null;
    const regularFiltered = filtered.filter(c => !c.raw_data?.is_account_total);
    const metaFiltered = regularFiltered.filter(c => c.platform === 'meta_ads');
    const googleFiltered = regularFiltered.filter(c => c.platform === 'google_ads');

    const isMessageObj = (c: Campaign) => c.raw_data?.objective === 'MESSAGES' || c.raw_data?.objective === 'OUTCOME_ENGAGEMENT' || c.campaign_name.includes('[MSGS]');

    const spend = (accountTotal ? (accountTotal.spend || 0) : metaFiltered.reduce((acc, c) => acc + (c.spend || 0), 0)) + googleFiltered.reduce((acc, c) => acc + (c.spend || 0), 0);
    const impressions = (accountTotal ? (accountTotal.impressions || 0) : metaFiltered.reduce((acc, c) => acc + (c.impressions || 0), 0)) + googleFiltered.reduce((acc, c) => acc + (c.impressions || 0), 0);
    const clicks = (accountTotal ? (accountTotal.clicks || 0) : metaFiltered.reduce((acc, c) => acc + (c.clicks || 0), 0)) + googleFiltered.reduce((acc, c) => acc + (c.clicks || 0), 0);
    const conversions = (accountTotal ? (accountTotal.conversions || 0) : metaFiltered.reduce((acc, c) => acc + (c.raw_data?.conversions || c.conversions || 0), 0)) + googleFiltered.reduce((acc, c) => acc + (c.raw_data?.conversions || c.conversions || 0), 0);
    const totalRevenue = regularFiltered.reduce((acc, c) => acc + ((c.spend || 0) * (c.roas || 0)), 0);

    const totalMessages = metaFiltered.filter(isMessageObj).reduce((acc, c) => acc + (c.conversions || 0), 0) + googleFiltered.reduce((acc, c) => acc + (c.conversions || 0), 0);
    const totalLeads = metaFiltered.filter(c => !isMessageObj(c)).reduce((acc, c) => acc + (c.conversions || 0), 0);
    const totalVideoViews = (accountTotal ? (accountTotal.raw_data?.video_views || 0) : metaFiltered.reduce((acc, c) => acc + (c.raw_data?.video_views || 0), 0));
    const totalLinkClicks = (accountTotal ? (accountTotal.raw_data?.link_clicks || 0) : metaFiltered.reduce((acc, c) => acc + (c.raw_data?.link_clicks || 0), 0)) + googleFiltered.reduce((acc, c) => acc + (c.raw_data?.link_clicks || 0), 0);

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpl = totalMessages > 0 ? spend / totalMessages : (conversions > 0 ? spend / conversions : 0);
    const roas = spend > 0 ? totalRevenue / spend : 0;

    const getPrev = (c: Campaign, field: string) => Number(c.raw_data?.previous_period?.[field] || 0);

    const prevSpend = (accountTotal ? getPrev(accountTotal, 'spend') : metaFiltered.reduce((acc, c) => acc + getPrev(c, 'spend'), 0)) + googleFiltered.reduce((acc, c) => acc + getPrev(c, 'spend'), 0);
    const prevImpressions = (accountTotal ? getPrev(accountTotal, 'impressions') : metaFiltered.reduce((acc, c) => acc + getPrev(c, 'impressions'), 0)) + googleFiltered.reduce((acc, c) => acc + getPrev(c, 'impressions'), 0);
    const prevClicks = (accountTotal ? getPrev(accountTotal, 'clicks') : metaFiltered.reduce((acc, c) => acc + getPrev(c, 'clicks'), 0)) + googleFiltered.reduce((acc, c) => acc + getPrev(c, 'clicks'), 0);
    const prevConversions = (accountTotal ? getPrev(accountTotal, 'conversions') : metaFiltered.reduce((acc, c) => acc + getPrev(c, 'conversions'), 0)) + googleFiltered.reduce((acc, c) => acc + getPrev(c, 'conversions'), 0);
    const prevMessages = metaFiltered.filter(isMessageObj).reduce((acc, c) => acc + getPrev(c, 'conversions'), 0) + googleFiltered.reduce((acc, c) => acc + getPrev(c, 'conversions'), 0);
    const prevLeads = metaFiltered.filter(c => !isMessageObj(c)).reduce((acc, c) => acc + getPrev(c, 'conversions'), 0);
    const prevVideoViews = (accountTotal ? getPrev(accountTotal, 'video_views') : metaFiltered.reduce((acc, c) => acc + getPrev(c, 'video_views'), 0));
    const prevLinkClicks = (accountTotal ? getPrev(accountTotal, 'link_clicks') : metaFiltered.reduce((acc, c) => acc + getPrev(c, 'link_clicks'), 0)) + googleFiltered.reduce((acc, c) => acc + getPrev(c, 'link_clicks'), 0);

    const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
    const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;
    const prevCpl = prevMessages > 0 ? prevSpend / prevMessages : (prevConversions > 0 ? prevSpend / prevConversions : 0);

    const calcDelta = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : null;

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
        <div className="space-y-6 mt-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                {/* Hero / Financials */}
                <div className="xl:col-span-1 rounded-2xl border border-zinc-200/60 dark:border-white/5 bg-white dark:bg-zinc-950 p-6 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <DollarSign className="w-24 h-24 text-zinc-900 dark:text-white" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Investimento Total</p>
                    <div className="flex items-center gap-3 mb-6 mt-2 flex-wrap">
                        <h3 className="text-3xl xl:text-4xl font-black tracking-tight">
                            R$ {spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                        {(() => {
                            const d = calcDelta(spend, prevSpend);
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

                {/* Conversion Cluster (col-span-1) */}
                <div className="xl:col-span-1 grid grid-cols-1 gap-4">
                    <PremiumKpiCard icon={MessageCircle} label="Leads (Msgs)" value={totalMessages.toLocaleString('pt-BR')} colorClass="text-emerald-600 dark:text-emerald-400" delta={calcDelta(totalMessages, prevMessages)} />
                    <PremiumKpiCard icon={Users} label="Formulários (Leads)" value={totalLeads.toLocaleString('pt-BR')} colorClass="text-blue-500" delta={calcDelta(totalLeads, prevLeads)} />
                </div>

                {/* Traffic Cluster (col-span-1) */}
                <div className="xl:col-span-1 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <PremiumKpiCard icon={MousePointerClick} label="Cliques no Site" value={totalLinkClicks.toLocaleString('pt-BR')} colorClass="text-indigo-500" delta={calcDelta(totalLinkClicks, prevLinkClicks)} />
                    </div>
                    <PremiumKpiCard icon={MousePointerClick} label="Cliques (Todos)" value={clicks.toLocaleString('pt-BR')} colorClass="text-zinc-500" delta={calcDelta(clicks, prevClicks)} />
                    <PremiumKpiCard icon={PlayCircle} label="Views Vídeo" value={totalVideoViews.toLocaleString('pt-BR')} colorClass="text-purple-500" delta={calcDelta(totalVideoViews, prevVideoViews)} />
                </div>

                {/* Health & Volume Cluster (col-span-1) */}
                <div className="xl:col-span-1 grid grid-cols-2 gap-4">
                    <PremiumKpiCard icon={BarChart3} label="CTR Médio" value={`${ctr.toFixed(2)}%`} colorClass="text-zinc-500" delta={calcDelta(ctr, prevCtr)} />
                    <PremiumKpiCard icon={TrendingUp} label="CPC Médio" value={`R$ ${cpc.toFixed(2)}`} colorClass="text-zinc-500" delta={calcDelta(cpc, prevCpc)} invertDelta={true} />
                    <div className="col-span-2">
                        <PremiumKpiCard icon={Eye} label="Impressões Totais" value={impressions > 10000 ? (impressions / 1000).toFixed(1) + 'k' : impressions.toLocaleString('pt-BR')} colorClass="text-sky-500" delta={calcDelta(impressions, prevImpressions)} />
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mb-2 mt-4 px-1">
                <h3 className="text-base font-bold flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Detalhamento Cross-Platform
                </h3>
            </div>

            <div className="space-y-4">
                {filtered.map(c => <CampaignRow key={c.id} campaign={c} targetCpl={targetCpl} targetRoas={targetRoas} targetCpc={targetCpc} targetCtr={targetCtr} targetCpm={targetCpm} dateRange={dateRange} />)}
            </div>
        </div>
    );
}

function PremiumKpiCard({ icon: Icon, label, value, colorClass }: { icon: any; label: string; value: number | string; colorClass?: string; }) {
    return (
        <div className="group relative overflow-hidden rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-4 h-full flex flex-col justify-between relative z-10 gap-3">
                <div className="flex items-center gap-2.5">
                    {Icon && <Icon className={`w-4 h-4 ${colorClass || 'text-zinc-500'}`} />}
                    <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider line-clamp-1">{label}</p>
                </div>
                <h4 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{value}</h4>
            </div>
        </div>
    );
}


function CampaignRow({ campaign, targetCpl, targetRoas, targetCpc, targetCtr, targetCpm, dateRange }: any) {
    const [expanded, setExpanded] = useState(false);
    const [leadsOpen, setLeadsOpen] = useState(false);
    const statusColor = campaign.status === 'ACTIVE' ? 'bg-emerald-500' : campaign.status === 'PAUSED' ? 'bg-amber-500' : 'bg-muted-foreground';

    const isAccountTotal = campaign.raw_data?.is_account_total;
    const trueLeads = campaign.raw_data?.leads || 0;
    const totalConversions = campaign.conversions || 0;
    const messages = campaign.raw_data?.messages_started || 0;
    const videoViews = campaign.raw_data?.video_views || 0;
    const spend = campaign.spend || 0;

    const baseForCpl = isAccountTotal ? trueLeads : totalConversions;
    const cplValue = baseForCpl > 0 ? spend / baseForCpl : 0;
    const cpmMsgValue = messages > 0 ? spend / messages : 0;

    const cpaAlert = !isAccountTotal && targetCpl && cplValue > targetCpl;
    const cpcAlert = !isAccountTotal && targetCpc && (campaign.cpc || 0) > targetCpc;
    const ctrValue = campaign.ctr || 0;
    const ctrAlert = !isAccountTotal && targetCtr && ctrValue > 0 && ctrValue < targetCtr;
    const hasAlert = cpaAlert || cpcAlert || ctrAlert;

    const isMessageObj = campaign.raw_data?.objective?.includes('MESSAGE') || campaign.campaign_name?.toUpperCase().includes('MSG');
    const adsets: any[] = campaign.raw_data?.adsets || [];

    // Configura o layout do grid condicionalmente (10 colunas p/ mensagens, 12 p/ site)
    const gridColsClass = isMessageObj
        ? "grid-cols-3 sm:grid-cols-5 xl:grid-cols-10"
        : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12";

    return (
        <Card className={`${isAccountTotal ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-md ring-1 ring-primary/30' : (hasAlert && !expanded ? 'border-red-500/50' : 'border-border/60')} shadow-sm transition-all overflow-hidden`}>
            <CardContent className="p-0">
                <div
                    className={`p-5 flex flex-col ${adsets.length > 0 && !isAccountTotal ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
                    onClick={() => adsets.length > 0 && !isAccountTotal && setExpanded(!expanded)}
                >
                    {/* Linha Superior: Nome, Badges, Header e Ações */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            {!isAccountTotal && <div className={`w-2 h-12 rounded-full ${statusColor} shrink-0`} />}
                            {isAccountTotal && <DollarSign className="w-8 h-8 text-primary shrink-0 opacity-70" />}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <p className={`font-bold text-sm truncate ${isAccountTotal ? 'text-primary uppercase tracking-tight' : 'text-foreground'}`}>{campaign.campaign_name || 'Sem nome'}</p>
                                    {!isAccountTotal && <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{campaign.status}</Badge>}
                                    {isAccountTotal && <Badge variant="default" className="text-[9px] uppercase tracking-wider bg-primary/20 text-primary hover:bg-primary/20 border-none">Total da Conta</Badge>}
                                    {hasAlert && <Badge variant="destructive" className="text-[9px] h-4"><AlertTriangle className="w-3 h-3 mr-1" /> Requer Atenção</Badge>}
                                </div>
                                <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-medium flex-wrap">
                                    <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-blue-500" /> {trueLeads} Leads</span>
                                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> {messages.toLocaleString()} Msgs</span>
                                    <span className="flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5 text-purple-500" /> {videoViews.toLocaleString()} Views</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto ml-auto md:ml-0">
                            <Button variant="secondary" size="sm" className="h-8 text-[11px] gap-1.5 shadow-sm" onClick={(e) => { e.stopPropagation(); setLeadsOpen(true); }}>
                                <Users className="h-3.5 w-3.5" /> Leads (CRM)
                            </Button>
                            {adsets.length > 0 && (
                                <div className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors shadow-sm">
                                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Linha Inferior: Grid Completo de Métricas */}
                    <div className={`grid ${gridColsClass} gap-x-2 gap-y-5 pt-5 mt-4 border-t border-border/50`}>
                        <MiniStat label="Alcance" value={campaign.raw_data?.reach?.toLocaleString() || '0'} />
                        <MiniStat label="Frequência" value={(campaign.raw_data?.frequency || 0).toFixed(2)} />
                        <MiniStat label="Imp" value={campaign.impressions?.toLocaleString() || '0'} />
                        <MiniStat label="Clq Todos" value={campaign.clicks?.toLocaleString() || '0'} />
                        <MiniStat label="Clq Link" value={campaign.raw_data?.link_clicks?.toLocaleString() || '0'} />
                        {!isMessageObj && <MiniStat label="Clq Saída" value={campaign.raw_data?.outbound_clicks?.toLocaleString() || '0'} />}
                        {!isMessageObj && <MiniStat label="Vis. Pág" value={campaign.raw_data?.landing_page_views?.toLocaleString() || '0'} />}
                        <MiniStat label="CTR" value={`${ctrValue.toFixed(2)}%`} className={ctrAlert ? 'text-red-500 font-bold' : ''} />
                        <MiniStat label="CPC" value={`R$ ${(campaign.cpc || 0).toFixed(2)}`} className={cpcAlert ? 'text-red-500 font-bold' : ''} />
                        <MiniStat label="Gasto" value={`R$ ${spend.toFixed(2)}`} />
                        <MiniStat label="Custo/Lead" value={`R$ ${cplValue.toFixed(2)}`} className={cpaAlert ? 'text-red-500 font-bold' : ''} />
                        <MiniStat label="Custo/Msg" value={`R$ ${cpmMsgValue.toFixed(2)}`} />
                    </div>
                </div>

                {expanded && adsets.length > 0 && (
                    <div className="bg-muted/10 border-t border-border/40 p-4 lg:p-6 space-y-5 shadow-inner">
                        {adsets.map((adset: any) => (
                            <AdsetRow key={adset.adset_id} adset={adset} ads={campaign.raw_data?.ads?.filter((ad: any) => ad.adset_id === adset.adset_id) || []} targetCpl={targetCpl} targetCpc={targetCpc} targetCtr={targetCtr} targetCpm={targetCpm} isMessageObj={isMessageObj} />
                        ))}
                    </div>
                )}
            </CardContent>
            <CampaignLeadsDialog open={leadsOpen} onOpenChange={setLeadsOpen} campaignId={campaign.campaign_id} campaignName={campaign.campaign_name} dateRange={dateRange} />
        </Card>
    );
}

function AdsetRow({ adset, ads, targetCpl, targetCpc, targetCtr, targetCpm, isMessageObj }: any) {
    const [expanded, setExpanded] = useState(false);
    const messages = adset.messages_started || 0;
    const leads = adset.conversions || 0;
    const spend = adset.spend || 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const cpmMsg = messages > 0 ? spend / messages : 0;

    const gridColsClass = isMessageObj
        ? "grid-cols-3 sm:grid-cols-5 xl:grid-cols-10"
        : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12";

    return (
        <div className="pl-4 md:pl-6 border-l-[3px] border-primary/20 space-y-4 relative group">
            <div className="absolute w-4 border-b-[3px] border-primary/20 left-0 top-6" />
            <div
                className={`flex flex-col shadow-sm bg-background border border-border/60 p-5 rounded-xl transition-all ${ads.length > 0 ? 'cursor-pointer hover:border-primary/40 hover:shadow-md' : ''}`}
                onClick={() => ads.length > 0 && setExpanded(!expanded)}
            >
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 w-full">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                            {ads.length > 0 && (expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />)}
                            Conjunto: {adset.adset_name}
                        </p>
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground ml-[26px] flex-wrap">
                            <span className="flex items-center gap-1 font-semibold"><Target className="w-3.5 h-3.5" /> {leads} Leads</span>
                            <span className="flex items-center gap-1 font-semibold"><MessageCircle className="w-3.5 h-3.5" /> {messages} Msgs</span>
                            <span className="flex items-center gap-1 font-semibold"><PlayCircle className="w-3.5 h-3.5" /> {adset.video_views || 0} Views</span>
                        </div>
                    </div>
                </div>

                <div className={`grid ${gridColsClass} gap-x-2 gap-y-4 pt-4 mt-3 border-t border-border/40`}>
                    <MiniStat label="Alcance" value={adset.reach?.toLocaleString() || '0'} />
                    <MiniStat label="Frequência" value={(adset.frequency || 0).toFixed(2)} />
                    <MiniStat label="Imp" value={adset.impressions?.toLocaleString() || '0'} />
                    <MiniStat label="Clq Todos" value={adset.clicks?.toLocaleString() || '0'} />
                    <MiniStat label="Clq Link" value={adset.link_clicks?.toLocaleString() || '0'} />
                    {!isMessageObj && <MiniStat label="Clq Saída" value={adset.outbound_clicks?.toLocaleString() || '0'} />}
                    {!isMessageObj && <MiniStat label="Vis. Pág" value={adset.landing_page_views?.toLocaleString() || '0'} />}
                    <MiniStat label="CTR" value={`${(adset.ctr || 0).toFixed(2)}%`} />
                    <MiniStat label="CPC" value={`R$ ${(adset.cpc || 0).toFixed(2)}`} />
                    <MiniStat label="Gasto" value={`R$ ${spend.toFixed(2)}`} />
                    <MiniStat label="Custo/Lead" value={`R$ ${cpl.toFixed(2)}`} />
                    <MiniStat label="Custo/Msg" value={`R$ ${cpmMsg.toFixed(2)}`} />
                </div>
            </div>

            {expanded && ads.length > 0 && (
                <div className="pl-6 md:pl-10 space-y-3 mt-3 pb-2 relative">
                    <div className="absolute w-4 border-b-[3px] border-border/30 left-0 top-6" />
                    {ads.map((ad: any) => {
                        const adLeads = ad.conversions || 0;
                        const adSpend = ad.spend || 0;
                        const adMsgs = ad.messages_started || 0;
                        const adCpl = adLeads > 0 ? adSpend / adLeads : 0;
                        const adCpmMsg = adMsgs > 0 ? adSpend / adMsgs : 0;

                        return (
                            <div key={ad.ad_id} className="flex flex-col p-4 rounded-xl border border-border bg-background shadow-sm hover:shadow-md transition-all gap-4">
                                <div className="flex items-center gap-4 w-full">
                                    {ad.thumbnail_url ? (
                                        <img src={ad.thumbnail_url} alt="" className="w-[42px] h-[42px] rounded-lg object-cover border border-border/60 shrink-0" />
                                    ) : (
                                        <div className="w-[42px] h-[42px] rounded-lg bg-muted flex items-center justify-center shrink-0">
                                            <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-bold text-foreground truncate" title={ad.ad_name}>{ad.ad_name}</p>
                                        <div className="flex items-center gap-4 text-[9px] text-muted-foreground mt-1.5 uppercase font-semibold flex-wrap tracking-wider">
                                            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {adLeads} Leads</span>
                                            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {adMsgs} Msgs</span>
                                            <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" /> {ad.video_views || 0} Vi.</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={`grid ${gridColsClass} gap-x-2 gap-y-4 pt-4 border-t border-border/40`}>
                                    <MiniStat label="Alcance" value={ad.reach?.toLocaleString() || '0'} />
                                    <MiniStat label="Frequência" value={(ad.frequency || 0).toFixed(2)} />
                                    <MiniStat label="Imp" value={ad.impressions?.toLocaleString() || '0'} />
                                    <MiniStat label="Clq Todos" value={ad.clicks?.toLocaleString() || '0'} />
                                    <MiniStat label="Clq Link" value={ad.link_clicks?.toLocaleString() || '0'} />
                                    {!isMessageObj && <MiniStat label="Clq Saída" value={ad.outbound_clicks?.toLocaleString() || '0'} />}
                                    {!isMessageObj && <MiniStat label="Vis. Pág" value={ad.landing_page_views?.toLocaleString() || '0'} />}
                                    <MiniStat label="CTR" value={`${(ad.ctr || 0).toFixed(2)}%`} />
                                    <MiniStat label="CPC" value={`R$ ${(ad.cpc || 0).toFixed(2)}`} />
                                    <MiniStat label="Gasto" value={`R$ ${adSpend.toFixed(2)}`} />
                                    <MiniStat label="Custo/Lead" value={`R$ ${adCpl.toFixed(2)}`} />
                                    <MiniStat label="Custo/Msg" value={`R$ ${adCpmMsg.toFixed(2)}`} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className="flex flex-col items-center justify-center text-center">
            <p className={`text-[12px] font-black tracking-tight ${className || 'text-foreground'}`}>{value}</p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5">{label}</p>
        </div>
    );
}
