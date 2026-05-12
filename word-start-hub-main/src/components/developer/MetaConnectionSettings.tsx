import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Facebook, Instagram, Loader2, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface MetaConnection {
  id: string;
  page_id: string;
  page_name: string;
  instagram_business_account_id: string | null;
  instagram_username: string | null;
  is_active: boolean;
  connected_at: string;
  token_expires_at: string | null;
}

export function MetaConnectionSettings() {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const [connections, setConnections] = useState<MetaConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const orgId = currentOrganization?.id;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'jrxpjzgifyzhvwjfpofz';

  useEffect(() => {
    if (orgId) fetchConnections();
  }, [orgId]);

  const fetchConnections = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meta_connections')
        .select('id, page_id, page_name, instagram_business_account_id, instagram_username, is_active, connected_at, token_expires_at')
        .eq('organization_id', orgId)
        .eq('is_active', true);

      if (!error) setConnections(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!orgId) return;

    setConnecting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/meta-oauth-callback?action=auth-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ organization_id: orgId }),
      });

      const result = await response.json();

      if (result.error) {
        toast({ title: 'Erro de Conexão', description: result.error, variant: 'destructive' });
        return;
      }

      if (result.auth_url) {
        window.location.href = result.auth_url;
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectIg = async () => {
    if (!orgId) return;
    setConnecting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/meta-oauth-callback?action=ig-auth-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ organization_id: orgId }),
      });

      const result = await response.json();
      if (result.error) {
        toast({ title: 'Erro de Conexão', description: result.error, variant: 'destructive' });
        return;
      }
      if (result.auth_url) {
        window.location.href = result.auth_url;
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!orgId) return;
    try {
      const { error } = await supabase
        .from('meta_connections')
        .delete()
        .eq('id', connectionId)
        .eq('organization_id', orgId);

      if (error) throw error;

      setConnections(prev => prev.filter(c => c.id !== connectionId));
      toast({ title: 'Desconectado', description: 'Página desconectada com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Facebook & Instagram</h2>
        <p className="text-sm text-muted-foreground">
          Conecte suas páginas do Facebook e contas do Instagram Business para habilitar atendimento automático
          e captação de leads.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Facebook Method */}
        <Card className="border-border/50 glass overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Facebook className="h-32 w-32" />
          </div>

          <CardHeader className="pb-4 relative">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              Página e Instagram
            </CardTitle>
            <CardDescription>
              Acesso via Página do Facebook (Ideal para quem usa os dois canais simultaneamente).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 relative">
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white shadow-lg shrink-0"
            >
              {connecting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Facebook className="h-5 w-5 mr-2" />
              )}
              {connecting ? 'Conectando...' : 'Conectar com Facebook'}
            </Button>
          </CardContent>
        </Card>

        {/* IG Direct Method */}
        <Card className="border-border/50 glass overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Instagram className="h-32 w-32" />
          </div>

          <CardHeader className="pb-4 relative">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-pink-500" />
              Apenas Instagram
            </CardTitle>
            <CardDescription>
              Método direto independente. (Use se não tiver página no Facebook ou preferir isolar as contas).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 relative">
            <Button
              onClick={handleConnectIg}
              disabled={connecting}
              variant="outline"
              className="w-full border-pink-500/30 hover:bg-pink-500/10 text-pink-500 dark:text-pink-400 shrink-0"
            >
              {connecting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Instagram className="h-5 w-5 mr-2" />
              )}
              {connecting ? 'Conectando...' : 'Conectar apenas Instagram'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Connected Pages */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length > 0 ? (
        <Card className="border-border/50">
          <CardHeader className="pb-3 border-b border-white/5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Conexões Ativas e Monitoradas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {connections.map((conn) => {
              const isIgOnly = conn.page_id.startsWith('ig_only_');
              return (
                <div key={conn.id} className="flex items-center justify-between p-4 bg-background/50 border border-white/10 rounded-xl hover:bg-background/80 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col gap-2">
                      {isIgOnly ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Instagram className="h-4 w-4 text-pink-500 shrink-0" />
                            <span className="text-sm font-semibold truncate">@{conn.instagram_username}</span>
                            <Badge variant="secondary" className="text-[10px] bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 px-2 border-0">Instagram Isolado</Badge>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Facebook className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="text-sm font-semibold truncate">{conn.page_name}</span>
                            <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-2 border-0">Facebook Page</Badge>
                          </div>
                          {conn.instagram_username && (
                            <div className="flex items-center gap-2 pl-6 relative">
                              <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-px bg-border"></div>
                              <div className="absolute left-1.5 -top-3 w-px h-5 bg-border"></div>
                              <Instagram className="h-4 w-4 text-pink-500 shrink-0" />
                              <span className="text-xs font-medium">@{conn.instagram_username}</span>
                              <Badge variant="secondary" className="text-[10px] bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 px-2 border-0">Instagram Profissional</Badge>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDisconnect(conn.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Desconectar
                    </Button>
                    {conn.token_expires_at && (
                      <span className="text-[9px] text-muted-foreground font-mono">
                        Token Válido até {new Date(conn.token_expires_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
