// src/components/automations/automation-logs.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Search, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AutomationLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details?: Record<string, unknown>;
  conversationId?: string;
  ruleId?: string;
  ruleName?: string;
  createdAt: string;
}

interface AutomationRule {
  id: string;
  name: string;
}

interface LogsResponse {
  logs: AutomationLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const levelColors = {
  INFO: 'bg-blue-100 text-blue-800',
  WARN: 'bg-yellow-100 text-yellow-800',
  ERROR: 'bg-red-100 text-red-800',
};

const levelLabels = {
  INFO: 'Info',
  WARN: 'Aviso',
  ERROR: 'Erro',
};

export function AutomationLogs() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filtros
  const [filters, setFilters] = useState({
    level: 'all',
    ruleId: 'all',
    search: '',
    startDate: '',
    endDate: '',
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.level && filters.level !== 'all' && { level: filters.level }),
        ...(filters.ruleId && filters.ruleId !== 'all' && { ruleId: filters.ruleId }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/v1/automation-logs?${params}`);
      if (!response.ok) throw new Error('Erro ao carregar logs');

      const data: LogsResponse = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/v1/automations');
      if (!response.ok) throw new Error('Erro ao carregar regras');
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset para primeira página
  };

  const clearFilters = () => {
    setFilters({
      level: '',
      ruleId: '',
      search: '',
      startDate: '',
      endDate: '',
    });
  };

  const formatDetails = (details?: Record<string, unknown>) => {
    if (!details || Object.keys(details).length === 0) return null;
    return JSON.stringify(details, null, 2);
  };

  return (
    <Card className="border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] bg-white/[0.02] backdrop-blur-md rounded-[2rem] overflow-hidden transition-all">
      <CardHeader className="border-b border-white/5 bg-transparent pb-4">
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-400" />
          Logs de Automação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Buscar mensagem..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10 h-10 rounded-xl bg-white/[0.02] border-white/10 text-zinc-300 placeholder:text-zinc-600 focus:border-white/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nível</label>
            <Select value={filters.level} onValueChange={(value) => handleFilterChange('level', value)}>
              <SelectTrigger className="h-10 rounded-xl bg-white/[0.02] border-white/10 text-zinc-300">
                <SelectValue placeholder="Todos os níveis" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-white/10 bg-zinc-950 text-zinc-300">
                <SelectItem value="all" className="hover:bg-white/5">Todos os níveis</SelectItem>
                <SelectItem value="INFO" className="hover:bg-white/5">Info</SelectItem>
                <SelectItem value="WARN" className="hover:bg-white/5">Aviso</SelectItem>
                <SelectItem value="ERROR" className="hover:bg-white/5">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Regra</label>
            <Select value={filters.ruleId} onValueChange={(value) => handleFilterChange('ruleId', value)}>
              <SelectTrigger className="h-10 rounded-xl bg-white/[0.02] border-white/10 text-zinc-300">
                <SelectValue placeholder="Todas as regras" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-white/10 bg-zinc-950 text-zinc-300">
                <SelectItem value="all" className="hover:bg-white/5">Todas as regras</SelectItem>
                {rules.map((rule) => (
                  <SelectItem key={rule.id} value={rule.id} className="hover:bg-white/5">
                    {rule.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Data Início</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="h-10 rounded-xl bg-white/[0.02] border-white/10 text-zinc-300 focus:border-white/20 [color-scheme:dark]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Data Fim</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="h-10 rounded-xl bg-white/[0.02] border-white/10 text-zinc-300 focus:border-white/20 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-between items-center px-1">
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearFilters} className="rounded-xl border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]">
              <Filter className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button variant="outline" onClick={fetchLogs} className="rounded-xl border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
          <div className="text-sm font-medium text-zinc-500">
            {pagination.total} logs encontrados
          </div>
        </div>

        {/* Tabela de Logs */}
        <div className="border border-white/5 rounded-[1.5rem] overflow-hidden bg-transparent">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="hover:bg-transparent border-white/5">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 pl-6">Data/Hora</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Nível</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Regra</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Mensagem</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 pr-6">Conversa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-white/[0.04] transition-colors border-white/5">
                    <TableCell className="font-mono text-xs font-medium text-zinc-400 pl-6">
                      {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${levelColors[log.level]} px-2 py-0.5 rounded-lg border flex items-center justify-center gap-1 w-fit shadow-none font-bold text-[10px]`}>
                        {levelLabels[log.level]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-zinc-300">
                      {log.ruleName || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate text-sm text-white" title={log.message}>
                        {log.message}
                      </div>
                      {formatDetails(log.details) && (
                        <details className="mt-1">
                          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">Detalhes</summary>
                          <pre className="text-[10px] bg-black/20 border border-white/5 p-3 rounded-xl mt-2 overflow-auto max-h-32 text-zinc-400 font-mono">
                            {formatDetails(log.details)}
                          </pre>
                        </details>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs pr-6">
                      {log.conversationId ? (
                        <span className="text-blue-400" title={log.conversationId}>
                          {log.conversationId.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-zinc-600">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center p-2">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Página {pagination.page} de {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                className="h-8 rounded-lg text-[11px] font-bold border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                className="h-8 rounded-lg text-[11px] font-bold border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]"
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