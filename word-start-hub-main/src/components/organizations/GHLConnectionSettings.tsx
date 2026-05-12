import { useState, useEffect } from "react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ExternalLink, Link2, RefreshCw, Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface GHLConnectionSettingsProps {
    organizationId: string;
}

export function GHLConnectionSettings({ organizationId }: GHLConnectionSettingsProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [connection, setConnection] = useState<any>(null);
    const [globalConfig, setGlobalConfig] = useState<any>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncType, setSyncType] = useState("all");
    const [conversationProviderId, setConversationProviderId] = useState("");
    const [isSavingProvider, setIsSavingProvider] = useState(false);
    const [strictAgentIsolation, setStrictAgentIsolation] = useState(false);
    const [isSavingIsolation, setIsSavingIsolation] = useState(false);

    useEffect(() => {
        if (organizationId) {
            loadData();
        }
    }, [organizationId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load Global Config (to get Client ID for OAuth)
            const { data: config } = await (supabase as any)
                .from("ghl_global_config")
                .select("*")
                .limit(1)
                .maybeSingle();
            setGlobalConfig(config);

            // Load specific connection for this org
            const { data: conn } = await (supabase as any)
                .from("ghl_connections")
                .select("*")
                .eq("organization_id", organizationId)
                .maybeSingle();
            setConnection(conn);
            setConversationProviderId(conn?.conversation_provider_id || "");

            // Load organization isolation settings
            const { data: orgData } = await (supabase as any)
                .from("organizations")
                .select("strict_agent_isolation")
                .eq("id", organizationId)
                .maybeSingle();
            if (orgData) {
                setStrictAgentIsolation(orgData.strict_agent_isolation || false);
            }
        } catch (err) {
            console.error("Error loading GHL data:", err);
        }
        setIsLoading(false);
    };

    const handleConnect = () => {
        if (!globalConfig?.client_id) {
            toast.error("Integração GHL não está configurada globalmente pelo administrador.");
            return;
        }
        const domain = globalConfig.base_domain || "marketplace.gohighlevel.com";
        const redirectUri = globalConfig.redirect_uri || `${SUPABASE_URL}/functions/v1/ghl-oauth-callback`;

        const scopes = [
            "contacts.readonly", "contacts.write",
            "conversations.readonly", "conversations.write",
            "conversations/message.readonly", "conversations/message.write",
            "opportunities.readonly", "opportunities.write",
            "calendars.readonly", "calendars.write",
            "calendars/events.readonly", "calendars/events.write",
            "locations.readonly", "users.readonly"
        ].join(" ");

        const authUrl = `https://${domain}/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${globalConfig.client_id}&scope=${encodeURIComponent(scopes)}&state=${organizationId}`;

        // Open in a popup or new tab
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        window.open(authUrl, "GHL Authentication", `width=${width},height=${height},left=${left},top=${top}`);

        // Poll for changes in connection for a few minutes or provide a button to refresh
        toast.info("Aguardando autorização no GHL...");
    };

    const handleSaveProviderId = async () => {
        setIsSavingProvider(true);
        try {
            const { error } = await (supabase as any)
                .from("ghl_connections")
                .update({ conversation_provider_id: conversationProviderId || null })
                .eq("id", connection.id);
            if (error) throw error;
            toast.success("Conversation Provider ID salvo!");
            setConnection({ ...connection, conversation_provider_id: conversationProviderId || null });
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar Provider ID");
        }
        setIsSavingProvider(false);
    };

    const handleToggleIsolation = async (checked: boolean) => {
        setIsSavingIsolation(true);
        try {
            const { error } = await (supabase as any)
                .from("organizations")
                .update({ strict_agent_isolation: checked })
                .eq("id", organizationId);
            if (error) throw error;
            setStrictAgentIsolation(checked);
            toast.success(checked ? "Isolamento Estrito Ligado! 🔒" : "Isolamento Desligado 🔓");
        } catch (err) {
            console.error(err);
            toast.error("Erro ao alterar configurações de isolamento");
        }
        setIsSavingIsolation(false);
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            if (syncType === "conversations") {
                // Batch sync conversations to avoid edge function timeout
                let offset = 0;
                const batchSize = 10;
                let totalSynced = 0;
                let totalSkipped = 0;
                let done = false;

                while (!done) {
                    const { data, error } = await supabase.functions.invoke("ghl-sync", {
                        body: { organization_id: organizationId, sync_type: "conversations", offset, batch_size: batchSize },
                    });
                    if (error) throw error;
                    if (data?.ok === false) {
                        toast.error(data.error || "Erro na sincronização");
                        break;
                    }

                    const conv = data?.results?.conversations;
                    if (conv) {
                        totalSynced += conv.synced || 0;
                        totalSkipped += conv.skipped || 0;
                        done = conv.done === true;
                        offset = conv.nextOffset || offset + batchSize;
                    } else {
                        done = true;
                    }

                    if (!done) {
                        toast.info(`Sincronizando... ${totalSynced} conversas enviadas (lote ${Math.ceil(offset / batchSize)})`);
                    }
                }

                toast.success(`Sincronização concluída! ${totalSynced} conversas sincronizadas, ${totalSkipped} puladas.`);
            } else {
                const { data, error } = await supabase.functions.invoke("ghl-sync", {
                    body: { organization_id: organizationId, sync_type: syncType },
                });
                if (error) throw error;
                if (data?.ok === false) {
                    toast.error(data.error || "Erro na sincronização");
                } else {
                    toast.success("Sincronização concluída!");
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Erro ao sincronizar com GHL");
        }
        setIsSyncing(false);
    };

    if (isLoading) return <Skeleton className="h-48 w-full" />;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-primary" />
                    GoHighLevel (GHL)
                </CardTitle>
                <CardDescription>
                    Conecte sua conta do GHL para sincronizar contatos, funis e mensagens
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {connection ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-primary">Conta Conectada</p>
                                <p className="text-xs text-muted-foreground">
                                    Location ID: <code className="bg-background px-1 rounded">{connection.location_id}</code>
                                </p>
                            </div>
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                Ativo
                            </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Token expira em: {connection.token_expires_at ? new Date(connection.token_expires_at).toLocaleString("pt-BR") : "N/A"}
                        </div>

                        <div className="pt-2 flex flex-wrap gap-2">
                            <Button onClick={handleConnect} variant="outline" size="sm" className="gap-2">
                                <RefreshCw className="h-3.5 w-3.5" />
                                Reconectar Conta
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed p-8 text-center space-y-4">
                        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Link2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Nenhuma conta conectada</p>
                            <p className="text-xs text-muted-foreground">Conecte sua conta do GoHighLevel para começar a sincronizar seus leads.</p>
                        </div>
                        <Button onClick={handleConnect} className="gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Conectar GHL
                        </Button>
                    </div>
                )}

                {connection && (
                    <div className="space-y-3 pt-4 border-t">
                        <Label className="text-sm font-medium">Conversation Provider ID (Marketplace)</Label>
                        <p className="text-xs text-muted-foreground">
                            Necessário para que as mensagens apareçam na caixa de entrada do GHL.
                            Encontre este ID nas configurações do seu app no GHL Marketplace.
                        </p>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Ex: 6789abc..."
                                value={conversationProviderId}
                                onChange={(e) => setConversationProviderId(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={handleSaveProviderId} disabled={isSavingProvider} variant="outline" size="icon" className="shrink-0">
                                {isSavingProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                )}

                {connection && (
                    <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Isolamento Estrito de Agentes</Label>
                                <p className="text-xs text-muted-foreground">
                                    Impede (nível banco de dados) que agentes visualizem conversas ou agendas uns dos outros. Apenas Admins terão visão glocal.
                                </p>
                            </div>
                            <Switch
                                checked={strictAgentIsolation}
                                onCheckedChange={handleToggleIsolation}
                                disabled={isSavingIsolation}
                            />
                        </div>
                    </div>
                )}

                {connection && (
                    <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Sincronização Manual</Label>
                        </div>
                        <div className="flex gap-2">
                            <Select value={syncType} onValueChange={setSyncType}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tudo</SelectItem>
                                    <SelectItem value="contacts">Contatos → GHL</SelectItem>
                                    <SelectItem value="contacts_from_ghl">Contatos ← GHL</SelectItem>
                                    <SelectItem value="conversations">Conversas (Mensagens) → GHL</SelectItem>
                                    <SelectItem value="pipelines">Funis (Pipelines) → GHL</SelectItem>
                                    <SelectItem value="pipelines_from_ghl">Funis (Pipelines) ← GHL</SelectItem>
                                    <SelectItem value="tags">Tags → GHL</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleSync} disabled={isSyncing} className="gap-2 shrink-0">
                                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                Sincronizar
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
