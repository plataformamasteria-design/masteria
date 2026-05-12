import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Search, Play, Loader2, User, Phone } from "lucide-react";

interface TriggerAutomationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    automationId: string;
    automationName: string;
}

interface ChatResult {
    id: string;
    phone: string;
    wa_name: string | null;
    custom_name: string | null;
}

export function TriggerAutomationDialog({
    open,
    onOpenChange,
    automationId,
    automationName,
}: TriggerAutomationDialogProps) {
    const { currentOrganization } = useOrganization();
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<ChatResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [triggering, setTriggering] = useState<string | null>(null);

    const searchLeads = useCallback(async (term: string) => {
        if (!currentOrganization?.id || term.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        const { data } = await (supabase as any)
            .from("chats")
            .select("id, phone, wa_name, custom_name")
            .eq("organization_id", currentOrganization.id)
            .or(`wa_name.ilike.%${term}%,custom_name.ilike.%${term}%,phone.ilike.%${term}%`)
            .order("updated_at", { ascending: false })
            .limit(20);

        setResults((data || []) as ChatResult[]);
        setLoading(false);
    }, [currentOrganization?.id]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length >= 2) {
                searchLeads(searchTerm.trim());
            } else {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, searchLeads]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setSearchTerm("");
            setResults([]);
            setTriggering(null);
        }
    }, [open]);

    const handleTrigger = async (chat: ChatResult) => {
        if (!currentOrganization?.id) return;

        setTriggering(chat.id);
        try {
            const { error } = await supabase.functions.invoke("automation-executor", {
                body: {
                    trigger_type: "manual",
                    automation_id: automationId,
                    chat_id: chat.id,
                    organization_id: currentOrganization.id,
                },
            });

            if (error) {
                toast({
                    variant: "destructive",
                    title: "Erro ao acionar automação",
                    description: error.message,
                });
            } else {
                toast({
                    title: "Automação acionada! ⚡",
                    description: `Fluxo "${automationName}" iniciado para ${chat.custom_name || chat.wa_name || chat.phone}`,
                });
                onOpenChange(false);
            }
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Erro ao acionar",
                description: err.message,
            });
        } finally {
            setTriggering(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Play className="h-5 w-5 text-primary" />
                        Acionar Automação
                    </DialogTitle>
                    <DialogDescription>
                        Selecione o lead para executar "{automationName}"
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome ou telefone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                            autoFocus
                        />
                    </div>

                    {/* Results */}
                    <ScrollArea className="max-h-[300px]">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : results.length > 0 ? (
                            <div className="space-y-1">
                                {results.map((chat) => {
                                    const name = chat.custom_name || chat.wa_name || chat.phone;
                                    const isTriggeringThis = triggering === chat.id;

                                    return (
                                        <button
                                            key={chat.id}
                                            onClick={() => handleTrigger(chat)}
                                            disabled={!!triggering}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-accent/50 transition-colors disabled:opacity-50"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <User className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{name}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {chat.phone}
                                                </p>
                                            </div>
                                            {isTriggeringThis ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                                            ) : (
                                                <Play className="h-4 w-4 text-muted-foreground shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : searchTerm.length >= 2 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                Nenhum lead encontrado
                            </div>
                        ) : (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                Digite ao menos 2 caracteres para buscar
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
