import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserOrganizationId } from "@/lib/organization-helpers";
import { CheckCircle2, XCircle, Link2, Unlink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function GoogleCalendarConfig() {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('google_calendar_config')
        .select('is_connected')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setIsConnected(data.is_connected);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      toast({
        title: "Conectando...",
        description: "Iniciando autenticação com Google Calendar",
      });

      // TODO: Implementar OAuth flow via edge function
      // Por enquanto, apenas simula conexão
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const organizationId = await getCurrentUserOrganizationId();

      const { error } = await supabase
        .from('google_calendar_config')
        .upsert([{
          user_id: user.id,
          organization_id: organizationId,
          is_connected: true,
        }]);

      if (error) throw error;

      setIsConnected(true);
      toast({
        title: "Conectado!",
        description: "Google Calendar conectado com sucesso",
      });
    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: "Erro",
        description: "Falha ao conectar com Google Calendar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('google_calendar_config')
        .update({ is_connected: false })
        .eq('user_id', user.id);

      if (error) throw error;

      setIsConnected(false);
      toast({
        title: "Desconectado",
        description: "Google Calendar desconectado",
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Erro",
        description: "Falha ao desconectar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Integração Google Calendar</CardTitle>
                {isConnected ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Conectado</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    <span>Desconectado</span>
                  </div>
                )}
              </div>
            </div>
            <CardDescription>
              Sincronize seus eventos com o Google Calendar
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-id">Google Client ID</Label>
                <Input
                  id="client-id"
                  placeholder="Seu Client ID do Google"
                  disabled={isConnected}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-secret">Google Client Secret</Label>
                <Input
                  id="client-secret"
                  type="password"
                  placeholder="Seu Client Secret do Google"
                  disabled={isConnected}
                />
              </div>

              <div className="flex gap-2">
                {isConnected ? (
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={loading}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    onClick={handleConnect}
                    disabled={loading}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Conectar com Google
                  </Button>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Para obter as credenciais, acesse o{" "}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Cloud Console
                </a>
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
