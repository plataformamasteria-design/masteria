import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Facebook, Mail, MonitorSmartphone, Loader2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneCall } from 'lucide-react';

export function GlobalIntegrationsConfig() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Meta
    const [metaAppId, setMetaAppId] = useState('');
    const [metaAppSecret, setMetaAppSecret] = useState('');
    const [igAppId, setIgAppId] = useState('');
    const [igAppSecret, setIgAppSecret] = useState('');

    // Google
    const [googleClientId, setGoogleClientId] = useState('');
    const [googleClientSecret, setGoogleClientSecret] = useState('');
    const [googleDeveloperToken, setGoogleDeveloperToken] = useState('');

    // Twilio (VOIP)
    const [twilioSid, setTwilioSid] = useState('');
    const [twilioApiKey, setTwilioApiKey] = useState('');
    const [twilioApiSecret, setTwilioApiSecret] = useState('');
    const [twilioAppSid, setTwilioAppSid] = useState('');
    const [twilioPhone, setTwilioPhone] = useState('');

    // GHL
    const [ghlId, setGhlId] = useState('');
    const [ghlClientId, setGhlClientId] = useState('');
    const [ghlClientSecret, setGhlClientSecret] = useState('');
    const [ghlRedirectUri, setGhlRedirectUri] = useState('');

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'jrxpjzgifyzhvwjfpofz';

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch global_config (Meta & Google)
            const { data: globalData, error: globalError } = await supabase
                .from('global_config')
                .select('*');

            if (!globalError && globalData) {
                const configMap = globalData.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                setMetaAppId(configMap['meta_app_id'] || '');
                setMetaAppSecret(configMap['meta_app_secret'] || '');
                setIgAppId(configMap['instagram_app_id'] || '');
                setIgAppSecret(configMap['instagram_app_secret'] || '');
                setGoogleClientId(configMap['google_ads_client_id'] || '');
                setGoogleClientSecret(configMap['google_ads_client_secret'] || '');
                setGoogleDeveloperToken(configMap['google_ads_developer_token'] || '');
                setTwilioSid(configMap['twilio_account_sid'] || '');
                setTwilioApiKey(configMap['twilio_api_key_sid'] || '');
                setTwilioApiSecret(configMap['twilio_api_key_secret'] || '');
                setTwilioAppSid(configMap['twilio_twiml_app_sid'] || '');
                setTwilioPhone(configMap['twilio_phone_number'] || '');
            }

            // 2. Fetch GHL config
            const { data: ghlData, error: ghlError } = await supabase
                .from('ghl_global_config')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (!ghlError && ghlData) {
                setGhlId(ghlData.id);
                setGhlClientId(ghlData.client_id || '');
                setGhlClientSecret(ghlData.client_secret || '');
                setGhlRedirectUri(ghlData.redirect_uri || '');
            }
        } catch (e: any) {
            toast.error('Erro ao carregar configurações: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveMeta = async () => {
        setIsSaving(true);
        try {
            await saveGlobalConfig('meta_app_id', metaAppId.trim());
            await saveGlobalConfig('meta_app_secret', metaAppSecret.trim());
            await saveGlobalConfig('instagram_app_id', igAppId.trim());
            await saveGlobalConfig('instagram_app_secret', igAppSecret.trim());
            toast.success('Chaves do Meta salvas com sucesso');
        } catch (e) {
            toast.error('Erro ao salvar Meta');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveGoogle = async () => {
        setIsSaving(true);
        try {
            await saveGlobalConfig('google_ads_client_id', googleClientId.trim());
            await saveGlobalConfig('google_ads_client_secret', googleClientSecret.trim());
            await saveGlobalConfig('google_ads_developer_token', googleDeveloperToken.trim());
            toast.success('Chaves do Google salvas com sucesso');
        } catch (e) {
            toast.error('Erro ao salvar Google');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTwilio = async () => {
        setIsSaving(true);
        try {
            await saveGlobalConfig('twilio_account_sid', twilioSid.trim());
            await saveGlobalConfig('twilio_api_key_sid', twilioApiKey.trim());
            await saveGlobalConfig('twilio_api_key_secret', twilioApiSecret.trim());
            await saveGlobalConfig('twilio_twiml_app_sid', twilioAppSid.trim());
            await saveGlobalConfig('twilio_phone_number', twilioPhone.trim());
            toast.success('Configurações da Twilio salvas com sucesso');
        } catch (e) {
            toast.error('Erro ao salvar Twilio');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveGHL = async () => {
        setIsSaving(true);
        try {
            const payload = {
                client_id: ghlClientId.trim(),
                client_secret: ghlClientSecret.trim(),
                redirect_uri: ghlRedirectUri.trim() || `https://${projectId}.supabase.co/functions/v1/ghl-oauth-callback`,
                updated_at: new Date().toISOString()
            };

            if (ghlId) {
                const { error } = await supabase.from('ghl_global_config').update(payload).eq('id', ghlId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('ghl_global_config').insert([payload]);
                if (error) throw error;
            }
            toast.success('Chaves do GHL salvas com sucesso');
            fetchConfigs(); // To get the generated ID and updated URI
        } catch (e) {
            toast.error('Erro ao salvar GHL');
        } finally {
            setIsSaving(false);
        }
    };

    const saveGlobalConfig = async (key: string, value: string) => {
        const { error } = await supabase
            .from('global_config')
            .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

        if (error) throw error;
    };

    if (isLoading) return <Skeleton className="h-64" />;

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MonitorSmartphone className="h-5 w-5 text-primary" />
                        Integrações Globais (OAuth & CAPI)
                    </CardTitle>
                    <CardDescription>
                        Configure as chaves e Client IDs dos aplicativos da plataforma.
                        Essas chaves são usadas globalmente por todos os clientes da plataforma (Whitelabel).
                        Eles verão apenas o botão de Conectar, sem precisar digitar chaves.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* META CONFIG */}
                <Card>
                    <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Facebook className="h-4 w-4 text-blue-600" />
                            Meta App (Facebook, IG, WhatsApp)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Meta App ID (Facebook Login)</Label>
                                <Input
                                    value={metaAppId}
                                    onChange={(e) => setMetaAppId(e.target.value)}
                                    placeholder="Ex: 1234567890"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Meta App Secret</Label>
                                <Input
                                    type="password"
                                    value={metaAppSecret}
                                    onChange={(e) => setMetaAppSecret(e.target.value)}
                                    placeholder="Ex: abc123def456"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Instagram App ID (IG Login)</Label>
                                <Input
                                    value={igAppId}
                                    onChange={(e) => setIgAppId(e.target.value)}
                                    placeholder="Ex: 9876543210"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Instagram App Secret</Label>
                                <Input
                                    type="password"
                                    value={igAppSecret}
                                    onChange={(e) => setIgAppSecret(e.target.value)}
                                    placeholder="Ex: def456abc123"
                                />
                            </div>
                        </div>
                        <Button onClick={handleSaveMeta} disabled={isSaving} className="w-full sm:w-auto">
                            <Save className="h-4 w-4 mr-2" /> Salvar Meta
                        </Button>
                    </CardContent>
                </Card>

                {/* GOOGLE CONFIG */}
                <Card>
                    <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Mail className="h-4 w-4 text-red-500" />
                            Google Cloud App (GMB & Ads)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Client ID (OAuth 2.0)</Label>
                            <Input
                                value={googleClientId}
                                onChange={(e) => setGoogleClientId(e.target.value)}
                                placeholder="Ex: 12345-abc.apps.googleusercontent.com"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Client Secret</Label>
                            <Input
                                type="password"
                                value={googleClientSecret}
                                onChange={(e) => setGoogleClientSecret(e.target.value)}
                                placeholder="Ex: GOCSPX-1234abc..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Developer Token (Google Ads)</Label>
                            <Input
                                type="password"
                                value={googleDeveloperToken}
                                onChange={(e) => setGoogleDeveloperToken(e.target.value)}
                                placeholder="Ex: abcXYZ123..."
                            />
                            <p className="text-[10px] text-muted-foreground">Necessário apenas se for usar relatórios do Google Ads CAPI e API.</p>
                        </div>
                        <Button onClick={handleSaveGoogle} disabled={isSaving} className="w-full sm:w-auto">
                            <Save className="h-4 w-4 mr-2" /> Salvar Google
                        </Button>
                    </CardContent>
                </Card>

                {/* TWILIO CONFIG */}
                <Card>
                    <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base flex items-center gap-2">
                            <PhoneCall className="h-4 w-4 text-rose-500" />
                            Twilio (VOIP WebRTC)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Account SID</Label>
                                <Input
                                    value={twilioSid}
                                    onChange={(e) => setTwilioSid(e.target.value)}
                                    placeholder="Ex: ACae..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">API Key SID</Label>
                                <Input
                                    value={twilioApiKey}
                                    onChange={(e) => setTwilioApiKey(e.target.value)}
                                    placeholder="Ex: SKae..."
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">API Key Secret</Label>
                                <Input
                                    type="password"
                                    value={twilioApiSecret}
                                    onChange={(e) => setTwilioApiSecret(e.target.value)}
                                    placeholder="Ex: d7a8..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">TwiML App SID</Label>
                                <Input
                                    value={twilioAppSid}
                                    onChange={(e) => setTwilioAppSid(e.target.value)}
                                    placeholder="Ex: AP82..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Nº Telefone Base</Label>
                                <Input
                                    value={twilioPhone}
                                    onChange={(e) => setTwilioPhone(e.target.value)}
                                    placeholder="Ex: +551199999999"
                                />
                            </div>
                        </div>
                        <Button onClick={handleSaveTwilio} disabled={isSaving} className="w-full sm:w-auto">
                            <Save className="h-4 w-4 mr-2" /> Salvar Twilio
                        </Button>
                    </CardContent>
                </Card>

                {/* GOHIGHLEVEL CONFIG */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base flex items-center gap-2">
                            <div className="h-4 w-4 rounded bg-cyan-600 flex items-center justify-center text-[8px] font-bold text-white">GHL</div>
                            GoHighLevel (Marketplace App)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Client ID</Label>
                                <Input
                                    value={ghlClientId}
                                    onChange={(e) => setGhlClientId(e.target.value)}
                                    placeholder="Ex: 12345-abc.marketplace.highlevel.com"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Client Secret</Label>
                                <Input
                                    type="password"
                                    value={ghlClientSecret}
                                    onChange={(e) => setGhlClientSecret(e.target.value)}
                                    placeholder="Ex: abcXYZ123..."
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Redirect URI Opcional</Label>
                            <Input
                                value={ghlRedirectUri}
                                onChange={(e) => setGhlRedirectUri(e.target.value)}
                                placeholder={`Padrão: https://${projectId}.supabase.co/functions/v1/ghl-oauth-callback`}
                            />
                            <p className="text-[10px] text-muted-foreground">Deixe em branco para usar o padrão gerado automaticamente.</p>
                        </div>
                        <Button onClick={handleSaveGHL} disabled={isSaving} className="w-full sm:w-auto">
                            <Save className="h-4 w-4 mr-2" /> Salvar GHL
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
