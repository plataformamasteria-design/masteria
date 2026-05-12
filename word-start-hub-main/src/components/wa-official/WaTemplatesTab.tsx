import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, RefreshCw, Send, ShieldCheck, Clock, XCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export function WaTemplatesTab() {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const queryClient = useQueryClient();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Template Form State
    const [name, setName] = useState("");
    const [category, setCategory] = useState("MARKETING");
    const [language, setLanguage] = useState("pt_BR");
    const [bodyText, setBodyText] = useState("");

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ["wa-official-templates", orgId],
        queryFn: async () => {
            if (!orgId) return [];
            const { data } = await supabase.from("wa_official_templates").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
            return data || [];
        },
        enabled: !!orgId,
    });

    const handleSync = async () => {
        if (!orgId) return;
        setIsSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
                body: { action: "sync", organization_id: orgId }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            toast({ title: "Sincronização concluída", description: `${data.count} templates sincronizados com a Conta Meta.` });
            queryClient.invalidateQueries({ queryKey: ["wa-official-templates"] });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Erro na sincronização", description: err.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSubmitTemplate = async () => {
        if (!orgId || !name.trim() || !bodyText.trim()) {
            toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
            return;
        }
        const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

        setIsSubmitting(true);
        try {
            const components = [{ type: "BODY", text: bodyText }];
            const templateData = { name: cleanName, category, language, components };

            const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
                body: { action: "create", organization_id: orgId, template_data: templateData }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast({ title: "Template enviado para aprovação!" });
            queryClient.invalidateQueries({ queryKey: ["wa-official-templates"] });
            setDialogOpen(false);
            setName("");
            setBodyText("");
        } catch (err: any) {
            toast({ variant: "destructive", title: "Erro ao enviar template", description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <Badge className="bg-green-500 gap-1"><ShieldCheck className="h-3 w-3" /> Aprovado</Badge>;
            case 'PENDING': return <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-600"><Clock className="h-3 w-3" /> Em análise</Badge>;
            case 'REJECTED': return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejeitado</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading) return <Skeleton className="h-64 w-full" />;

    const isWabaConfigured = currentOrganization?.settings?.whatsapp_cloud_waba_id;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Modelos (Templates) Aprovados</h2>
                    {!isWabaConfigured && <p className="text-xs text-destructive">Organização sem Conta Meta (WABA) configurada em Integrações.</p>}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing || !isWabaConfigured}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} /> Sincronizar
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" disabled={!isWabaConfigured}><Plus className="h-4 w-4 mr-2" /> Novo Modelo Meta</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Submeter Modelo à Meta</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>Nome do Modelo</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="promocao_semana" />
                                    <p className="text-xs text-muted-foreground mt-1">Apenas letras minúsculas e underlines.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Categoria</Label>
                                        <Select value={category} onValueChange={setCategory}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MARKETING">Marketing</SelectItem>
                                                <SelectItem value="UTILITY">Utilidade</SelectItem>
                                                <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Idioma</Label>
                                        <Select value={language} onValueChange={setLanguage}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pt_BR">Português (BR)</SelectItem>
                                                <SelectItem value="en_US">Inglês (US)</SelectItem>
                                                <SelectItem value="es">Espanhol</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <Label>Mensagem (Corpo)</Label>
                                    <Textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={5} placeholder="Olá {{1}}, confira nossa oferta..." />
                                </div>
                                <Button className="w-full" onClick={handleSubmitTemplate} disabled={isSubmitting}>
                                    {isSubmitting ? "Enviando..." : "Enviar para Aprovação (Meta)"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {templates.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {isWabaConfigured ? "Nenhum template encontrado. Clique em sincronizar ou crie um novo." : "Acesse Configurações > Integrações e adicione sua conta WhatsApp Cloud API."}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((t: any) => {
                        const bodyComponent = (t.components as any[])?.find(c => c.type === 'BODY' || c.type === 'body');
                        return (
                            <Card key={t.id}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center justify-between">
                                        <span className="truncate">{t.name}</span>
                                        {getStatusBadge(t.status)}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bodyComponent?.text || "[Sem Corpo]"}</p>
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="text-xs">{t.language}</Badge>
                                        <Badge variant="outline" className="text-xs">{t.category}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
