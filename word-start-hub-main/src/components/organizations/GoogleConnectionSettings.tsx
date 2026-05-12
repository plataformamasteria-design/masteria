import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { supabase, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Mail, CheckCircle2, XCircle, ShieldCheck, Calendar, Store, HardDrive, FileSpreadsheet } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

export function GoogleConnectionSettings() {
  const { currentOrganization } = useOrganization();
  const { updateOrganization } = useOrganizations();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<'disconnected' | 'connected' | 'checking'>('checking');
  const [connectedEmail, setConnectedEmail] = useState('');
  const [savingModules, setSavingModules] = useState(false);

  const orgId = currentOrganization?.id;

  const googleModules = (currentOrganization?.settings as any)?.google_active_modules || {
    agenda: true,
    gmail: true,
    gmb: true,
    drive: false,
    sheets: false
  };

  const handleToggleModule = async (moduleName: string, value: boolean) => {
    if (!orgId || !currentOrganization) return;
    setSavingModules(true);
    try {
      const currentSettings = (currentOrganization.settings || {}) as Record<string, any>;
      const newModules = { ...googleModules, [moduleName]: value };
      const newSettings = { ...currentSettings, google_active_modules: newModules };

      await updateOrganization(orgId, { settings: newSettings } as any);
      toast({ title: "Módulos atualizados!" });
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar módulos', description: e.message, variant: 'destructive' });
    } finally {
      setSavingModules(false);
    }
  };

  useEffect(() => {
    if (orgId) checkConnectionStatus();
  }, [orgId]);

  const checkConnectionStatus = async () => {
    if (!orgId) return;
    setStatus('checking');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('disconnected');
        return;
      }

      const { data } = await supabase.functions.invoke('google-api', {
        headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
        body: { action: 'check_connection', organization_id: orgId, user_id: user.id }
      });
      if (data?.connected) {
        setStatus('connected');
        setConnectedEmail(data.email || 'Conectado');
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('disconnected');
    }
  };

  const handleConnect = async () => {
    if (!orgId) return;
    setConnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke('google-api', {
        headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
        body: {
          action: 'get_auth_url',
          organization_id: orgId,
          user_id: user.id,
          redirect_uri: `${window.location.origin}/google-auth-callback`,
        }
      });
      console.log('google-api get_auth_url response:', { data, error });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (e: any) {
      console.error('Google Auth Error:', e);
      toast({ title: 'Erro de Autenticação', description: e.message || 'Não foi possível se conectar ao Google.', variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!orgId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.functions.invoke('google-api', {
        headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
        body: { action: 'disconnect', organization_id: orgId, user_id: user.id }
      });
      setStatus('disconnected');
      setConnectedEmail('');
      toast({ title: 'Desconectado', description: 'Sistema Google desconectado.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Ecossistema Google</h2>
        <p className="text-sm text-muted-foreground">
          Conecte sua conta do Google para utilizar Gmail, Google Calendar (com Meets) e Google Meu Negócio de uma vez só!
        </p>
      </div>

      <Card className="border-border/50 glass overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <div className="flex gap-4">
            <Mail className="h-24 w-24 text-blue-500" />
          </div>
        </div>

        <CardHeader className="pb-4 relative">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Conexão Cloud Universal
          </CardTitle>
          <CardDescription>
            Fazemos o uso das permissões estritamente necessárias. Autentique-se uma vez e o VittaIA gerenciará sua agenda, lerá caixas de email do time de vendas e poderá responder avaliações na rede Meu Negócio.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="max-w-2xl">
        <Card className="border-border/50 bg-background/50 backdrop-blur-sm">
          <CardHeader className="pb-3 border-b border-white/5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              Conta Master Google
            </CardTitle>
            <CardDescription className="text-xs">
              Você autorizará o acesso ao Calendário do CRM e ao GMB do Local
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {status === 'checking' ? (
              <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : status === 'connected' ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-2">
                    <div>
                      <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">Ecossistema Conectado</p>
                      <p className="text-sm text-emerald-600/80 dark:text-emerald-500 truncate">{connectedEmail}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-destructive hover:bg-destructive/10 h-8 text-[10px]">
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Desconectar Sistema
                    </Button>
                  </div>
                </div>

                <Separator className="bg-white/5" />

                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground/80">Painel de Módulos (Google Workspace)</h3>
                  <div className="grid gap-3">

                    {[
                      { id: 'agenda', name: 'Google Agenda', desc: 'Sincronizar CRM e criar links do Meet automáticos', icon: Calendar },
                      { id: 'gmail', name: 'Gmail Enterprise', desc: 'Permitir que a IA leia caixas de entrada e envie resumos', icon: Mail },
                      { id: 'gmb', name: 'Google Meu Negócio', desc: 'Gerenciamento de reputação e resposta a avaliações', icon: Store },
                      { id: 'drive', name: 'Google Drive', desc: 'Armazenamento de mídias, relatórios e faturas auto-geradas', icon: HardDrive },
                      { id: 'sheets', name: 'Google Planilhas', desc: 'Sincronizar base de dados de Leads exportados', icon: FileSpreadsheet },
                    ].map(module => (
                      <div key={module.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-background border border-white/5 shadow-sm">
                            <module.icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{module.name}</span>
                            <span className="text-[10px] text-muted-foreground max-w-[200px] sm:max-w-none">{module.desc}</span>
                          </div>
                        </div>
                        <Switch
                          checked={googleModules[module.id] ?? false}
                          onCheckedChange={(val) => handleToggleModule(module.id, val)}
                          disabled={savingModules}
                          className="scale-90"
                        />
                      </div>
                    ))}

                  </div>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full sm:w-auto bg-[#ea4335] hover:bg-[#d93025] text-white px-8"
                size="lg"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Conectar Conta Google
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
