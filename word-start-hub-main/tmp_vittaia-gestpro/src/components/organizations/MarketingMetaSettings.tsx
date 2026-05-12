import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Facebook, Loader2, Copy, Link2, ExternalLink, PlugZap, KeyRound, ChevronDown } from 'lucide-react';

/**
 * Global Meta Marketing settings for the Integrações tab in Profile/Settings.
 * Manages Meta App ID, App Secret, OAuth URIs, and manual token connection.
 * The Ad Account ID is set separately on the Marketing page.
 */
export function MarketingMetaSettings() {
    const { currentOrganization, refreshOrganizations } = useOrganization();
    const { updateOrganization } = useOrganizations();
    const { toast } = useToast();

    const [connecting, setConnecting] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const [connectingManual, setConnectingManual] = useState(false);
    const [showManual, setShowManual] = useState(false);

    // Check if marketing meta is connected
    const [isConnected, setIsConnected] = useState(false);
    useEffect(() => {
        if (!currentOrganization?.id) return;
        (async () => {
            const { data } = await (supabase as any)
                .from('marketing_credentials')
                .select('status')
                .eq('organization_id', currentOrganization.id)
                .eq('platform', 'meta')
                .single();
            setIsConnected(data?.status === 'connected');
        })();
    }, [currentOrganization?.id]);

    const loginMeta = async () => {
        if (!currentOrganization?.id) return;
        setConnecting(true);
        try {
            const res = await supabase.functions.invoke('marketing-oauth?action=meta-auth-url', {
                body: { organization_id: currentOrganization.id },
            });
            if (res.data?.auth_url) {
                window.location.href = res.data.auth_url;
            } else {
                toast({ title: "Erro", description: res.data?.error || "Não foi possível gerar URL", variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
        setConnecting(false);
    };

    const connectManualToken = async () => {
        if (!currentOrganization?.id || !manualToken.trim()) return;
        setConnectingManual(true);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const response = await fetch(`${supabaseUrl}/functions/v1/marketing-oauth?action=meta-manual-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
                body: JSON.stringify({ organization_id: currentOrganization.id, access_token: manualToken.trim() }),
            });
            const data = await response.json();
            if (data.success) {
                toast({ title: '✅ Meta Marketing Conectado!', description: data.message });
                setManualToken('');
                setShowManual(false);
                setIsConnected(true);
            } else {
                toast({ title: 'Erro', description: data.error || 'Falha', variant: 'destructive' });
            }
        } catch (e: any) {
            toast({ title: 'Erro', description: e.message, variant: 'destructive' });
        }
        setConnectingManual(false);
    };

    const disconnect = async () => {
        if (!currentOrganization?.id) return;
        await supabase.functions.invoke('marketing-api', {
            body: { action: 'disconnect', organization_id: currentOrganization.id, platform: 'meta' },
        });
        setIsConnected(false);
        toast({ title: "Meta Marketing desconectado" });
    };

    return (
        <div className="space-y-4">
            {isConnected && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                        <PlugZap className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Meta Marketing conectado</span>
                    </div>
                    <Button variant="destructive" size="sm" onClick={disconnect}>Desconectar</Button>
                </div>
            )}

            {/* Save + Login */}
            <div className="flex flex-col gap-4">
                <div className="bg-muted/30 p-4 rounded-xl text-xs text-muted-foreground border border-white/5">
                    <strong>Integração Plataforma:</strong> Ao conectar sua conta do Facebook e Instagram, importaremos campanhas, engajamento e liberaremos a IA para gerar novas audiências e copy de anúncios automaticamente.
                </div>

                {!isConnected && (
                    <Button onClick={loginMeta} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto" disabled={connecting}>
                        {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Facebook className="w-4 h-4 mr-2" />}
                        Entrar com Facebook / Instagram
                    </Button>
                )}
            </div>

            {/* Manual token */}
            {!isConnected && (
                <div className="border-t pt-3">
                    <button onClick={() => setShowManual(!showManual)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                        <KeyRound className="w-3 h-3" />
                        <span>Conectar com Token Manual (Avançado)</span>
                        <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showManual ? 'rotate-180' : ''}`} />
                    </button>
                    {showManual && (
                        <div className="mt-3 space-y-3 p-3 rounded-lg border bg-muted/30">
                            <p className="text-[10px] text-muted-foreground">Token gerado externamente pelo Graph Explorer com permissões de leitura.</p>
                            <textarea value={manualToken} onChange={e => setManualToken(e.target.value)}
                                placeholder="Cole aqui o token gerado..."
                                className="w-full h-16 text-[10px] font-mono p-2 rounded-md border bg-background resize-none" />
                            <Button size="sm" className="w-full" disabled={connectingManual || !manualToken.trim()}
                                onClick={connectManualToken}>
                                {connectingManual ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <KeyRound className="w-3 h-3 mr-1" />}
                                Validar Token Manual
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
