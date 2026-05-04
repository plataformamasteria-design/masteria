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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Logs de Automação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-2">
            <label className="text-sm font-medium">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar mensagem..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nível</label>
            <Select value={filters.level} onValueChange={(value) => handleFilterChange('level', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os níveis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
                <SelectItem value="WARN">Aviso</SelectItem>
                <SelectItem value="ERROR">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Regra</label>
            <Select value={filters.ruleId} onValueChange={(value) => handleFilterChange('ruleId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as regras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as regras</SelectItem>
                {rules.map((rule) => (
                  <SelectItem key={rule.id} value={rule.id}>
                    {rule.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Início</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Fim</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
          <div className="text-sm text-gray-600">
            {pagination.total} logs encontrados
          </div>
        </div>

        {/* Tabela de Logs */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Conversa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge className={levelColors[log.level]}>
                        {levelLabels[log.level]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.ruleName || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate" title={log.message}>
                        {log.message}
                      </div>
                      {formatDetails(log.details) && (
                        <details className="mt-1">
                          <summary className="text-xs text-gray-500 cursor-pointer">Detalhes</summary>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                            {formatDetails(log.details)}
                          </pre>
                        </details>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.conversationId ? (
                        <span className="text-blue-600" title={log.conversationId}>
                          {log.conversationId.slice(0, 8)}...
                        </span>
                      ) : (
                        'N/A'
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
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Página {pagination.page} de {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
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