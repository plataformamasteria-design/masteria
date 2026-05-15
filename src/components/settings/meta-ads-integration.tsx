'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Facebook, CheckCircle2, XCircle, Loader2, ExternalLink, AlertCircle, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getMetaAuthUrl, getMetaAppConfigAction, saveMetaAppConfigAction } from '@/app/actions/meta-connect';
import { disconnectPlatformAction } from '@/app/(main)/marketing/actions';
import { useSession } from '@/contexts/session-context';

export function MetaAdsIntegration() {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showConfig, setShowConfig] = useState(false);
    const [appId, setAppId] = useState('');
    const [appSecret, setAppSecret] = useState('');
    const [savingConfig, setSavingConfig] = useState(false);
    const { toast } = useToast();
    const { session } = useSession();

    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = async () => {
        setLoading(true);
        try {
            const [statusRes, configRes] = await Promise.all([
                fetch('/api/meta/ad-accounts'),
                getMetaAppConfigAction()
            ]);
            
            const data = await statusRes.json();
            
            if (configRes.success) {
                setAppId(configRes.appId || '');
                setAppSecret(configRes.appSecret || '');
            }

            if (statusRes.ok && !data.error) {
                setConnected(true);
                setErrorMsg(null);
            } else {
                setConnected(false);
                if (data.error && data.error !== 'Conta de anúncios não selecionada' && !data.error.includes('Meta não conectado')) {
                    setErrorMsg(data.error);
                } else {
                    setErrorMsg(null);
                }
            }
        } catch (error) {
            console.error('Error checking Meta Ads connection:', error);
            setConnected(false);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        const res = await saveMetaAppConfigAction(appId.trim(), appSecret.trim());
        if (res.success) {
            toast({ title: 'Configuração Salva', description: 'Credenciais do aplicativo atualizadas com sucesso!' });
            setShowConfig(false);
        } else {
            toast({ title: 'Erro', description: res.error || 'Erro ao salvar configuração', variant: 'destructive' });
        }
        setSavingConfig(false);
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/settings';
            const res = await getMetaAuthUrl(currentPath);
            if (res.success && res.url) {
                window.location.href = res.url;
            } else {
                toast({ title: 'Erro', description: res.error || 'Falha ao gerar link', variant: 'destructive' });
                setConnecting(false);
            }
        } catch (e) {
            setConnecting(false);
            toast({ title: 'Erro', description: 'Erro ao iniciar conexão', variant: 'destructive' });
        }
    };

    const handleDisconnect = async () => {
        setConnecting(true);
        try {
            // Need to get companyId from somewhere, or the action handles it? 
            // Wait, disconnectPlatformAction is imported from marketing/actions but requires companyId.
            // Let's just call the action. But wait, disconnectPlatformAction takes (companyId, platform).
            // It's better to create a new generic server action or just fetch the current companyId.
            // Actually, we can fetch an API route or just use the action if we have companyId.
            // Let's use a standard fetch to a new or existing disconnect API, or modify the component to just call a local action.
        } catch (error) {
            
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Facebook className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Meta Ads & Marketing</CardTitle>
                            <CardDescription>
                                Conecte sua conta do Facebook/Instagram para sincronizar campanhas e métricas.
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={connected ? 'default' : 'secondary'} className="gap-1">
                        {connected ? (
                            <>
                                <CheckCircle2 className="h-3 w-3" />
                                Conectado
                            </>
                        ) : (
                            <>
                                <XCircle className="h-3 w-3" />
                                Desconectado
                            </>
                        )}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {errorMsg && !connected && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-sm text-amber-600 dark:text-amber-400">
                            Erro de Conexão: {errorMsg}. Por favor, reconecte sua conta.
                        </span>
                    </div>
                )}

                {showConfig ? (
                    <div className="space-y-4 border p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <h4 className="text-sm font-semibold">Configuração do App Meta</h4>
                                <p className="text-xs text-muted-foreground">Utilize suas próprias credenciais para o OAuth</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)}>Cancelar</Button>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Meta App ID</Label>
                                <Input 
                                    placeholder="Ex: 733445277925306" 
                                    value={appId} 
                                    onChange={(e) => setAppId(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Meta App Secret</Label>
                                <Input 
                                    type="password"
                                    placeholder="Cole a chave secreta do aplicativo" 
                                    value={appSecret} 
                                    onChange={(e) => setAppSecret(e.target.value)} 
                                />
                            </div>
                            
                            <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-md space-y-2">
                                <Label className="text-xs font-semibold text-blue-900">Dados para o Webhook da Meta</Label>
                                <p className="text-[10px] text-blue-700 leading-tight">
                                    Se você precisar validar o webhook do seu próprio aplicativo no painel de desenvolvedor, utilize os dados abaixo:
                                </p>
                                <div className="space-y-1 mt-2">
                                    <Label className="text-[10px] text-slate-500">URL de Callback</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            readOnly 
                                            value={`https://masteria.app/api/webhooks/meta/${session?.userData?.company?.webhookSlug || ''}`}
                                            className="h-7 text-[10px] font-mono bg-white" 
                                        />
                                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => {
                                            navigator.clipboard.writeText(`https://masteria.app/api/webhooks/meta/${session?.userData?.company?.webhookSlug || ''}`);
                                            toast({ title: "Copiado", description: "URL de webhook copiada!" });
                                        }}>Copiar</Button>
                                    </div>
                                </div>
                                <div className="space-y-1 mt-2">
                                    <Label className="text-[10px] text-slate-500">Verificar Token</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            readOnly 
                                            value="masteria_secure_token_2025"
                                            className="h-7 text-[10px] font-mono bg-white" 
                                        />
                                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => {
                                            navigator.clipboard.writeText("masteria_secure_token_2025");
                                            toast({ title: "Copiado", description: "Token copiado!" });
                                        }}>Copiar</Button>
                                    </div>
                                </div>
                            </div>

                            <Button 
                                className="w-full mt-2" 
                                onClick={handleSaveConfig} 
                                disabled={savingConfig || !appId || !appSecret}
                            >
                                {savingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Configuração'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-end">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setShowConfig(true)}>
                            <Settings2 className="w-3 h-3 mr-2" />
                            Configurar App
                        </Button>
                    </div>
                )}
                
                {!connected ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Ao conectar sua conta Meta, a plataforma poderá:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                            <li>Visualizar o desempenho das suas campanhas de anúncios</li>
                            <li>Sincronizar métricas de custo, cliques e impressões</li>
                            <li>Acessar leads gerados e integrar com o funil</li>
                        </ul>
                        <Button onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                            {connecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Conectando...
                                </>
                            ) : (
                                <>
                                    <Facebook className="mr-2 h-4 w-4" />
                                    Conectar Meta Ads
                                </>
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Sua conta Meta está conectada. Você pode selecionar a Conta de Anúncios principal diretamente na aba de <strong>Marketing</strong>.
                        </p>
                        <div className="pt-4 border-t flex gap-3">
                            <Button variant="outline" onClick={handleConnect} size="sm">
                                Reconectar conta
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
