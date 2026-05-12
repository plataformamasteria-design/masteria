import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  RefreshCw, Settings2, Instagram, Facebook,
  PlugZap, Loader2, Globe, AlertCircle, Building2, Search, Target, Lock, Unlock, KeyRound, ChevronRight, CheckCircle2
} from "lucide-react";
import { DateRangePicker, useDateRange } from "@/components/marketing/DateRangePicker";
import type { DateRange } from "@/components/marketing/DateRangePicker";
import type { DashboardDiagnostic } from "@/components/marketing/AdsDashboardTab";
import { CampaignsTab, type Campaign, type SocialProfile } from "@/components/marketing/MarketingComponents";
import { CombinedDashboardTab } from "@/components/marketing/CombinedDashboardTab";
import { UnifiedSocialTab } from "@/components/marketing/UnifiedSocialTab";
import { InsightsInteligentesTab } from "@/components/marketing/InsightsInteligentesTab";

interface MarketingCredentials {
  platform: string;
  status: string;
  credentials: any;
  connected_at: string | null;
}

interface AdAccount {
  id: string;           // "act_XXXX"
  account_id: string;   // "XXXX"
  name: string;
  business_name: string | null;
  account_status: number;
  currency: string;
  timezone: string;
}

export default function Marketing() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const { dateRange, setDateRange } = useDateRange();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [credentials, setCredentials] = useState<MarketingCredentials[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [diagnostics, setDiagnostics] = useState<DashboardDiagnostic[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Ad Account & Pages discovery
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const [metaPages, setMetaPages] = useState<any[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const [savingAccount, setSavingAccount] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2>(1);

  // Security lock state
  const [isConfigLocked, setIsConfigLocked] = useState(true);
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockingError, setUnlockingError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [dbLockPassword, setDbLockPassword] = useState('admin123');
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);
  const [lockNewPassword, setLockNewPassword] = useState('');
  const [isLocking, setIsLocking] = useState(false);

  // Google Ads config
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleDevToken, setGoogleDevToken] = useState('');
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // Meta Pixel config
  const [metaPixelId, setMetaPixelId] = useState('');
  const [savingPixel, setSavingPixel] = useState(false);

  // KPIs config
  const [targetCpl, setTargetCpl] = useState<string>('');
  const [targetRoas, setTargetRoas] = useState<string>('');
  const [targetCpc, setTargetCpc] = useState<string>('');
  const [targetCtr, setTargetCtr] = useState<string>('');
  const [targetCpm, setTargetCpm] = useState<string>('');
  const [savingKpis, setSavingKpis] = useState(false);

  useEffect(() => {
    const s = (currentOrganization as any)?.settings || {};
    setGoogleClientId(s.google_ads_client_id || '');
    setGoogleClientSecret(s.google_ads_client_secret || '');
    setGoogleDevToken(s.google_ads_developer_token || '');
    setTargetCpl(s.marketing_kpis?.target_cpl?.toString() || '');
    setTargetRoas(s.marketing_kpis?.target_roas?.toString() || '');
    setTargetCpc(s.marketing_kpis?.target_cpc?.toString() || '');
    setTargetCtr(s.marketing_kpis?.target_ctr?.toString() || '');
    setTargetCpm(s.marketing_kpis?.target_cpm?.toString() || '');
    setDbLockPassword(s.marketing_lock_password || 'admin123');
  }, [currentOrganization?.id]);

  const saveKpis = async () => {
    if (!orgId) return;
    setSavingKpis(true);
    try {
      const currentSettings = (currentOrganization as any)?.settings || {};
      const newSettings = {
        ...currentSettings,
        marketing_kpis: {
          target_cpl: targetCpl ? Number(targetCpl) : null,
          target_roas: targetRoas ? Number(targetRoas) : null,
          target_cpc: targetCpc ? Number(targetCpc) : null,
          target_ctr: targetCtr ? Number(targetCtr) : null,
          target_cpm: targetCpm ? Number(targetCpm) : null
        }
      };
      await (supabase as any).from('organizations').update({ settings: newSettings }).eq('id', orgId);
      toast({ title: "Metas KPI salvas com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingKpis(false);
  };

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('marketing-api', {
        body: { action: 'get_data', organization_id: orgId },
      });
      if (res.data?.ok) {
        setCredentials(res.data.credentials || []);
        const validCampaigns = (res.data.campaigns || []).filter((c: any) => c.spend > 0 || c.impressions > 0 || c.clicks > 0);
        setCampaigns(validCampaigns);
        setSocialProfiles(res.data.social_profiles || []);
        setDiagnostics(res.data.diagnostics || []);
        const metaCred = (res.data.credentials || []).find((c: any) => c.platform === 'meta' && c.status === 'connected');
        if (metaCred?.credentials?.ad_account_id) {
          setSelectedAccountId(metaCred.credentials.ad_account_id);
        }
        if (metaCred?.credentials?.pixel_id) {
          setMetaPixelId(metaCred.credentials.pixel_id);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handle OAuth callbacks
  useEffect(() => {
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
  }, []);

  // Discover ad accounts from Meta
  const discoverAdAccounts = async () => {
    if (!orgId) return;
    setLoadingAccounts(true);
    try {
      const res = await supabase.functions.invoke('marketing-api', {
        body: { action: 'list_ad_accounts', organization_id: orgId },
      });
      if (res.data?.ok) {
        setAdAccounts(res.data.accounts || []);
        if ((res.data.accounts || []).length === 0) {
          toast({ title: "Nenhuma conta encontrada", description: "O token não tem acesso a nenhuma conta de anúncios.", variant: "destructive" });
        }
      } else {
        toast({ title: "Erro", description: res.data?.error || "Não foi possível listar contas", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoadingAccounts(false);
  };

  // Step 1 -> Step 2
  const proceedToPageSelection = async (accountId?: string) => {
    const idToSave = accountId || selectedAccountId;
    if (!idToSave) return;
    const cleanId = idToSave.replace(/^act_/, '');
    setSelectedAccountId(cleanId);

    setLoadingPages(true);
    setSetupStep(2);
    try {
      const { data: edgeData, error } = await supabase.functions.invoke('marketing-api', {
        body: { action: 'list_meta_pages', organization_id: orgId }
      });

      if (error) throw error;
      if (edgeData?.errors && edgeData.errors.length > 0) {
        throw new Error("Meta Sync Error: " + edgeData.errors.join(", "));
      }

      if (edgeData?.ok) {
        setMetaPages(edgeData.pages || []);
      } else {
        toast({ title: "Erro", description: edgeData?.error || "Falha ao carregar páginas", variant: "destructive" });
        setSetupStep(1);
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setSetupStep(1);
    }
    setLoadingPages(false);
  };

  // Final Save
  const saveFinalMetaConfig = async () => {
    if (!orgId || !selectedAccountId || !selectedPageId) return;
    setSavingAccount(true);
    try {
      const metaCred = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
      if (!metaCred) {
        toast({ title: "Meta não conectado", variant: "destructive" });
        return;
      }
      const page = metaPages.find(p => p.page_id === selectedPageId);
      const updatedCreds = {
        ...metaCred.credentials,
        ad_account_id: selectedAccountId,
        page_id: selectedPageId,
        instagram_id: page?.instagram_id || null
      };

      await supabase.functions.invoke('marketing-api', {
        body: { action: 'save_credentials', organization_id: orgId, platform: 'meta', credentials: updatedCreds },
      });

      toast({ title: "✅ Integração Meta Completa!" });
      setSetupStep(1);
      setIsConfigLocked(true);
      await fetchData();
      syncAll();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingAccount(false);
  };

  const handleUnlockConfig = async () => {
    setUnlockingError('');
    setIsUnlocking(true);
    await new Promise(r => setTimeout(r, 400));

    if (unlockPassword === dbLockPassword) {
      setIsConfigLocked(false);
      setIsUnlockDialogOpen(false);
      setUnlockPassword('');
      toast({ title: "Configurações desbloqueadas" });
    } else {
      setUnlockingError("Senha de proteção incorreta.");
    }
    setIsUnlocking(false);
  };

  const handleLockConfig = async () => {
    if (!orgId) return;
    setIsLocking(true);
    try {
      const newPw = lockNewPassword || 'admin123';
      const currentSettings = (currentOrganization as any)?.settings || {};
      await (supabase as any).from('organizations').update({
        settings: { ...currentSettings, marketing_lock_password: newPw }
      }).eq('id', orgId);

      setDbLockPassword(newPw);
      setIsConfigLocked(true);
      setIsLockDialogOpen(false);
      setLockNewPassword('');
      toast({ title: "Configurações Trancadas com Sucesso" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setIsLocking(false);
  };

  const syncAll = async (range?: DateRange) => {
    if (!orgId) return;
    setSyncing(true);
    const dr = range || dateRange;
    try {
      const metaCred = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
      const googleCred = credentials.find(c => c.platform === 'google' && c.status === 'connected');
      if (metaCred) {
        await supabase.functions.invoke('marketing-api', { body: { action: 'sync_meta', organization_id: orgId, date_range: dr } });
      }
      if (googleCred) {
        await supabase.functions.invoke('marketing-api', { body: { action: 'sync_google', organization_id: orgId, date_range: dr } });
      }
      toast({ title: "Dados sincronizados!" });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  const disconnect = async (platform: string) => {
    if (!orgId) return;
    await supabase.functions.invoke('marketing-api', { body: { action: 'disconnect', organization_id: orgId, platform } });
    toast({ title: `${platform} desconectado` });
    setAdAccounts([]);
    fetchData();
  };

  const handleDateRangeChange = async (range: DateRange) => {
    setDateRange(range);
    // Directly sync with the new date range (avoid stale closure over credentials)
    if (!orgId) return;
    setSyncing(true);
    try {
      await supabase.functions.invoke('marketing-api', {
        body: { action: 'sync_meta', organization_id: orgId, date_range: range },
      });
      toast({ title: "Dados sincronizados!" });
      await fetchData();
    } catch (e: any) {
      console.error('[Marketing] sync on date change error:', e);
    }
    setSyncing(false);
  };

  const savePixelConfig = async () => {
    if (!orgId) return;
    setSavingPixel(true);
    try {
      const metaCred = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
      if (metaCred) {
        const updatedCreds = { ...metaCred.credentials, pixel_id: metaPixelId.trim() };
        await supabase.functions.invoke('marketing-api', {
          body: { action: 'save_credentials', organization_id: orgId, platform: 'meta', credentials: updatedCreds },
        });
        toast({ title: "Pixel ID salvo com sucesso!" });
        await fetchData();
      }
    } catch (e: any) {
      toast({ title: "Erro ao salvar Pixel", description: e.message, variant: "destructive" });
    }
    setSavingPixel(false);
  };

  // Google Ads helpers
  const saveGoogleConfig = async () => {
    if (!orgId) return;
    setSavingGoogle(true);
    try {
      const currentSettings = (currentOrganization as any)?.settings || {};
      await (supabase as any).from('organizations').update({
        settings: { ...currentSettings, google_ads_client_id: googleClientId.trim(), google_ads_client_secret: googleClientSecret.trim(), google_ads_developer_token: googleDevToken.trim() },
      }).eq('id', orgId);
      toast({ title: "Google Ads configuração salva!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingGoogle(false);
  };

  const loginGoogle = async () => {
    if (!orgId) return;
    setConnectingGoogle(true);
    try {
      await saveGoogleConfig();
      const res = await supabase.functions.invoke('marketing-oauth?action=google-auth-url', { body: { organization_id: orgId } });
      if (res.data?.auth_url) window.location.href = res.data.auth_url;
      else toast({ title: "Erro", description: res.data?.error || "Não foi possível gerar URL", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setConnectingGoogle(false);
  };

  const metaConnected = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
  const googleConnected = credentials.find(c => c.platform === 'google' && c.status === 'connected');
  const igProfile = socialProfiles.find(p => p.platform === 'instagram');
  const fbProfile = socialProfiles.find(p => p.platform === 'facebook');
  const hasAnyConnection = metaConnected || googleConnected || campaigns.length > 0 || diagnostics.length > 0;
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
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
            <p className="text-muted-foreground text-sm">Dados de campanhas, perfis sociais e performance de tráfego pago</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {hasAnyConnection && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Target className="w-4 h-4 mr-2 text-primary" />
                      KPIs Alvo
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm">Configuração de Metas</h4>
                        <p className="text-xs text-muted-foreground">Defina limites para analisar a performance dos anúncios.</p>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">CPL (R$ Max)</Label>
                            <Input type="number" value={targetCpl} onChange={e => setTargetCpl(e.target.value)} placeholder="15.50" className="h-8 text-sm mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">ROAS (x Min)</Label>
                            <Input type="number" value={targetRoas} onChange={e => setTargetRoas(e.target.value)} placeholder="3.0" className="h-8 text-sm mt-1" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">CPC (R$ Max)</Label>
                            <Input type="number" value={targetCpc} onChange={e => setTargetCpc(e.target.value)} placeholder="2.50" className="h-8 text-sm mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">CTR (% Min)</Label>
                            <Input type="number" value={targetCtr} onChange={e => setTargetCtr(e.target.value)} placeholder="1.5" className="h-8 text-sm mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">CPM (R$ Max)</Label>
                            <Input type="number" value={targetCpm} onChange={e => setTargetCpm(e.target.value)} placeholder="15.00" className="h-8 text-sm mt-1" />
                          </div>
                        </div>
                        <Button className="w-full text-xs h-8" onClick={saveKpis} disabled={savingKpis}>
                          {savingKpis ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                          Salvar Metas
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
                <Button onClick={() => syncAll()} disabled={syncing} variant="outline" size="sm">
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Sincronizar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* No connection */}
        {!hasAnyConnection && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma integração configurada</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Configure a conexão Meta em <strong>Configurações → Integrações → Meta Marketing</strong> para começar.
              </p>
              <Button onClick={() => window.location.href = '/profile'}>
                <Settings2 className="w-4 h-4 mr-2" /> Ir para Configurações
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Meta connected but no Ad Account — show discovery */}
        {metaConnected && !currentAdAccountId && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <PlugZap className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Meta conectado</span>
                <span className="text-sm text-amber-600 dark:text-amber-400 font-medium ml-2">— selecione a conta de anúncios</span>
              </div>

              {setupStep === 1 ? (
                adAccounts.length === 0 ? (
                  <Button onClick={discoverAdAccounts} disabled={loadingAccounts} variant="outline">
                    {loadingAccounts ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    Buscar Contas de Anúncios
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">
                      {adAccounts.length} conta{adAccounts.length !== 1 ? 's' : ''} de anúncio encontrada{adAccounts.length !== 1 ? 's' : ''} — Etapa 1: selecione
                    </Label>
                    <div className="grid gap-2">
                      {adAccounts.map(acc => {
                        const st = statusLabel(acc.account_status);
                        return (
                          <button
                            key={acc.account_id}
                            onClick={() => proceedToPageSelection(acc.account_id)}
                            disabled={loadingPages}
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
                            {loadingPages && selectedAccountId === acc.account_id && (
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
                )
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                  <Label className="text-xs text-muted-foreground">
                    Etapa 2: Selecione a Página do Facebook correspondente a esta conta
                  </Label>
                  <div className="grid gap-2 max-h-64 overflow-y-auto pr-2">
                    {metaPages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma página encontrada.</p>
                    ) : (
                      metaPages.map(page => (
                        <button
                          key={page.page_id}
                          onClick={() => setSelectedPageId(page.page_id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${selectedPageId === page.page_id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-primary/30'}`}
                        >
                          <img src={page.page_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.page_name)}`} alt="" className="w-8 h-8 rounded-full bg-muted object-cover" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{page.page_name}</p>
                            {page.instagram_username && (
                              <p className="text-xs text-pink-500 flex items-center gap-1 mt-0.5">
                                <Instagram className="w-3 h-3" /> @{page.instagram_username}
                              </p>
                            )}
                          </div>
                          {selectedPageId === page.page_id && <CheckCircle2 className="w-5 h-5 text-primary" />}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setSetupStep(1)}>Voltar</Button>
                    <Button size="sm" disabled={!selectedPageId || savingAccount} onClick={saveFinalMetaConfig}>
                      {savingAccount ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Salvar Configuração'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Meta connected WITH Ad Account AND Config Locked Check */}
        {metaConnected && currentAdAccountId && (
          isConfigLocked ? (
            <Card className="border-primary/20 bg-primary/5 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 border border-primary/20 rounded-full shadow-inner">
                    <Lock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Configurações de Integração Bloqueadas</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Desbloqueie para trocar contas Meta Ads, Pixels ou vincular Google Ads.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsUnlockDialogOpen(true)}>
                  <Unlock className="w-4 h-4 mr-2" />
                  Desbloquear
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <PlugZap className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Meta Ads · Conta: {currentAdAccountId}
                  </span>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                  await discoverAdAccounts();
                  // Clear ad_account_id so the selector shows
                  const metaCred = credentials.find(c => c.platform === 'meta' && c.status === 'connected');
                  if (metaCred) {
                    const updatedCreds = { ...metaCred.credentials, ad_account_id: null };
                    await supabase.functions.invoke('marketing-api', {
                      body: { action: 'save_credentials', organization_id: orgId, platform: 'meta', credentials: updatedCreds },
                    });
                    await fetchData();
                  }
                }}>
                  Trocar Conta
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => disconnect('meta')}>
                  Desconectar
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto text-muted-foreground" onClick={() => setIsLockDialogOpen(true)}>
                  <Lock className="w-3 h-3 mr-1" /> Rebloquear
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-dashed bg-card/40">
                  <CardContent className="p-4">
                    <details className="group">
                      <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <Target className="w-4 h-4 text-purple-500" />
                        <span>Configurar Pixel de Conversão (Eventos Offline)</span>
                      </summary>
                      <div className="mt-3 flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Meta Pixel ID / Dataset ID</Label>
                          <Input value={metaPixelId} onChange={e => setMetaPixelId(e.target.value)} placeholder="Ex: 569102434192..." className="text-xs mt-1 h-8 bg-background" />
                        </div>
                        <Button variant="outline" size="sm" onClick={savePixelConfig} disabled={savingPixel} className="h-8">
                          {savingPixel ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                        </Button>
                      </div>
                    </details>
                  </CardContent>
                </Card>

                {/* Google Ads settings encapsulated inside lock */}
                {!googleConnected ? (
                  <Card className="border-dashed bg-card/40">
                    <CardContent className="p-4">
                      <details className="group">
                        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                          <Globe className="w-4 h-4 text-blue-500" />
                          <span>Conectar Google Ads (opcional)</span>
                        </summary>
                        <div className="mt-3 grid gap-3">
                          <div>
                            <Label className="text-xs">Client ID (OAuth)</Label>
                            <Input value={googleClientId} onChange={e => setGoogleClientId(e.target.value)} placeholder="xxx.apps.googleusercontent.com" className="text-xs mt-1 h-8" />
                          </div>
                          <div>
                            <Label className="text-xs">Client Secret</Label>
                            <Input value={googleClientSecret} onChange={e => setGoogleClientSecret(e.target.value)} type="password" className="text-xs mt-1 h-8" />
                          </div>
                          <div>
                            <Label className="text-xs">Developer Token</Label>
                            <Input value={googleDevToken} onChange={e => setGoogleDevToken(e.target.value)} placeholder="Token de desenvolvedor" className="text-xs mt-1 h-8" />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={saveGoogleConfig} disabled={savingGoogle} className="h-8">
                              {savingGoogle ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar keys'}
                            </Button>
                            <Button onClick={loginGoogle} size="sm" disabled={connectingGoogle || !googleClientId} className="h-8">
                              {connectingGoogle ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Globe className="w-3 h-3 mr-1" />}
                              Entrar com Google
                            </Button>
                          </div>
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <PlugZap className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Google Ads conectado</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => disconnect('google')}>
                      Desconectar Google
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Data tabs */}
        {hasAnyConnection && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-20">
            <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 py-3 border-b border-border/40">
              <TabsList className="bg-muted/50 p-1 w-full max-w-[800px] h-12">
                <TabsTrigger value="dashboard" className="rounded-md font-medium px-4">Dashboard Completo</TabsTrigger>
                <TabsTrigger value="campaigns" className="rounded-md font-medium px-4">Campanhas</TabsTrigger>
                <TabsTrigger value="social" className="rounded-md font-medium px-4">Rede Social</TabsTrigger>
                <TabsTrigger value="ai_insights" className="rounded-md font-medium px-4">Insights Inteligentes</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              <CombinedDashboardTab campaigns={campaigns} diagnostics={diagnostics} profiles={socialProfiles} />
            </TabsContent>

            <TabsContent value="campaigns" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              <CampaignsTab campaigns={campaigns} dateRange={dateRange} targetCpl={targetCpl ? Number(targetCpl) : null} targetRoas={targetRoas ? Number(targetRoas) : null} targetCpc={targetCpc ? Number(targetCpc) : null} targetCtr={targetCtr ? Number(targetCtr) : null} targetCpm={targetCpm ? Number(targetCpm) : null} />
            </TabsContent>

            <TabsContent value="social" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              <UnifiedSocialTab profiles={socialProfiles} />
            </TabsContent>

            <TabsContent value="ai_insights" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              <InsightsInteligentesTab />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={isUnlockDialogOpen} onOpenChange={setIsUnlockDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Desbloquear Configurações
            </DialogTitle>
            <DialogDescription>
              Para alterar as conexões do Meta Ads ou Google Ads, confirme a sua senha de integração padrão do painel de marketing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Cofre: Senha configurada</Label>
              <Input
                id="password"
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && unlockPassword) handleUnlockConfig();
                }}
              />
              {unlockingError && <p className="text-xs text-destructive">{unlockingError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUnlockDialogOpen(false)} disabled={isUnlocking}>
              Cancelar
            </Button>
            <Button onClick={handleUnlockConfig} disabled={!unlockPassword || isUnlocking}>
              {isUnlocking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLockDialogOpen} onOpenChange={setIsLockDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Trancar Configurações
            </DialogTitle>
            <DialogDescription>
              Você pode definir uma senha exclusiva para proteger as conexões. Se deixar em branco, usará a senha padrão ("admin123").
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha (Opcional)</Label>
              <Input
                id="new-password"
                type="password"
                value={lockNewPassword}
                onChange={(e) => setLockNewPassword(e.target.value)}
                placeholder="Exemplo: minha_senha_forte"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLockConfig();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLockDialogOpen(false)} disabled={isLocking}>
              Cancelar
            </Button>
            <Button onClick={handleLockConfig} disabled={isLocking}>
              {isLocking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Trancar Cofre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
