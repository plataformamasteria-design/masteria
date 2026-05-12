import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GhlSso() {
    const navigate = useNavigate();
    const processed = useRef(false);
    const [status, setStatus] = useState("Iniciando Handshake com GHL...");

    useEffect(() => {
        if (processed.current) return;

        const handleSSOResponse = async (event: MessageEvent) => {
            // Support both 'name' and 'message' (GHL sometimes uses different object shapes)
            const eventName = event.data.name || event.data.message;
            if (eventName === "REQUEST_USER_DATA_RESPONSE") {
                processed.current = true;
                window.removeEventListener("message", handleSSOResponse);

                const encryptedPayload = event.data.data || event.data.payload;
                if (!encryptedPayload) {
                    setStatus("Erro crítico: Payload não recebido do GoHighLevel");
                    toast.error("Payload vazio retornado pelo GHL");
                    return;
                }

                setStatus("Identidade recebida. Validando sessão com a Nuvem...");

                try {
                    const { data, error } = await supabase.functions.invoke('ghl-sso', {
                        headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
                        body: { payload: encryptedPayload }
                    });

                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);

                    setStatus("Sessão validada. Efetuando login...");

                    // Sucesso! A Edge Function gerou um Magic Link de Sessão.
                    // Redirecionamos para o Magic Link. O Supabase cuidará de autenticar 
                    // a sessão e logo redirecionará para a raiz ou /crm.
                    if (data?.redirect_url) {
                        window.location.href = data.redirect_url;
                    } else {
                        navigate('/crm');
                    }
                } catch (err: any) {
                    console.error("GHL SSO Error", err);
                    setStatus(`Acesso Recusado: ${err.message}`);
                    toast.error(err.message, { duration: 5000 });
                }
            }
        };

        // Listen for the response
        window.addEventListener("message", handleSSOResponse);

        // Dispara a requisição para o GHL (A janela pai, iFrame)
        window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
        // Backup try with 'name' as well
        window.parent.postMessage({ name: "REQUEST_USER_DATA" }, "*");

        // Timeout fallback for debugging
        setTimeout(() => {
            if (!processed.current) {
                setStatus("GoHighLevel não respondeu ao Handshake (Você está dentro de um iFrame?)");
            }
        }, 8000);

        return () => {
            window.removeEventListener("message", handleSSOResponse);
        };
    }, [navigate]);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Autenticando via GoHighLevel</h2>
            <p className="text-muted-foreground text-center max-w-sm">
                {status}
            </p>
        </div>
    );
}
