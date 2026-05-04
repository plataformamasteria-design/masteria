'use client';

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    RefreshCw, Settings2, Instagram, Facebook,
    PlugZap, Loader2, Globe, AlertCircle, Building2, Search
} from "lucide-react";
import { DateRangePicker, useDateRange } from "@/components/marketing/DateRangePicker";
import type { DateRange } from "react-day-picker";
import {
    OverviewTab, CampaignsTab, SocialInsightsTab,
    type Campaign, type AdSet, type Ad, type SocialProfile,
} from "@/components/marketing/MarketingComponents";
import { MetaIntegrationPopup } from "@/components/automations/meta-integration-popup";

import {
    getMarketingDataAction,
    listAdAccountsAction,
    saveCredentialsAction,
    syncMetaAction,
    syncGoogleAction,
    disconnectPlatformAction,
    saveGoogleConfigAction,
    getGoogleAuthUrlAction
} from "./actions";

interface MarketingCredentials {
    platform: string;
    status: string;
    credentials: any;
    connected_at: string | Date | null;
}

interface AdAccount {
    id: string;
    account_id: string;
    name: string;
    business_name: string | null;
    account_status: number;
    currency: string;
    timezone: string;
}

export default function MarketingClient({ companyId, settings }: { companyId: string, settings?: any }) {
    const { dateRange, setDateRange } = useDateRange();

    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [credentials, setCredentials] = useState<MarketingCredentials[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [adSets, setAdSets] = useState<AdSet[]>([]);
    const [ads, setAds] = useState<Ad[]>([]);
    const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
    const [activeTab, setActiveTab] = useState("overview");

    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [savingAccount, setSavingAccount] = useState(false);

    const [googleClientId, setGoogleClientId] = useState(settings?.google_ads_client_id || '');
    const [googleClientSecret, setGoogleClientSecret] = useState(settings?.google_ads_client_secret || '');
    const [googleDevToken, setGoogleDevToken] = useState(settings?.google_ads_developer_token || '');
    const [savingGoogle, setSavingGoogle] = useState(false);
    const [connectingGoogle, setConnectingGoogle] = useState(false);

    const fetchData = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const res = await getMarketingDataAction(companyId);
            if (res?.ok) {
                setCredentials((res.credentials as any) || []);
                setCampaigns((res.campaigns as any) || []);
                setAdSets((res.adsets as any) || []);
                setAds((res.ads as any) || []);
                setSocialProfiles((res.social_profiles as any) || []);
                const metaCred = (res.credentials || []).find((c: any) => c.platform === 'meta' && c.status === 'connected');
                if (metaCred?.credentials?.ad_account_id) {
                    setSelectedAccountId(metaCred.credentials.ad_account_id);
                }
            }
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
        setLoading(false);
    }, [companyId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('meta_success')) {
                toast({ title: "Meta conectado com sucesso!" });
                window.history.replaceState({}, '', '/marketing');
                fetchData();
            }
            if (params.get('google_success')) {
                toast({ title: "Google Ads conectado com sucesso!" });
                window.history.replaceState({}, '', '/marketing');
                fetchData();
            }
            if (params.get('meta_error') || params.get('google_error')) {
                const err = params.get('meta_error') || params.get('google_error') || '';
                toast({ title: "Erro ao conectar", description: decodeURIComponent(err), variant: "destructive" });
                window.history.replaceState({}, '', '/marketing');
            }
        }
    }, [fetchData]);

    const discoverAdAccounts = async () => {
        if (!companyId) return;
        setLoadingAccounts(true);
        try {
            const res = await listAdAccountsAction(companyId);
            if (res?.ok) {
                setAdAccounts(res.accounts || []);
                if ((res.accounts || []).length === 0) {
                    toast({ title: "Nenhuma conta encontrada", description: "O token não tem acesso a contas.", variant: "destructive" });
                }
            } else {
                toast({ title: "Erro", description: res?.error || "Falha", variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
        setLoadingAccounts(false);
    };

    const saveSelectedAccount = async (accountId?: string) => {
        const idToSave = accountId || selectedAccountId;
        if (!companyId || !idToSave) return;
        setSavingAccount(true);
        try {
            const metaCred = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
            if (!metaCred) {
                toast({ title: "Meta não conectado", variant: "destructive" });
                setSavingAccount(false);
                return;
            }
            const cleanId = idToSave.replace(/^act_/, '');
            const updatedCreds = { ...metaCred.credentials, ad_account_id: cleanId };
            await saveCredentialsAction(companyId, 'meta', updatedCreds);

            toast({ title: "✅ Conta selecionada!" });
            setSelectedAccountId(cleanId);
            await fetchData();
            syncAll();
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
        setSavingAccount(false);
    };

    const syncAll = async (range?: DateRange) => {
        if (!companyId) return;
        setSyncing(true);
        const dr = range || dateRange;
        try {
            const metaCred = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
            const googleCred = credentials.find(c => c.platform === 'google' && c.status === 'connected');
            if (metaCred) await syncMetaAction(companyId, { from: dr?.from?.toISOString(), to: dr?.to?.toISOString() });
            if (googleCred) await syncGoogleAction(companyId, { from: dr?.from?.toISOString(), to: dr?.to?.toISOString() });

            toast({ title: "Dados sincronizados!" });
            await fetchData();
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
        setSyncing(false);
    };

    const disconnect = async (platform: string) => {
        if (!companyId) return;
        await disconnectPlatformAction(companyId, platform);
        toast({ title: `${platform} desconectado` });
        setAdAccounts([]);
        fetchData();
    };

    const handleDateRangeChange = async (range: DateRange) => {
        setDateRange(range as any);
        if (!companyId) return;
        setSyncing(true);
        try {
            await syncMetaAction(companyId, { from: range?.from?.toISOString(), to: range?.to?.toISOString() });
            toast({ title: "Dados sincronizados!" });
            await fetchData();
        } catch (e: any) {
            console.error(e);
        }
        setSyncing(false);
    };

    const saveGoogleConfig = async () => {
        if (!companyId) return;
        setSavingGoogle(true);
        try {
            await saveGoogleConfigAction(companyId, { google_ads_client_id: googleClientId, google_ads_client_secret: googleClientSecret, google_ads_developer_token: googleDevToken });
            toast({ title: "Configuração salva!" });
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
        setSavingGoogle(false);
    };

    const loginGoogle = async () => {
        if (!companyId) return;
        setConnectingGoogle(true);
        try {
            await saveGoogleConfig();
            const res = await getGoogleAuthUrlAction(companyId);
            if (res?.auth_url) window.location.href = res.auth_url;
            else toast({ title: "Erro", description: "Falha na URL", variant: "destructive" });
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
        setConnectingGoogle(false);
    };

    const metaConnected = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
    const googleConnected = credentials.find(c => c.platform === 'google' && c.status === 'connected');
    const igProfile = socialProfiles.find(p => p.platform === 'instagram');
    const fbProfile = socialProfiles.find(p => p.platform === 'facebook');
    const hasAnyConnection = metaConnected || googleConnected;
    const currentAdAccountId = (metaConnected?.credentials as any)?.ad_account_id;

    const statusLabel = (s: number) => {
        switch (s) {
            case 1: return { text: 'Ativa', color: 'text-emerald-600' };
            case 2: return { text: 'Desativada', color: 'text-red-500' };
            case 3: return { text: 'Pendente', color: 'text-amber-500' };
            default: return { text: 'Desconhecido', color: 'text-muted-foreground' };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2 flex-wrap">
                    {hasAnyConnection && (
                        <>
                            <DateRangePicker value={dateRange as any} onChange={handleDateRangeChange as any} />
                            <Button onClick={() => syncAll()} disabled={syncing} variant="outline" size="sm">
                                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                                Sincronizar
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {!hasAnyConnection && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma integração configurada</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md">
                            Conecte o App da Meta abaixo para sincronizar as contas de Anúncio e a API do WhatsApp.
                        </p>
                        <MetaIntegrationPopup />
                    </CardContent>
                </Card>
            )}

            {metaConnected && !currentAdAccountId && (
                <Card className="border-amber-500/40 bg-amber-500/5">
                    <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <PlugZap className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Meta conectado</span>
                            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium ml-2">— selecione a conta de anúncios</span>
                        </div>

                        {adAccounts.length === 0 ? (
                            <Button onClick={discoverAdAccounts} disabled={loadingAccounts} variant="outline">
                                {loadingAccounts ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                                Buscar Contas de Anúncios
                            </Button>
                        ) : (
                            <div className="space-y-3">
                                <Label className="text-xs text-muted-foreground">
                                    {adAccounts.length} conta{adAccounts.length !== 1 ? 's' : ''} encontrada{adAccounts.length !== 1 ? 's' : ''} — selecione a conta:
                                </Label>
                                <div className="grid gap-2">
                                    {adAccounts.map(acc => {
                                        const st = statusLabel(acc.account_status);
                                        return (
                                            <button
                                                key={acc.account_id}
                                                onClick={() => { setSelectedAccountId(acc.account_id); saveSelectedAccount(acc.account_id); }}
                                                disabled={savingAccount}
                                                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${selectedAccountId === acc.account_id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border'
                                                    }`}
                                            >
                                                <div className="p-2 rounded-lg bg-blue-500/10 mt-0.5">
                                                    {acc.business_name ? <Building2 className="w-4 h-4 text-blue-600" /> : <Facebook className="w-4 h-4 text-blue-600" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium truncate">{acc.name}</span>
                                                        <span className={`text-[10px] font-medium ${st.color}`}>{st.text}</span>
                                                    </div>
                                                    {acc.business_name && (
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                            <Building2 className="w-3 h-3" /> {acc.business_name}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        ID: {acc.account_id} · {acc.currency} · {acc.timezone}
                                                    </p>
                                                </div>
                                                {savingAccount && selectedAccountId === acc.account_id && (
                                                    <Loader2 className="w-4 h-4 animate-spin text-primary mt-1" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <Button variant="ghost" size="sm" className="text-xs" onClick={discoverAdAccounts} disabled={loadingAccounts}>
                                    {loadingAccounts ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                    Atualizar lista
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {metaConnected && currentAdAccountId && (
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <PlugZap className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Meta Ads · Conta: {currentAdAccountId}
                        </span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                        await discoverAdAccounts();
                        const metaCred = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
                        if (metaCred) {
                            const updatedCreds = { ...metaCred.credentials, ad_account_id: null };
                            await saveCredentialsAction(companyId, 'meta', updatedCreds);
                            await fetchData();
                        }
                    }}>
                        Trocar Conta
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => disconnect('meta')}>
                        Desconectar
                    </Button>
                </div>
            )}

            {!googleConnected && metaConnected && (
                <Card className="border-dashed">
                    <CardContent className="p-4">
                        <details className="group">
                            <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                                <Globe className="w-4 h-4" />
                                <span>Configurar Google Ads (opcional)</span>
                            </summary>
                            <div className="mt-3 grid gap-3 max-w-lg">
                                <div>
                                    <Label className="text-xs">Client ID (OAuth)</Label>
                                    <Input value={googleClientId} onChange={e => setGoogleClientId(e.target.value)} placeholder="xxx.apps.googleusercontent.com" className="text-xs mt-1" />
                                </div>
                                <div>
                                    <Label className="text-xs">Client Secret</Label>
                                    <Input value={googleClientSecret} onChange={e => setGoogleClientSecret(e.target.value)} type="password" className="text-xs mt-1" />
                                </div>
                                <div>
                                    <Label className="text-xs">Developer Token</Label>
                                    <Input value={googleDevToken} onChange={e => setGoogleDevToken(e.target.value)} placeholder="Token de desenvolvedor" className="text-xs mt-1" />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={saveGoogleConfig} disabled={savingGoogle}>
                                        {savingGoogle ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                                    </Button>
                                    <Button onClick={loginGoogle} size="sm" disabled={connectingGoogle || !googleClientId}>
                                        {connectingGoogle ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Globe className="w-4 h-4 mr-1" />}
                                        Entrar com Google
                                    </Button>
                                </div>
                            </div>
                        </details>
                    </CardContent>
                </Card>
            )}

            {googleConnected && (
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <PlugZap className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Google Ads conectado</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => disconnect('google')}>
                        Desconectar
                    </Button>
                </div>
            )}

            {hasAnyConnection && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                        <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
                        <TabsTrigger value="instagram">Instagram</TabsTrigger>
                        <TabsTrigger value="facebook">Facebook</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <OverviewTab campaigns={campaigns} profiles={socialProfiles} />
                    </TabsContent>
                    <TabsContent value="campaigns">
                        <CampaignsTab campaigns={campaigns} adsets={adSets} ads={ads} />
                    </TabsContent>
                    <TabsContent value="instagram">
                        <SocialInsightsTab profile={igProfile as SocialProfile} icon={Instagram} label="Instagram" />
                    </TabsContent>
                    <TabsContent value="facebook">
                        <SocialInsightsTab profile={fbProfile as SocialProfile} icon={Facebook} label="Facebook" />
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
