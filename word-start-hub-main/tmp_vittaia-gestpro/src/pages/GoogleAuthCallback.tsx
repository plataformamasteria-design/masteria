import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function GoogleAuthCallback() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { currentOrganization } = useOrganization();
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;

        const exchangeCode = async () => {
            processed.current = true;
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const state = params.get('state');

            if (!code) {
                toast({ title: 'Erro de Autenticação', description: 'Nenhum código recebido do Google.', variant: 'destructive' });
                navigate('/profile');
                return;
            }

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Usuário não autenticado para completar a integração.");

                const organizationId = state || currentOrganization?.id;
                if (!organizationId) throw new Error("Organização não identificada.");

                // Clean URL quickly so code isn't lingering
                window.history.replaceState({}, '', '/google-auth-callback');

                const { data, error } = await supabase.functions.invoke('google-api', {
                    headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
                    body: {
                        action: 'exchange_code',
                        organization_id: organizationId,
                        user_id: user.id,
                        code,
                        redirect_uri: `${window.location.origin}/google-auth-callback`,
                    }
                });

                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                toast({
                    title: 'Ecossistema Conectado!',
                    description: 'A VittaIA agora gerencia sua agenda, e-mails e Google Meu Negócio.'
                });
            } catch (err: any) {
                console.error("Auth erro:", err);
                toast({
                    title: 'Falha na Autenticação Google',
                    description: err.message,
                    variant: 'destructive'
                });
            } finally {
                // Redireciona de volta para Configurações (Tenant)
                navigate('/profile');
            }
        };

        exchangeCode();
    }, [currentOrganization, navigate, toast]);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <h2 className="text-xl font-semibold">Conectando ao Ecossistema Google...</h2>
            <p className="text-muted-foreground">Configurando Meu Negócio, Agenda e Gmail. Aguarde um instante.</p>
        </div>
    );
}
