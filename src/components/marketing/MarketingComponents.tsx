'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import {
    Eye, MousePointerClick, DollarSign, Target, TrendingUp,
    Instagram, Facebook, ThumbsUp, MessageCircle, Heart, Image as ImageIcon,
    Users, ArrowDownRight, ChevronDown, ChevronRight, Layers, FileText, Radio, Crosshair
} from "lucide-react";

// ====================================================================
// TYPES
// ====================================================================

export interface Campaign {
    id: string;
    platform: string;
    campaignId: string;
    campaignName: string | null;
    status: string | null;
    objective: string | null;
    impressions: number;
    clicks: number;
    spend: string;
    conversions: number;
    ctr: string;
    cpc: string;
    cpm: string;
    roas: string;
    reach: number | null;
    frequency: string | null;
    costPerLead: string | null;
    rawData?: any;
}

export interface AdSet {
    id: string;
    platform: string;
    campaignId: string;
    adsetId: string;
    adsetName: string | null;
    status: string | null;
    dailyBudget: string | null;
    lifetimeBudget: string | null;
    optimizationGoal: string | null;
    impressions: number;
    clicks: number;
    spend: string;
    conversions: number;
    ctr: string;
    cpc: string;
    cpm: string;
    reach: number | null;
    frequency: string | null;
    costPerLead: string | null;
    rawData?: any;
}

export interface Ad {
    id: string;
    platform: string;
    adsetId: string;
    campaignId: string;
    adId: string;
    adName: string | null;
    status: string | null;
    impressions: number;
    clicks: number;
    spend: string;
    conversions: number;
    ctr: string;
    cpc: string;
    cpm: string;
    reach: number | null;
    frequency: string | null;
    costPerLead: string | null;
    creativeThumbnailUrl: string | null;
    creativeBody: string | null;
    creativeTitle: string | null;
    rawData?: any;
}

export interface SocialProfile {
    platform: string;
    profileName: string | null;
    profilePictureUrl: string | null;
    followersCount: number | null;
    followsCount: number | null;
    postsCount: number | null;
    pageLikes: number | null;
    pageReach: number | null;
    engagementRate: string | null;
    recentPosts: any[];
    rawData?: any;
    syncedAt: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// ====================================================================
// HELPER: Safe Number converter (DB retorna strings para numeric)
// ====================================================================
const N = (v: any): number => Number(v || 0);

// ====================================================================
// KPI Card
// ====================================================================
export function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{value}</p>
            </CardContent>
        </Card>
    );
}

// ====================================================================
// Funnel Step
// ====================================================================
export function AdsFunnelStep({ label, value, nextValue, icon: Icon, color }: {
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

// ====================================================================
// OVERVIEW TAB
// ====================================================================
export function OverviewTab({ campaigns, profiles }: { campaigns: Campaign[]; profiles: SocialProfile[] }) {
    const metaCampaigns = campaigns.filter(c => c.platform === 'meta_ads');
    const googleCampaigns = campaigns.filter(c => c.platform === 'google_ads');
    const allCampaigns = [...metaCampaigns, ...googleCampaigns];

    const totalSpend = allCampaigns.reduce((s, c) => s + N(c.spend), 0);
    const totalClicks = allCampaigns.reduce((s, c) => s + N(c.clicks), 0);
    const totalImpressions = allCampaigns.reduce((s, c) => s + N(c.impressions), 0);
    const totalConversions = allCampaigns.reduce((s, c) => s + N(c.conversions), 0);
    const totalReach = allCampaigns.reduce((s, c) => s + N(c.reach), 0);
    const avgFrequency = allCampaigns.length > 0 ? allCampaigns.reduce((s, c) => s + N(c.frequency), 0) / allCampaigns.length : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpl = totalConversions > 0 ? totalSpend / totalConversions : 0;

    const platformPieData = [
        { name: 'Meta Ads', value: metaCampaigns.reduce((s, c) => s + N(c.spend), 0) },
        { name: 'Google Ads', value: googleCampaigns.reduce((s, c) => s + N(c.spend), 0) },
    ].filter(d => d.value > 0);

    const campaignBarData = allCampaigns.slice(0, 8).map(c => ({
        name: (c.campaignName || 'Sem nome').substring(0, 20),
        Investimento: N(c.spend),
        Cliques: N(c.clicks),
        Conversões: N(c.conversions),
    }));

    const igProfile = profiles.find(p => p.platform === 'instagram');
    const fbProfile = profiles.find(p => p.platform === 'facebook');

    return (
        <div className="space-y-6 mt-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <KpiCard icon={DollarSign} label="Investimento" value={`R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-amber-500" />
                <KpiCard icon={Eye} label="Impressões" value={totalImpressions.toLocaleString('pt-BR')} color="text-blue-500" />
                <KpiCard icon={Users} label="Alcance" value={totalReach.toLocaleString('pt-BR')} color="text-indigo-500" />
                <KpiCard icon={MousePointerClick} label="Cliques" value={totalClicks.toLocaleString('pt-BR')} color="text-emerald-500" />
                <KpiCard icon={Target} label="Conversões" value={totalConversions.toLocaleString('pt-BR')} color="text-purple-500" />
                <KpiCard icon={TrendingUp} label="CTR" value={`${avgCtr.toFixed(2)}%`} color="text-cyan-500" />
                <KpiCard icon={DollarSign} label="CPC" value={`R$ ${avgCpc.toFixed(2)}`} color="text-rose-500" />
                <KpiCard icon={Crosshair} label="CPL" value={totalConversions > 0 ? `R$ ${avgCpl.toFixed(2)}` : '-'} color="text-orange-500" />
            </div>

            {/* Funnel + Charts */}
            <div className="grid md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Funil de Anúncios</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <AdsFunnelStep label="Impressões" value={totalImpressions} nextValue={totalClicks} icon={Eye} color="bg-blue-500/10 text-blue-500" />
                        <div className="ml-5 border-l-2 border-dashed border-border h-3" />
                        <AdsFunnelStep label="Cliques" value={totalClicks} nextValue={totalConversions} icon={MousePointerClick} color="bg-emerald-500/10 text-emerald-500" />
                        <div className="ml-5 border-l-2 border-dashed border-border h-3" />
                        <AdsFunnelStep label="Conversões" value={totalConversions} icon={Target} color="bg-purple-500/10 text-purple-500" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Investimento por Plataforma</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {platformPieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={platformPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {platformPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Performance por Campanha</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {campaignBarData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={campaignBarData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="Investimento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Conversões" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Social profiles summary */}
            <div className="grid md:grid-cols-2 gap-4">
                {igProfile && <SocialCard profile={igProfile} icon={Instagram} color="text-pink-500" />}
                {fbProfile && <SocialCard profile={fbProfile} icon={Facebook} color="text-blue-600" />}
            </div>
        </div>
    );
}

// ====================================================================
// CAMPAIGNS TAB — Drill-down: Campaign → AdSets → Ads
// ====================================================================
export function CampaignsTab({ campaigns, adsets, ads, platformFilter }: {
    campaigns: Campaign[];
    adsets: AdSet[];
    ads: Ad[];
    platformFilter?: string;
}) {
    const filtered = platformFilter ? campaigns.filter(c => c.platform === platformFilter) : campaigns;
    if (filtered.length === 0) return <EmptyData label={platformFilter === 'google_ads' ? 'Google Ads' : 'Meta Ads'} />;

    return (
        <div className="space-y-3 mt-4">
            {filtered.map(c => (
                <CampaignAccordion
                    key={c.id}
                    campaign={c}
                    adsets={adsets.filter(as => as.campaignId === c.campaignId)}
                    ads={ads}
                />
            ))}
        </div>
    );
}

// ─── Campaign Accordion ─────────────────────────────────────────
function CampaignAccordion({ campaign, adsets, ads }: { campaign: Campaign; adsets: AdSet[]; ads: Ad[] }) {
    const [open, setOpen] = useState(false);
    const statusColor = campaign.status === 'ACTIVE' ? 'bg-emerald-500' : campaign.status === 'PAUSED' ? 'bg-amber-500' : 'bg-muted-foreground';
    const hasChildren = adsets.length > 0;

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                {/* Campaign header */}
                <button
                    onClick={() => setOpen(!open)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                >
                    <div className="shrink-0">
                        {hasChildren ? (
                            open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        ) : (
                            <div className="w-4 h-4" />
                        )}
                    </div>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{campaign.campaignName || 'Sem nome'}</p>
                        {campaign.objective && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Objetivo: {campaign.objective}</p>
                        )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{campaign.status}</Badge>
                </button>

                {/* Campaign KPIs */}
                <div className="px-4 pb-3">
                    <div className="grid grid-cols-3 md:grid-cols-8 gap-2 text-center">
                        <MiniStat label="Investimento" value={`R$ ${N(campaign.spend).toFixed(2)}`} />
                        <MiniStat label="Impressões" value={N(campaign.impressions).toLocaleString()} />
                        <MiniStat label="Alcance" value={N(campaign.reach).toLocaleString()} />
                        <MiniStat label="Cliques" value={N(campaign.clicks).toLocaleString()} />
                        <MiniStat label="CTR" value={`${N(campaign.ctr).toFixed(2)}%`} />
                        <MiniStat label="CPC" value={`R$ ${N(campaign.cpc).toFixed(2)}`} />
                        <MiniStat label="Conversões" value={N(campaign.conversions).toLocaleString()} />
                        <MiniStat label="CPL" value={campaign.costPerLead ? `R$ ${N(campaign.costPerLead).toFixed(2)}` : '-'} />
                    </div>
                </div>

                {/* AdSets (expandido) */}
                {open && hasChildren && (
                    <div className="border-t bg-muted/10">
                        {adsets.map(as => (
                            <AdSetAccordion
                                key={as.id}
                                adset={as}
                                ads={ads.filter(a => a.adsetId === as.adsetId)}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── AdSet Accordion ────────────────────────────────────────────
function AdSetAccordion({ adset, ads }: { adset: AdSet; ads: Ad[] }) {
    const [open, setOpen] = useState(false);
    const statusColor = adset.status === 'ACTIVE' ? 'text-emerald-500' : adset.status === 'PAUSED' ? 'text-amber-500' : 'text-muted-foreground';
    const hasAds = ads.length > 0;

    const budget = adset.dailyBudget ? `R$ ${N(adset.dailyBudget).toFixed(2)}/dia` :
        adset.lifetimeBudget ? `R$ ${N(adset.lifetimeBudget).toFixed(2)} total` : null;

    return (
        <div className="border-b last:border-b-0">
            {/* AdSet header */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left pl-10"
            >
                <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div className="shrink-0">
                    {hasAds ? (
                        open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                        <div className="w-3.5 h-3.5" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{adset.adsetName || 'Sem nome'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-medium ${statusColor}`}>{adset.status}</span>
                        {budget && <span className="text-[10px] text-muted-foreground">· {budget}</span>}
                        {adset.optimizationGoal && <span className="text-[10px] text-muted-foreground">· {adset.optimizationGoal}</span>}
                    </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                    R$ {N(adset.spend).toFixed(2)} · {N(adset.clicks)} cliques · {adset.conversions} conv.
                </span>
            </button>

            {/* AdSet KPIs (inline) */}
            <div className="px-4 pb-2 pl-16">
                <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 text-center">
                    <MiniStat label="Invest." value={`R$ ${N(adset.spend).toFixed(2)}`} small />
                    <MiniStat label="Impr." value={N(adset.impressions).toLocaleString()} small />
                    <MiniStat label="Alcance" value={N(adset.reach).toLocaleString()} small />
                    <MiniStat label="Cliques" value={N(adset.clicks).toLocaleString()} small />
                    <MiniStat label="CTR" value={`${N(adset.ctr).toFixed(2)}%`} small />
                    <MiniStat label="CPC" value={`R$ ${N(adset.cpc).toFixed(2)}`} small />
                    <MiniStat label="Conv." value={N(adset.conversions).toLocaleString()} small />
                    <MiniStat label="CPL" value={adset.costPerLead ? `R$ ${N(adset.costPerLead).toFixed(2)}` : '-'} small />
                </div>
            </div>

            {/* Ads list */}
            {open && hasAds && (
                <div className="bg-muted/5">
                    {ads.map(ad => <AdRow key={ad.id} ad={ad} />)}
                </div>
            )}
        </div>
    );
}

// ─── Ad Row ─────────────────────────────────────────────────────
function AdRow({ ad }: { ad: Ad }) {
    const statusColor = ad.status === 'ACTIVE' ? 'text-emerald-500' : ad.status === 'PAUSED' ? 'text-amber-500' : 'text-muted-foreground';

    return (
        <div className="px-4 py-2.5 pl-20 border-b last:border-b-0 flex items-start gap-3">
            {/* Creative thumbnail */}
            {ad.creativeThumbnailUrl ? (
                <img src={ad.creativeThumbnailUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0 border" />
            ) : (
                <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center shrink-0 border">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <Radio className="w-3 h-3 text-purple-400 shrink-0" />
                    <p className="text-xs font-medium text-foreground truncate">{ad.adName || 'Sem nome'}</p>
                    <span className={`text-[10px] font-medium ${statusColor}`}>{ad.status}</span>
                </div>
                {ad.creativeTitle && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">"{ad.creativeTitle}"</p>}

                <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 text-center mt-1.5">
                    <MiniStat label="Invest." value={`R$ ${N(ad.spend).toFixed(2)}`} small />
                    <MiniStat label="Impr." value={N(ad.impressions).toLocaleString()} small />
                    <MiniStat label="Alcance" value={N(ad.reach).toLocaleString()} small />
                    <MiniStat label="Cliques" value={N(ad.clicks).toLocaleString()} small />
                    <MiniStat label="CTR" value={`${N(ad.ctr).toFixed(2)}%`} small />
                    <MiniStat label="CPC" value={`R$ ${N(ad.cpc).toFixed(2)}`} small />
                    <MiniStat label="Conv." value={N(ad.conversions).toLocaleString()} small />
                    <MiniStat label="CPL" value={ad.costPerLead ? `R$ ${N(ad.costPerLead).toFixed(2)}` : '-'} small />
                </div>
            </div>
        </div>
    );
}

// ====================================================================
// SOCIAL INSIGHTS TAB
// ====================================================================
export function SocialInsightsTab({ profile, icon: Icon, label }: { profile: SocialProfile | undefined; icon: any; label: string }) {
    if (!profile) return <EmptyData label={label} />;

    const insightsTotals = profile.rawData?.insights_totals || {};
    const insightsDaily = profile.rawData?.insights_daily || {};
    const period = profile.rawData?.insights_period;

    const dailyData = Object.entries(insightsDaily)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, metrics]: [string, any]) => ({ date: date.substring(5), ...metrics }));

    const isFacebook = profile.platform === 'facebook';

    return (
        <div className="space-y-4 mt-4">
            {/* Profile header */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        {profile.profilePictureUrl ? (
                            <Avatar className="w-16 h-16">
                                <AvatarImage src={profile.profilePictureUrl} />
                                <AvatarFallback><Icon className="w-8 h-8" /></AvatarFallback>
                            </Avatar>
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <Icon className="w-8 h-8 text-muted-foreground" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-lg font-bold text-foreground">{profile.profileName}</h3>
                            <p className="text-xs text-muted-foreground">
                                Última sincronização: {profile.syncedAt ? new Date(profile.syncedAt).toLocaleString('pt-BR') : 'Nunca'}
                                {period && <span> · Período: {period.since} a {period.until}</span>}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatBox label="Seguidores" value={N(profile.followersCount)} />
                        <StatBox label={isFacebook ? 'Curtidas da Página' : 'Seguindo'} value={N(isFacebook ? profile.pageLikes : profile.followsCount)} />
                        <StatBox label={isFacebook ? 'Alcance (período)' : 'Posts'} value={N(isFacebook ? profile.pageReach : profile.postsCount)} />
                        <StatBox label="Engajamento" value={`${N(profile.engagementRate).toFixed(2)}%`} isText />
                    </div>
                </CardContent>
            </Card>

            {/* Insights KPIs */}
            {Object.keys(insightsTotals).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {isFacebook ? (
                        <>
                            <KpiCard icon={Eye} label="Impressões da Página" value={(insightsTotals.page_impressions || 0).toLocaleString('pt-BR')} color="text-blue-500" />
                            <KpiCard icon={Users} label="Alcance Único" value={(insightsTotals.page_impressions_unique || 0).toLocaleString('pt-BR')} color="text-indigo-500" />
                            <KpiCard icon={MousePointerClick} label="Usuários Engajados" value={(insightsTotals.page_engaged_users || 0).toLocaleString('pt-BR')} color="text-emerald-500" />
                            <KpiCard icon={Eye} label="Visualizações" value={(insightsTotals.page_views_total || 0).toLocaleString('pt-BR')} color="text-purple-500" />
                        </>
                    ) : (
                        <>
                            <KpiCard icon={Eye} label="Impressões" value={(insightsTotals.impressions || 0).toLocaleString('pt-BR')} color="text-blue-500" />
                            <KpiCard icon={Users} label="Alcance" value={(insightsTotals.reach || 0).toLocaleString('pt-BR')} color="text-indigo-500" />
                            <KpiCard icon={Eye} label="Visitas ao Perfil" value={(insightsTotals.profile_views || 0).toLocaleString('pt-BR')} color="text-emerald-500" />
                            <KpiCard icon={Users} label="Contas Alcançadas" value={(insightsTotals.accounts_engaged || 0).toLocaleString('pt-BR')} color="text-purple-500" />
                        </>
                    )}
                </div>
            )}

            {/* Daily timeline chart */}
            {dailyData.length > 0 && (
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Timeline Diária</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={dailyData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                {isFacebook ? (
                                    <>
                                        <Area type="monotone" dataKey="page_impressions_unique" name="Alcance" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                                        <Area type="monotone" dataKey="page_engaged_users" name="Engajados" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} />
                                    </>
                                ) : (
                                    <>
                                        <Area type="monotone" dataKey="reach" name="Alcance" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                                        <Area type="monotone" dataKey="impressions" name="Impressões" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} />
                                    </>
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Recent posts */}
            {profile.recentPosts?.length > 0 && (
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Posts Recentes</CardTitle></CardHeader>
                    <CardContent>
                        {isFacebook ? (
                            <div className="space-y-3">
                                {profile.recentPosts.slice(0, 10).map((post: any, i: number) => (
                                    <div key={i} className="flex gap-3 p-3 rounded-lg border bg-card">
                                        {post.full_picture && <img src={post.full_picture} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-foreground line-clamp-2">{post.message || 'Sem texto'}</p>
                                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.likes?.summary?.total_count || 0}</span>
                                                <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments?.summary?.total_count || 0}</span>
                                                {post.shares && <span>🔄 {post.shares.count || 0}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {profile.recentPosts.slice(0, 12).map((post: any, i: number) => (
                                    <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted/30">
                                        {post.media_url ? (
                                            <img src={post.media_url} alt="" className="w-full aspect-square object-cover" />
                                        ) : (
                                            <div className="w-full aspect-square flex items-center justify-center bg-muted">
                                                <ImageIcon className="w-8 h-8 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm">
                                            <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {post.like_count || 0}</span>
                                            <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> {post.comments_count || 0}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ====================================================================
// HELPERS
// ====================================================================

function SocialCard({ profile, icon: Icon, color }: { profile: SocialProfile; icon: any; color: string }) {
    const isFb = profile.platform === 'facebook';
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    {profile.profilePictureUrl ? (
                        <Avatar className="w-12 h-12">
                            <AvatarImage src={profile.profilePictureUrl} />
                            <AvatarFallback><Icon className={`w-6 h-6 ${color}`} /></AvatarFallback>
                        </Avatar>
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Icon className={`w-6 h-6 ${color}`} />
                        </div>
                    )}
                    <div className="flex-1">
                        <p className="font-semibold text-foreground text-sm">{profile.profileName || profile.platform}</p>
                        <p className="text-xs text-muted-foreground capitalize">{profile.platform}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{N(profile.followersCount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Seguidores</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{N(isFb ? profile.pageLikes : profile.postsCount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{isFb ? 'Curtidas' : 'Posts'}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{N(profile.engagementRate).toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Engajamento</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function StatBox({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
    return (
        <div className="p-3 rounded-lg bg-muted/30 border text-center">
            <p className="text-xl font-bold text-foreground">{isText ? value : (typeof value === 'number' ? value.toLocaleString('pt-BR') : value)}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}

function MiniStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
    return (
        <div>
            <p className={`font-semibold text-foreground ${small ? 'text-[10px]' : 'text-xs'}`}>{value}</p>
            <p className={`text-muted-foreground ${small ? 'text-[8px]' : 'text-[10px]'}`}>{label}</p>
        </div>
    );
}

function EmptyData({ label }: { label: string }) {
    return (
        <Card className="border-dashed mt-4">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Eye className="w-10 h-10 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-foreground mb-1">Sem dados de {label}</h3>
                <p className="text-xs text-muted-foreground">Sincronize para importar os dados mais recentes.</p>
            </CardContent>
        </Card>
    );
}
