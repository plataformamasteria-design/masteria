// src/components/automations/automation-executions.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Search, RefreshCw, AlertCircle, CheckCircle2, PlayCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface AutomationExecution {
    id: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    startedAt: string;
    finishedAt?: string;
    error?: string;
    flowName: string;
    contactName: string;
    contactPhone: string;
}

const statusConfig = {
    running: { label: 'Executando', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: PlayCircle },
    completed: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    failed: { label: 'Falhou', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
    paused: { label: 'Pausado', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle },
};

export function AutomationExecutions() {
    const [executions, setExecutions] = useState<AutomationExecution[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedExecution, setSelectedExecution] = useState<AutomationExecution | null>(null);

    const fetchExecutions = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                status: statusFilter,
            });
            const response = await fetch(`/api/v1/automation-flows/executions?${params}`);
            const data = await response.json();
            setExecutions(data.executions || []);
            setTotalPages(data.pagination?.totalPages || 1);
        } catch (error) {
            console.error('Erro ao buscar execuções:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExecutions();
    }, [page, statusFilter]);

    return (
        <Card className="border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] bg-white/[0.02] backdrop-blur-md rounded-[2rem] overflow-hidden transition-all">
            <CardHeader className="border-b border-white/5 bg-transparent pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-emerald-400" />
                        Histórico de Execuções
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] h-9 rounded-xl border-white/10 bg-white/[0.02] text-zinc-300 focus:ring-emerald-500/50 hover:bg-white/[0.05]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-white/10 bg-zinc-950 text-zinc-300">
                                <SelectItem value="all" className="hover:bg-white/5">Todos os Status</SelectItem>
                                <SelectItem value="running" className="hover:bg-white/5">Executando</SelectItem>
                                <SelectItem value="completed" className="hover:bg-white/5">Concluídos</SelectItem>
                                <SelectItem value="failed" className="hover:bg-white/5">Falhas</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-xl border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-zinc-300 hover:text-white"
                            onClick={fetchExecutions}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-white/[0.02]">
                            <TableRow className="hover:bg-transparent border-white/5">
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 pl-6">Início</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Fluxo</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Contato</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Status</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 pr-6">Duração / Erro</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-slate-500 italic">
                                        Carregando histórico...
                                    </TableCell>
                                </TableRow>
                            ) : executions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                                        Nenhuma execução encontrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                executions.map((exec) => {
                                    const config = statusConfig[exec.status as keyof typeof statusConfig] || statusConfig.running;
                                    const StatusIcon = config.icon;

                                    return (
                                            <TableRow 
                                            key={exec.id} 
                                            className="hover:bg-white/[0.04] transition-colors border-white/5 cursor-pointer"
                                            onClick={() => setSelectedExecution(exec)}
                                        >
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-zinc-300">
                                                        {format(new Date(exec.startedAt), 'HH:mm:ss')}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500 font-medium">
                                                        {format(new Date(exec.startedAt), 'dd MMM yyyy', { locale: ptBR })}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-semibold text-white">{exec.flowName || 'Excluído'}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-zinc-300">{exec.contactName || 'Desconhecido'}</span>
                                                    <span className="text-[11px] text-zinc-500 font-mono">{exec.contactPhone}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`px-2 py-0.5 rounded-lg border flex items-center gap-1 w-fit shadow-none font-bold text-[10px] ${config.color}`}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {config.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="pr-6">
                                                {exec.status === 'failed' ? (
                                                    <span className="text-[11px] text-rose-500 font-medium line-clamp-1" title={exec.error}>
                                                        {exec.error}
                                                    </span>
                                                ) : exec.finishedAt ? (
                                                    <span className="text-[11px] text-zinc-500 font-medium">
                                                        Encerrado às {format(new Date(exec.finishedAt), 'HH:mm')}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-emerald-400 animate-pulse font-medium">Em progresso...</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-between bg-transparent">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Página {page} de {totalPages}</span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-[11px] font-bold border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-[11px] font-bold border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Próxima
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
            
            <Dialog open={!!selectedExecution} onOpenChange={(open) => !open && setSelectedExecution(null)}>
                <DialogContent className="max-w-2xl bg-zinc-950 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white font-bold">Detalhes da Execução</DialogTitle>
                        <DialogDescription className="text-zinc-400 font-medium">Fluxo: {selectedExecution?.flowName}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        {selectedExecution?.error && (
                            <div className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 text-rose-400 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-[300px]">
                                {selectedExecution.error}
                            </div>
                        )}
                        <div className="text-sm bg-white/[0.02] p-4 rounded-xl border border-white/5 space-y-2 text-zinc-300">
                            <p><strong className="text-white">Contato:</strong> {selectedExecution?.contactName} ({selectedExecution?.contactPhone})</p>
                            <p><strong className="text-white">Status:</strong> {selectedExecution?.status}</p>
                            <p><strong className="text-white">Início:</strong> {selectedExecution?.startedAt && format(new Date(selectedExecution.startedAt), 'dd/MM/yyyy HH:mm:ss')}</p>
                            <p><strong className="text-white">Fim:</strong> {selectedExecution?.finishedAt ? format(new Date(selectedExecution.finishedAt), 'dd/MM/yyyy HH:mm:ss') : '-'}</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
