'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, Unplug, Save, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Api4ComConfig {
    token: string;
    defaultExtension: string;
    baseUrl?: string;
}

interface Api4ComStatus {
    connected: boolean;
    config: Api4ComConfig | null;
}

export function Api4ComIntegration() {
    const [status, setStatus] = useState<Api4ComStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    // Form states
    const [token, setToken] = useState('');
    const [defaultExtension, setDefaultExtension] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    
    const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

    const { toast } = useToast();

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const response = await fetch('/api/v1/integrations/api4com/status');
            if (response.ok) {
                const data: Api4ComStatus = await response.json();
                setStatus(data);
                if (data.connected && data.config) {
                    setToken(data.config.token || '');
                    setDefaultExtension(data.config.defaultExtension || '');
                    setBaseUrl(data.config.baseUrl || '');
                }
            } else {
                setStatus({ connected: false, config: null });
            }
        } catch (error) {
            console.error('Error checking API4COM status:', error);
            setStatus({ connected: false, config: null });
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        if (!token || !defaultExtension) {
            toast({ title: 'Erro', description: 'Preencha o Token e o Ramal.', variant: 'destructive' });
            return;
        }

        setConnecting(true);
        try {
            const response = await fetch('/api/v1/integrations/api4com/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, defaultExtension, baseUrl }),
            });

            if (response.ok) {
                toast({ title: 'Sucesso', description: 'API4COM configurada com sucesso!' });
                await checkStatus();
            } else {
                const data = await response.json();
                toast({ title: 'Erro', description: data.error || 'Falha ao conectar.', variant: 'destructive' });
            }
        } catch (error) {
            console.error('Error connecting API4COM:', error);
            toast({ title: 'Erro', description: 'Erro de conexão.', variant: 'destructive' });
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setIsDisconnectDialogOpen(false);
        setDisconnecting(true);
        try {
            const response = await fetch('/api/v1/integrations/api4com/disconnect', {
                method: 'POST',
            });

            if (response.ok) {
                toast({ title: 'Desconectado', description: 'Integração API4COM removida.' });
                setStatus({ connected: false, config: null });
                setToken('');
                setDefaultExtension('');
                setBaseUrl('');
            } else {
                toast({ title: 'Erro', description: 'Falha ao desconectar.', variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'Erro', description: 'Erro ao desconectar.', variant: 'destructive' });
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        return (
            <Card className="bg-white dark:bg-white/[0.02] border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-sm dark:shadow-2xl">
                <CardContent className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white dark:bg-white/[0.02] border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-sm dark:shadow-2xl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Phone className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg text-zinc-900 dark:text-white">API4COM (Telefonia)</CardTitle>
                            <CardDescription className="text-zinc-500 dark:text-zinc-400 mt-1">
                                Conecte sua conta API4COM para habilitar o recurso de Click-to-Call direto pelo MasterIA.
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={status?.connected ? 'default' : 'secondary'} className="gap-1">
                        {status?.connected ? (
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
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Configure as credenciais para permitir ligações com um clique na tela de Atendimentos:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Ao clicar em Ligar, seu ramal tocará primeiro.</li>
                        <li>Ao atender, a chamada será conectada ao contato.</li>
                        <li>As ligações são registradas automaticamente no histórico.</li>
                    </ul>

                    <div className="space-y-3 border rounded-lg p-4">
                        <div className="space-y-2">
                            <Label htmlFor="api4com-token">Token da API</Label>
                            <Input
                                id="api4com-token"
                                type="password"
                                placeholder="Insira o Token de Autenticação da API4COM"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Obtenha o token no painel administrativo da API4COM.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="api4com-ramal">Ramal Padrão (Origem)</Label>
                            <Input
                                id="api4com-ramal"
                                placeholder="Ex: 200"
                                value={defaultExtension}
                                onChange={(e) => setDefaultExtension(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                O ramal do atendente que será chamado primeiro.
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="api4com-url">URL da API (Opcional)</Label>
                            <Input
                                id="api4com-url"
                                placeholder="https://suaempresa.api4com.com/v1"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Deixe em branco para usar o padrão, ou insira a URL dedicada exibida no seu painel.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button onClick={handleConnect} disabled={connecting || !token || !defaultExtension} className="w-full sm:w-auto">
                            {connecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {status?.connected ? 'Salvando...' : 'Conectando...'}
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    {status?.connected ? 'Salvar Configuração' : 'Conectar API4COM'}
                                </>
                            )}
                        </Button>
                        
                        {status?.connected && (
                            <Button variant="outline" size="sm" onClick={() => setIsDisconnectDialogOpen(true)} disabled={disconnecting} className="text-red-600 hover:text-red-700">
                                {disconnecting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Unplug className="mr-2 h-4 w-4" />
                                )}
                                Desconectar
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>

            <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover Configuração API4COM?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja remover as credenciais da API4COM? O botão de "Ligar para o Contato" deixará de funcionar.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sim, Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
