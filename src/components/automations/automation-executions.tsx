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
        <Card className="border-slate-200/60 shadow-sm rounded-[24px] overflow-hidden bg-white">
            <CardHeader className="border-b border-slate-100 bg-slate-50/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        Histórico de Execuções
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] h-9 rounded-xl border-slate-200 bg-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200">
                                <SelectItem value="all">Todos os Status</SelectItem>
                                <SelectItem value="running">Executando</SelectItem>
                                <SelectItem value="completed">Concluídos</SelectItem>
                                <SelectItem value="failed">Falhas</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-xl border-slate-200"
                            onClick={fetchExecutions}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pl-6">Início</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fluxo</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contato</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pr-6">Duração / Erro</TableHead>
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
                                        <TableRow key={exec.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700">
                                                        {format(new Date(exec.startedAt), 'HH:mm:ss')}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {format(new Date(exec.startedAt), 'dd MMM yyyy', { locale: ptBR })}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-semibold text-slate-900">{exec.flowName || 'Excluído'}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700">{exec.contactName || 'Desconhecido'}</span>
                                                    <span className="text-[11px] text-slate-400 font-mono">{exec.contactPhone}</span>
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
                                                    <span className="text-[11px] text-red-500 font-medium line-clamp-1" title={exec.error}>
                                                        {exec.error}
                                                    </span>
                                                ) : exec.finishedAt ? (
                                                    <span className="text-[11px] text-slate-400 font-medium">
                                                        Encerrado às {format(new Date(exec.finishedAt), 'HH:mm')}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-blue-400 animate-pulse font-medium">Em progresso...</span>
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
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Página {page} de {totalPages}</span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-[11px] font-bold"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-[11px] font-bold"
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Próxima
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
