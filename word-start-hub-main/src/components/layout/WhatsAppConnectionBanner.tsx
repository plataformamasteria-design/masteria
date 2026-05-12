import React, { useEffect, useState } from "react";
import { AlertCircle, WifiOff } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

export function WhatsAppConnectionBanner() {
    const { currentOrganization } = useOrganization();
    const [isDisconnected, setIsDisconnected] = useState(false);

    useEffect(() => {
        if (!currentOrganization?.id) return;

        // Check initial state
        const checkInitialState = async () => {
            const { data } = await supabase
                .from("organizations")
                .select("settings")
                .eq("id", currentOrganization.id)
                .single();

            if (data?.settings?.whatsapp_connection?.status === "disconnected") {
                setIsDisconnected(true);
            } else {
                setIsDisconnected(false);
            }
        };

        checkInitialState();

        // Subscribe to changes
        const channel = supabase
            .channel(`org_settings_changes`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "organizations",
                    filter: `id=eq.${currentOrganization.id}`,
                },
                (payload) => {
                    const newSettings = payload.new?.settings;
                    if (newSettings?.whatsapp_connection?.status === "disconnected") {
                        setIsDisconnected(true);
                    } else {
                        setIsDisconnected(false);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentOrganization?.id]);

    if (!isDisconnected) return null;

    return (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium z-50 animate-in fade-in slide-in-from-top-4 w-full sticky top-0 shadow-md">
            <WifiOff className="h-5 w-5 animate-pulse" />
            <span>
                ALERTA CRÍTICO: O WhatsApp está DESCONECTADO! Novas mensagens e automações estão paralisadas. Escaneie o QR Code novamente para restabelecer a conexão.
            </span>
        </div>
    );
}
