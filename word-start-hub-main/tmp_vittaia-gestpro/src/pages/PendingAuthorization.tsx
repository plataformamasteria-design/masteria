import { Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import vittaIcon from "@/assets/vitta-icon.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const PendingAuthorization = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const queryClient = useQueryClient();

  // Verificar periodicamente se o usuário foi aprovado
  useEffect(() => {
    const checkApproval = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // Verificar se tem permissões agora
      const { data: permissions } = await (supabase as any)
        .from('user_page_permissions')
        .select('page')
        .eq('user_id', user.id);

      if (permissions && permissions.length > 0) {
        queryClient.clear();
        navigate("/dashboard");
      }
    };

    // Verificar a cada 30 segundos
    const interval = setInterval(checkApproval, 30000);

    return () => clearInterval(interval);
  }, [navigate, queryClient]);

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        navigate("/auth");
        return;
      }

      // Verificar se tem permissões agora
      const { data: permissions } = await (supabase as any)
        .from('user_page_permissions')
        .select('page')
        .eq('user_id', user.id);

      if (permissions && permissions.length > 0) {
        queryClient.clear();
        navigate("/dashboard");
      }
    } catch (error) {
      console.error('Error checking approval:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background selection:bg-primary/20 overflow-hidden text-foreground">
      {/* ElevenLabs Style Subtle Mesh Background */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-accent/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[420px] z-10 animate-slide-up" style={{ animationDuration: '600ms', animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center p-1 mb-8">
            <img src={vittaIcon} alt="Vitta" className="h-10 w-auto opacity-90 drop-shadow-sm" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3 font-heading">
            Acesso Restrito
          </h1>
          <p className="text-muted-foreground text-sm font-medium tracking-wide">
            Sua conta está em nossa fila de aprovação
          </p>
        </div>

        <Card className="border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
          <CardContent className="p-10 text-center">
            <div className="flex justify-center mb-8 relative">
              <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="w-20 h-20 bg-background/50 border border-border/50 rounded-2xl flex items-center justify-center relative shadow-inner">
                <Clock className="h-10 w-10 text-primary animate-pulse" />
              </div>
            </div>

            <div className="space-y-4 mb-10">
              <h2 className="text-xl font-bold tracking-tight font-heading">Aguardando Autorização</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Olá! Sua conta foi criada com sucesso. Por motivos de segurança, cada novo acesso deve ser validado por um administrador da **Vitta Intelligence**.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                variant="default"
                onClick={handleCheckAgain}
                className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg shadow-sm transition-all"
                disabled={checking}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Validando Acesso...' : 'Verificar Status'}
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full h-11 text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                Sair da conta
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-border/20">
              <p className="text-[10px] uppercase font-bold tracking-[0.15em] text-muted-foreground/40">
                Verificação automática ativa
              </p>
            </div>
          </CardContent>
        </Card>

        <footer className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/40">
            &copy; {new Date().getFullYear()} Vitta Security Protocol
          </p>
        </footer>
      </div>
    </div>
  );
};

export default PendingAuthorization;
