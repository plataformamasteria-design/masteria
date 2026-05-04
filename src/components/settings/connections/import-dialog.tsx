
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    foundConnections: any[];
    logs?: string[]; // Optional logs
    onConfirm: () => Promise<void>;
}

export function ImportDialog({ open, onOpenChange, foundConnections, logs, onConfirm }: ImportDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Conexões Encontradas</DialogTitle>
                    <DialogDescription>
                        Encontramos {foundConnections.length} conexões potenciais. Revise abaixo.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {/* Connections List */}
                    {foundConnections.length > 0 ? (
                        <div className="space-y-2">
                            {foundConnections.map((conn, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-secondary/20">
                                    <div className="flex items-center gap-3">
                                        {conn.connectionType === 'instagram' ? (
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">IG</div>
                                        ) : conn.connectionType === 'facebook_page' ? (
                                            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">FB</div>
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">WA</div>
                                        )}
                                        <div>
                                            <p className="font-medium text-sm">{conn.configName || conn.name}</p>
                                            <p className="text-xs text-muted-foreground">{conn.connectionType === 'instagram' ? 'Instagram' : (conn.connectionType === 'facebook_page' ? 'Página Facebook' : 'WhatsApp')}: {conn.displayPhone || conn.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono">ID: {conn.providerId}</p>
                                        </div>
                                    </div>
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center border rounded-lg bg-muted/50 text-muted-foreground">
                            Nenhuma conexão nova encontrada. Verifique o diagnóstico abaixo.
                        </div>
                    )}

                    {/* Diagnostic Logs Accordion */}
                    {logs && logs.length > 0 && (
                        <Accordion type="single" collapsible className="w-full border rounded-md">
                            <AccordionItem value="logs" className="border-none">
                                <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-muted/50 text-sm font-medium">
                                    🛠️ Relatório de Diagnóstico (Técnico)
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="bg-slate-950 text-slate-50 p-3 m-2 rounded text-[10px] font-mono h-48 overflow-y-auto whitespace-pre-wrap">
                                        {logs.map((log, i) => {
                                            let colorClass = "text-green-400"; // Default
                                            if (log.includes('❌') || log.includes('Erro') || log.includes('Skipped') || log.includes('Exception')) colorClass = "text-red-400 font-bold";
                                            if (log.includes('⚠️') || log.includes('Ausente')) colorClass = "text-yellow-400";
                                            if (log.includes('Diagnostic')) colorClass = "text-blue-300";

                                            return (
                                                <div key={i} className={`mb-1 border-b border-white/5 pb-0.5 last:border-0 ${colorClass}`}>
                                                    {log}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Fechar</Button>
                    <Button onClick={onConfirm} disabled={foundConnections.length === 0}>
                        {foundConnections.length > 0 ? 'Confirmar Importação' : 'Ok'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
