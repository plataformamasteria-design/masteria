import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Send, Users, Activity, Loader2, AlertTriangle, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function WaNewCampaignTab() {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;

    const [campaignName, setCampaignName] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [targetListId, setTargetListId] = useState("");
    const [delaySeconds, setDelaySeconds] = useState(5);
    const [isSending, setIsSending] = useState(false);

    const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
        queryKey: ["wa-official-templates-approved", orgId],
        queryFn: async () => {
            if (!orgId) return [];
            const { data } = await supabase.from("wa_official_templates").select("*").eq("organization_id", orgId).eq("status", "APPROVED").order("name");
            return data || [];
        },
        enabled: !!orgId,
    });

    const { data: savedLists = [], isLoading: loadingLists } = useQuery({
        queryKey: ["broadcast-lists", orgId],
        queryFn: async () => {
            if (!orgId) return [];
            const { data } = await supabase.from("broadcast_lists").select("*").eq("organization_id", orgId).order("name");
            return data || [];
        },
        enabled: !!orgId,
    });

    const handleStartCampaign = async () => {
        if (!orgId || !campaignName.trim() || !selectedTemplateId || !targetListId) {
            toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
            return;
        }

        setIsSending(true);
        try {
            const list = savedLists.find(l => l.id === targetListId);
            if (!list || !list.phones?.length) {
                throw new Error("A lista de contatos selecionada está vazia!");
            }

            // Create Campaign
            const { data: campaign, error: insertError } = await supabase.from("wa_official_campaigns").insert({
                organization_id: orgId,
                name: campaignName,
                template_id: selectedTemplateId,
                target_type: "saved_list",
                target_list_id: targetListId,
                target_phones: list.phones,
                delay_seconds: delaySeconds,
                total_recipients: list.phones.length,
                status: "running",
                started_at: new Date().toISOString()
            }).select().single();

            if (insertError) throw insertError;

            // Request edge function asynchronously via trigger or direct call. 
            // For immediate broadcast runner, we call it in the background by not awaiting OR by expecting the backend to chunk it.
            // Easiest is to fire the Edge Function to handle the loop.

            const { data, error } = await supabase.functions.invoke("meta-send-campaign", {
                body: { campaign_id: campaign.id }
            });

            if (error) {
                await supabase.from("wa_official_campaigns").update({ status: 'failed' }).eq('id', campaign.id);
                throw error;
            }

            if (data?.error) throw new Error(data.error);

            toast({ title: "Disparo concluído!", description: `${data.sent} mensagens enviadas, ${data.failed} falharam.` });
            // Reset
            setCampaignName("");
            setSelectedTemplateId("");
            setTargetListId("");

        } catch (err: any) {
            console.error(err);
            toast({ variant: "destructive", title: "Erro ao enviar", description: err.message });
        } finally {
            setIsSending(false);
        }
    };

    const isWabaConfigured = currentOrganization?.settings?.whatsapp_cloud_waba_id;

    if (!isWabaConfigured) {
        return (
            <div className="p-6 text-center border rounded-lg bg-muted text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                Configure o WhatsApp Cloud API nativo em "Integrações" antes de realizar disparos oficiais.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                {/* Config */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Configuração da Janela</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Nome do Disparo</Label>
                            <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Black Friday Clientes SP" />
                        </div>

                        <div>
                            <Label>Lista Selecionada (Destinatários)</Label>
                            {loadingLists ? <Skeleton className="h-10 w-full" /> : (
                                <Select value={targetListId} onValueChange={setTargetListId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione a Lista de Leads" /></SelectTrigger>
                                    <SelectContent>
                                        {savedLists.map((l: any) => (
                                            <SelectItem key={l.id} value={l.id}>
                                                <span className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5" />
                                                    {l.name} ({l.phone_count} contatos)
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div>
                            <Label>Template (Apenas Aprovados)</Label>
                            {isLoadingTemplates ? <Skeleton className="h-10 w-full" /> : (
                                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione o Template Meta" /></SelectTrigger>
                                    <SelectContent>
                                        {templates.map((t: any) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name} ({t.language})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div>
                            <Label>Intervalo entre envios (segundos)</Label>
                            <Input type="number" min={1} max={60} value={delaySeconds} onChange={e => setDelaySeconds(Number(e.target.value))} />
                        </div>

                        <Separator />
                        <Button className="w-full" size="lg" onClick={handleStartCampaign} disabled={isSending}>
                            {isSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando Disparo...</> : "Iniciar Disparo Oficial"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                {selectedTemplateId ? (
                    <Card>
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Preview do Template Selecionado</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="bg-muted/30 p-4 rounded-lg relative">
                                <span className="absolute top-2 right-3 text-xs font-bold text-green-500 uppercase flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Verificado</span>
                                {(() => {
                                    const t = templates.find((t: any) => t.id === selectedTemplateId);
                                    const bodyComponent = (t?.components as any[])?.find(c => c.type === 'BODY' || c.type === 'body');
                                    return <p className="text-sm whitespace-pre-wrap">{bodyComponent?.text || "Geração de layout indisponível para este tipo."}</p>;
                                })()}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="h-full border border-dashed rounded-xl flex items-center justify-center p-6 text-center text-muted-foreground bg-muted/20">
                        Selecione um Template Oficial Aprovado para visualizar seu modelo original diretamente da Meta e confirmar os botões/textos.
                    </div>
                )}
            </div>
        </div>
    );
}
