import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { CheckCircle2, Settings, AlertTriangle } from "lucide-react";
import { WhatsAppCloudConfigDialog } from "@/components/chat/WhatsAppCloudConfigDialog";

export function WaCloudSettings() {
    const { currentOrganization } = useOrganization();
    const [showConfigDialog, setShowConfigDialog] = useState(false);

    const settings = (currentOrganization?.settings || {}) as Record<string, unknown>;
    const isConfigured = !!(settings.whatsapp_cloud_waba_id && settings.whatsapp_cloud_phone_number_id);

    return (
        <div className="space-y-4">
            {isConfigured ? (
                <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                Conectado ao WhatsApp Oficial
                            </p>
                            <p className="text-xs text-green-600/80 dark:text-green-400/80">
                                WABA ID: {settings.whatsapp_cloud_waba_id as string}
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowConfigDialog(true)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Gerenciar
                    </Button>
                </div>
            ) : (
                <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div>
                            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                WhatsApp API não configurado
                            </p>
                            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
                                Necessário para Campanhas Oficiais.
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => setShowConfigDialog(true)}>
                        Configurar Agora
                    </Button>
                </div>
            )}

            <WhatsAppCloudConfigDialog
                open={showConfigDialog}
                onOpenChange={setShowConfigDialog}
            />
        </div>
    );
}
