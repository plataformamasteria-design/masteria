import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import {
    BarChart3, Eye, MousePointerClick, DollarSign, Target, TrendingUp,
    Instagram, Facebook, ThumbsUp, MessageCircle, Heart, Image,
    Users, ArrowDownRight, ChevronDown, ChevronUp, AlertTriangle, Play, LayoutList, Loader2, Phone, User as UserIcon
} from "lucide-react";
import AIInsightsWidget from "@/components/dashboard/AIInsightsWidget";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useEffect } from "react";
import type { DateRange } from "@/components/marketing/DateRangePicker";

// Shared types
export interface Campaign {
    id: string;
    platform: string;
    campaign_id: string;
    campaign_name: string;
    status: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
    roas: number;
    raw_data?: any;
}

export interface SocialProfile {
    platform: string;
    profile_name: string;
    profile_picture_url: string;
    followers_count: number;
    follows_count: number;
    posts_count: number;
    page_likes: number;
    page_reach: number;
    engagement_rate: number;
    recent_posts: any[];
    raw_data?: any;
    synced_at: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// ─── KPI Card ───────────────────────────────────────────────────
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

// ─── Funnel Step ────────────────────────────────────────────────
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

// ─── Overview Tab ───────────────────────────────────────────────
export function OverviewTab({ campaigns, profiles }: { campaigns: Campaign[]; profiles: SocialProfile[] }) {
    const metaCampaigns = campaigns.filter(c => c.platform === 'meta_ads');
    const googleCampaigns = campaigns.filter(c => c.platform === 'google_ads');
    const allCampaigns = [...metaCampaigns, ...googleCampaigns];

    const totalSpend = allCampaigns.reduce((s, c) => s + c.spend, 0);
    const totalClicks = allCampaigns.reduce((s, c) => s + c.clicks, 0);
    const totalImpressions = allCampaigns.reduce((s, c) => s + c.impressions, 0);
    const totalConversions = allCampaigns.reduce((s, c) => s + c.conversions, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const totalReach = allCampaigns.reduce((s, c) => s + (c.raw_data?.reach || 0), 0);

    const platformPieData = [
        { name: 'Meta Ads', value: metaCampaigns.reduce((s, c) => s + c.spend, 0) },
        { name: 'Google Ads', value: googleCampaigns.reduce((s, c) => s + c.spend, 0) },
    ].filter(d => d.value > 0);

    const campaignBarData = allCampaigns.slice(0, 8).map(c => ({
        name: c.campaign_name?.substring(0, 20) || 'Sem nome',
        Investimento: c.spend,
        Cliques: c.clicks,
        Conversões: c.conversions,
    }));

    const igProfile = profiles.find(p => p.platform === 'instagram');
    const fbProfile = profiles.find(p => p.platform === 'facebook');

    return (
        <div className="space-y-6 mt-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                <KpiCard icon={DollarSign} label="Investimento" value={`R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-amber-500" />
                <KpiCard icon={Eye} label="Impressões" value={totalImpressions.toLocaleString('pt-BR')} color="text-blue-500" />
                <KpiCard icon={Users} label="Alcance" value={totalReach.toLocaleString('pt-BR')} color="text-indigo-500" />
                <KpiCard icon={MousePointerClick} label="Cliques" value={totalClicks.toLocaleString('pt-BR')} color="text-emerald-500" />
                <KpiCard icon={Target} label="Conversões" value={totalConversions.toLocaleString('pt-BR')} color="text-purple-500" />
                <KpiCard icon={TrendingUp} label="CTR" value={`${avgCtr.toFixed(2)}%`} color="text-cyan-500" />
                <KpiCard icon={DollarSign} label="CPC" value={`R$ ${avgCpc.toFixed(2)}`} color="text-rose-500" />
            </div>

            {/* AI Insights Widget */}
            <div className="w-full">
                <AIInsightsWidget />
            </div>

            {/* Funnel + Charts */}
            <div className="grid md:grid-cols-3 gap-4">
                {/* Ads funnel */}
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

                {/* Platform pie */}
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

                {/* Campaign bar chart */}
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

export { CampaignsTab } from "./CampaignsTab";

// ─── Social Insights Tab (Facebook/Instagram) ───────────────────
export function SocialInsightsTab({ profile, icon: Icon, label }: { profile: SocialProfile | undefined; icon: any; label: string }) {
    if (!profile) return <EmptyData label={label} />;

    const insightsTotals = profile.raw_data?.insights_totals || {};
    const insightsDaily = profile.raw_data?.insights_daily || {};
    const period = profile.raw_data?.insights_period;

    // Build daily chart data sorted by date
    const dailyData = Object.entries(insightsDaily)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, metrics]: [string, any]) => ({
            date: date.substring(5), // MM-DD
            ...metrics,
        }));

    const isFacebook = profile.platform === 'facebook';

    return (
        <div className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Bento Grid Top Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Profile Box */}
                <Card className="lg:col-span-1 border-border/40 shadow-sm bg-gradient-to-br from-card to-muted/20">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                        {profile.profile_picture_url ? (
                            <div className="relative mb-4">
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                                <Avatar className="w-20 h-20 border-2 border-background shadow-md relative z-10">
                                    <AvatarImage src={profile.profile_picture_url} />
                                    <AvatarFallback><Icon className="w-8 h-8" /></AvatarFallback>
                                </Avatar>
                            </div>
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4 shadow-inner">
                                <Icon className="w-10 h-10 text-muted-foreground" />
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-foreground tracking-tight">{profile.profile_name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {period ? `${period.since} a ${period.until}` : 'Lifetime'}
                        </p>
                    </CardContent>
                </Card>

                {/* Lifetime Stats */}
                <Card className="lg:col-span-3 border-border/40 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Icon className="w-4 h-4 text-primary" /> Visão Geral da Conta
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2">
                            <StatBox label="Seguidores" value={profile.followers_count} />
                            <StatBox label={isFacebook ? 'Curtidas da Página' : 'Seguindo'} value={isFacebook ? profile.page_likes : profile.follows_count} />
                            <StatBox label={isFacebook ? 'Alcance Total' : 'Posts'} value={isFacebook ? profile.page_reach : profile.posts_count} />
                            <StatBox label="Engajamento Médio" value={`${profile.engagement_rate?.toFixed(2) || '0'}%`} isText />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Insights KPIs Bento Row */}
            {Object.keys(insightsTotals).length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {isFacebook ? (
                        <>
                            <BentoKpiCard icon={Eye} label="Impressões da Página" value={(insightsTotals.page_impressions || 0).toLocaleString('pt-BR')} />
                            <BentoKpiCard icon={Users} label="Alcance Único" value={(insightsTotals.page_impressions_unique || 0).toLocaleString('pt-BR')} />
                            <BentoKpiCard icon={MousePointerClick} label="Usuários Engajados" value={(insightsTotals.page_engaged_users || 0).toLocaleString('pt-BR')} />
                            <BentoKpiCard icon={Eye} label="Visualizações" value={(insightsTotals.page_views_total || 0).toLocaleString('pt-BR')} />
                        </>
                    ) : (
                        <>
                            <BentoKpiCard icon={Eye} label="Impressões" value={(insightsTotals.impressions || 0).toLocaleString('pt-BR')} />
                            <BentoKpiCard icon={Users} label="Contas Alcançadas" value={(insightsTotals.reach || 0).toLocaleString('pt-BR')} />
                            <BentoKpiCard icon={MousePointerClick} label="Visitas ao Perfil" value={(insightsTotals.profile_views || 0).toLocaleString('pt-BR')} />
                            <BentoKpiCard icon={Heart} label="Interações" value={(insightsTotals.accounts_engaged || 0).toLocaleString('pt-BR')} />
                        </>
                    )}
                </div>
            )}

            {/* Chart Section */}
            {dailyData.length > 0 && (
                <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">Crescimento e Distribuição (Diário)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                                <XAxis dataKey="date" tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }} />
                                {isFacebook ? (
                                    <>
                                        <Area type="monotone" dataKey="page_impressions_unique" name="Alcance" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorPrimary)" />
                                        <Area type="monotone" dataKey="page_engaged_users" name="Engajados" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#colorSecondary)" />
                                    </>
                                ) : (
                                    <>
                                        <Area type="monotone" dataKey="reach" name="Alcance" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorPrimary)" />
                                        <Area type="monotone" dataKey="impressions" name="Impressões" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#colorSecondary)" />
                                    </>
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Recent posts */}
            {profile.recent_posts?.length > 0 && (
                <Card className="border-border/40 shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">Feed e Criativos Recentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isFacebook ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {profile.recent_posts.slice(0, 10).map((post: any, i: number) => (
                                    <div key={i} className="flex gap-4 p-4 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors">
                                        {post.full_picture && <img src={post.full_picture} alt="" className="w-20 h-20 rounded-md object-cover flex-shrink-0 shadow-sm" />}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <p className="text-sm text-foreground line-clamp-2 leading-snug">{post.message || 'Sem texto'}</p>
                                            <div className="flex gap-4 pt-2 mt-auto text-xs font-semibold text-muted-foreground">
                                                <span className="flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5 text-blue-500" /> {post.likes?.summary?.total_count || 0}</span>
                                                <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-green-500" /> {post.comments?.summary?.total_count || 0}</span>
                                                {post.shares && <span className="flex items-center gap-1.5">🔄 {post.shares.count || 0}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {profile.recent_posts.slice(0, 12).map((post: any, i: number) => {
                                    const imgSource = post.thumbnail_url || post.media_url;
                                    return (
                                        <div key={i} className="relative group rounded-xl overflow-hidden border border-border/50 bg-muted/20 aspect-square shadow-sm">
                                            {imgSource ? (
                                                <img src={imgSource} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Image className="w-8 h-8 text-muted-foreground/30" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-end pb-4 text-white">
                                                <div className="flex items-center gap-4">
                                                    <span className="flex items-center gap-1.5 font-bold text-sm drop-shadow-md"><Heart className="w-4 h-4 fill-red-500 text-red-500" /> {post.like_count || 0}</span>
                                                    <span className="flex items-center gap-1.5 font-bold text-sm drop-shadow-md"><MessageCircle className="w-4 h-4 fill-white" /> {post.comments_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────
function BentoKpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <Card className="border-border/40 shadow-sm bg-gradient-to-br from-background to-muted/20">
            <CardContent className="p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                    </div>
                </div>
                <h4 className="text-2xl font-bold tracking-tight text-foreground">{value}</h4>
            </CardContent>
        </Card>
    );
}
function SocialCard({ profile, icon: Icon, color }: { profile: SocialProfile; icon: any; color: string }) {
    const isFb = profile.platform === 'facebook';
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    {profile.profile_picture_url ? (
                        <Avatar className="w-12 h-12">
                            <AvatarImage src={profile.profile_picture_url} />
                            <AvatarFallback><Icon className={`w-6 h-6 ${color}`} /></AvatarFallback>
                        </Avatar>
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Icon className={`w-6 h-6 ${color}`} />
                        </div>
                    )}
                    <div className="flex-1">
                        <p className="font-semibold text-foreground text-sm">{profile.profile_name || profile.platform}</p>
                        <p className="text-xs text-muted-foreground capitalize">{profile.platform}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{(profile.followers_count || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Seguidores</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{(isFb ? profile.page_likes : profile.posts_count || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{isFb ? 'Curtidas' : 'Posts'}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{profile.engagement_rate?.toFixed(1) || '0'}%</p>
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

// ─── Campaign Leads Dialog ────────────────────────────────────────────────
export function CampaignLeadsDialog({ open, onOpenChange, campaignId, campaignName, dateRange }: { open: boolean, onOpenChange: (open: boolean) => void, campaignId: string, campaignName: string, dateRange?: DateRange }) {
    const { currentOrganization } = useOrganization();
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function fetchLeads() {
            if (!open || !currentOrganization?.id || !campaignId) return;
            setLoading(true);
            try {
                // Fetch chats with this campaign_id
                let query = supabase
                    .from('chats')
                    .select('id, wa_name, custom_name, phone, ad_name, chat_tags(tags(id, name, color))')
                    .eq('organization_id', currentOrganization.id)
                    .eq('campaign_id', campaignId);

                // Aplica date filters
                if (dateRange && dateRange.preset !== 'all_time') {
                    if (dateRange.start) {
                        query = query.gte('created_at', `${dateRange.start}T00:00:00.000Z`);
                    }
                    if (dateRange.end) {
                        query = query.lte('created_at', `${dateRange.end}T23:59:59.999Z`);
                    }
                }

                const { data, error } = await query.order('updated_at', { ascending: false });

                if (error) throw error;
                if (isMounted) setLeads(data || []);
            } catch (err) {
                console.error("Error fetching campaign leads:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        if (open) {
            fetchLeads();
        } else {
            setLeads([]);
        }

        return () => { isMounted = false; };
    }, [open, campaignId, currentOrganization?.id]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Leads da Campanha
                    </DialogTitle>
                    <DialogDescription className="truncate">
                        {campaignName}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-4" />
                            <p className="text-sm text-muted-foreground">Buscando leads desta campanha...</p>
                        </div>
                    ) : leads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Target className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-sm font-semibold text-foreground mb-1">Nenhum Lead Encontrado</h3>
                            <p className="text-xs text-muted-foreground max-w-[250px] text-center">
                                Não encontramos nenhum lead vinculado a esta campanha no CRM. Eles podem não possuir o ID de rastreamento do anúncio.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground font-medium uppercase mb-4 tracking-wider">
                                {leads.length} leads registrados
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {leads.map((lead) => {
                                    const name = lead.custom_name || lead.wa_name || lead.phone;
                                    const tags = (lead.chat_tags as any[])?.filter(t => t.tags).map(t => t.tags) || [];

                                    return (
                                        <Card key={lead.id} className="shadow-sm border-border/50 hover:border-primary/20 transition-colors">
                                            <CardContent className="p-4 flex flex-col h-full justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                        <UserIcon className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold text-sm text-foreground truncate">{name}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                            <Phone className="h-3 w-3" />
                                                            {lead.phone}
                                                        </p>
                                                    </div>
                                                </div>

                                                {lead.ad_name && (
                                                    <div className="text-[10px] text-muted-foreground bg-muted/40 p-1.5 rounded truncate">
                                                        <span className="font-semibold mr-1">Anúncio:</span>
                                                        {lead.ad_name}
                                                    </div>
                                                )}

                                                {tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {tags.map((tag: any) => (
                                                            <span
                                                                key={tag.id}
                                                                className="text-[9px] px-1.5 py-0.5 rounded font-medium border"
                                                                style={{
                                                                    backgroundColor: `${tag.color || '#94a3b8'}15`,
                                                                    borderColor: `${tag.color || '#94a3b8'}40`,
                                                                    color: tag.color || '#94a3b8'
                                                                }}
                                                            >
                                                                {tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 border-t shrink-0 bg-background">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
