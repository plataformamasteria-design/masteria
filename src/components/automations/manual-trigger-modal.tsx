'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, Workflow, MessageSquare, AlertCircle } from 'lucide-react';
import { getAutomationFlowsForDropdown } from '@/app/actions/automations-builder';

interface ConnectionOption {
    id: string;
    config_name: string;
    isActive: boolean;
}

interface ManualTriggerModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactId: string;
    contactName: string;
}

export function ManualTriggerModal({ isOpen, onClose, contactId, contactName }: ManualTriggerModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    
    const [flows, setFlows] = useState<any[]>([]);
    const [connections, setConnections] = useState<ConnectionOption[]>([]);
    
    const [selectedFlowId, setSelectedFlowId] = useState<string>('none');
    const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
    const [evaluateMessage, setEvaluateMessage] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        
        let isMounted = true;
        setFetching(true);
        
        Promise.all([
            getAutomationFlowsForDropdown(),
            fetch('/api/v1/connections').then(res => res.json())
        ]).then(([flowsData, connectionsData]) => {
            if (!isMounted) return;
            // Apenas fluxos que são do tipo 'manual'
            const manualFlows = (flowsData || []).filter((f: any) => f.triggerType === 'manual');
            setFlows(manualFlows);
            
            const activeConns = Array.isArray(connectionsData) ? connectionsData.filter((c: any) => c.isActive) : [];
            setConnections(activeConns);
            
            if (activeConns.length > 0 && !selectedConnectionId) {
                setSelectedConnectionId(activeConns[0].id);
            }
        }).catch(err => {
            console.error(err);
            if (isMounted) {
                toast({
                    variant: 'destructive',
                    title: 'Erro',
                    description: 'Falha ao carregar opções para o gatilho manual.'
                });
            }
        }).finally(() => {
            if (isMounted) setFetching(false);
        });

        return () => { isMounted = false; };
    }, [isOpen, selectedConnectionId, toast]);

    const handleTrigger = async () => {
        if (selectedFlowId === 'none' && !evaluateMessage) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Selecione um fluxo manual ou marque a opção de avaliar última mensagem.'
            });
            return;
        }

        if (!selectedConnectionId) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Selecione uma conexão para envio da mensagem.'
            });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/v1/automations/trigger-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contactId,
                    flowId: selectedFlowId === 'none' ? undefined : selectedFlowId,
                    connectionId: selectedConnectionId,
                    evaluateMessage
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Falha ao disparar automação');
            }

            toast({
                title: 'Sucesso',
                description: 'Automação disparada com sucesso!'
            });
            onClose();
            
            // Força reset após fechar
            setSelectedFlowId('none');
            setEvaluateMessage(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: (error as Error).message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[450px] bg-zinc-950 border border-white/10 text-white shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Zap className="h-5 w-5 text-emerald-500" />
                        Disparo Manual
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Acione automações manualmente para <strong className="text-white">{contactName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {fetching ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5">
                                    <Workflow className="h-3 w-3" />
                                    Fluxo Manual
                                </label>
                                <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
                                    <SelectTrigger className="bg-zinc-900 border-white/10 text-white">
                                        <SelectValue placeholder="Selecione o fluxo..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                        <SelectItem value="none">Nenhum</SelectItem>
                                        {flows.map(f => (
                                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {flows.length === 0 && (
                                    <p className="text-[11px] text-amber-500/80 flex items-center gap-1 mt-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Nenhum fluxo configurado com o gatilho "Ativação Manual".
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                                    Conexão de Saída
                                </label>
                                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                                    <SelectTrigger className="bg-zinc-900 border-white/10 text-white">
                                        <SelectValue placeholder="Conexão que enviará a mensagem..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                        {connections.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.config_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-zinc-500">
                                    Muito útil para novos leads que ainda não têm histórico de conexão ancorado.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-3 rounded-lg flex gap-3 items-start cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setEvaluateMessage(!evaluateMessage)}>
                                <Checkbox 
                                    checked={evaluateMessage} 
                                    onCheckedChange={(checked) => setEvaluateMessage(!!checked)}
                                    className="mt-1 data-[state=checked]:bg-emerald-500"
                                />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-white flex items-center gap-1.5">
                                        <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                                        Avaliar última mensagem
                                    </p>
                                    <p className="text-xs text-zinc-400">
                                        Se a última mensagem do lead cumprir regras de fluxos de "Mensagem Recebida", eles também serão disparados.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="text-zinc-400 hover:text-white hover:bg-white/10">
                        Cancelar
                    </Button>
                    <Button onClick={handleTrigger} disabled={loading || fetching} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Disparar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
