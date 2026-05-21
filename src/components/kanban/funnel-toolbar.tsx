// src/components/kanban/funnel-toolbar.tsx
'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Search, Plus, Filter, Settings, X, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import type { KanbanFunnel, KanbanStage } from '@/lib/types';
import type { KanbanFilters } from '@/app/(main)/kanban/[funnelId]/page';
import Link from 'next/link';
import { ImportKommoModal } from './import-kommo-modal';

interface FunnelToolbarProps {
  funnel: KanbanFunnel;
  onAddCard?: () => void;
  onSearch?: (query: string) => void;
  filters?: KanbanFilters;
  onFiltersChange?: (filters: KanbanFilters) => void;
  activeFilterCount?: number;
  companyUsers?: any[];
  companyTeams?: any[];
  connections?: any[];
}

export function FunnelToolbar({ funnel, onAddCard, onSearch, filters, onFiltersChange, activeFilterCount, companyUsers, companyTeams, connections }: FunnelToolbarProps): JSX.Element {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleStageToggle = (stageId: string) => {
    if (!filters || !onFiltersChange) return;
    const newStages = filters.stages.includes(stageId)
      ? filters.stages.filter(s => s !== stageId)
      : [...filters.stages, stageId];
    onFiltersChange({ ...filters, stages: newStages });
  };

  const handleUserToggle = (userId: string) => {
    if (!filters || !onFiltersChange) return;
    const newUsers = filters.assignedUsers.includes(userId)
      ? filters.assignedUsers.filter(u => u !== userId)
      : [...filters.assignedUsers, userId];
    onFiltersChange({ ...filters, assignedUsers: newUsers });
  };

  const handleTeamToggle = (teamId: string) => {
    if (!filters || !onFiltersChange) return;
    const newTeams = filters.teams.includes(teamId)
      ? filters.teams.filter(t => t !== teamId)
      : [...filters.teams, teamId];
    onFiltersChange({ ...filters, teams: newTeams });
  };

  const handleConnectionToggle = (connectionId: string) => {
    if (!filters || !onFiltersChange) return;
    const newConns = filters.connections.includes(connectionId)
      ? filters.connections.filter(c => c !== connectionId)
      : [...filters.connections, connectionId];
    onFiltersChange({ ...filters, connections: newConns });
  };

  const handleDateRangeChange = (range: 'all' | '7d' | '30d' | '90d') => {
    if (!filters || !onFiltersChange) return;
    onFiltersChange({ ...filters, dateRange: range });
  };

  const handleValueMinChange = (val: string) => {
    if (!filters || !onFiltersChange) return;
    onFiltersChange({ ...filters, valueMin: val ? Number(val) : null });
  };

  const handleValueMaxChange = (val: string) => {
    if (!filters || !onFiltersChange) return;
    onFiltersChange({ ...filters, valueMax: val ? Number(val) : null });
  };

  const handleClearFilters = () => {
    if (!onFiltersChange) return;
    onFiltersChange({
      stages: [],
      priority: [],
      valueMin: null,
      valueMax: null,
      dateRange: 'all',
      assignedUsers: [],
      teams: [],
      connections: [],
    });
  };

  return (
    <div className="border-b bg-background flex-shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold truncate">{funnel.name}</h2>
          <div className="text-xs text-muted-foreground">
            {funnel.totalLeads || 0} leads • R$ {(funnel.totalValue || 0).toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative hidden lg:block">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              className="pl-8 h-8 w-40 xl:w-56 text-sm"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>

          {/* Filtros com Popover */}
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 relative">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline ml-1.5">Filtros</span>
                {(activeFilterCount ?? 0) > 0 && (
                  <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-3 border-b flex items-center justify-between">
                <h4 className="text-sm font-semibold">Filtros</h4>
                {(activeFilterCount ?? 0) > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleClearFilters}>
                    <X className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>

              <div className="p-3 space-y-4 max-h-[400px] overflow-auto">
                {/* Filtro por Etapa */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Etapas</Label>
                  <div className="space-y-1.5">
                    {funnel.stages.map((stage: KanbanStage) => (
                      <div key={stage.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`filter-stage-${stage.id}`}
                          checked={filters?.stages.includes(stage.id) ?? false}
                          onCheckedChange={() => handleStageToggle(stage.id)}
                        />
                        <label htmlFor={`filter-stage-${stage.id}`} className="text-sm cursor-pointer flex-1 truncate">
                          {stage.title}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Filtro por Usuário Atribuído */}
                {companyUsers && companyUsers.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Usuário Atribuído</Label>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {companyUsers.map((user: any) => (
                        <div key={user.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`filter-user-${user.id}`}
                            checked={filters?.assignedUsers.includes(user.id) ?? false}
                            onCheckedChange={() => handleUserToggle(user.id)}
                          />
                          <label htmlFor={`filter-user-${user.id}`} className="text-sm cursor-pointer flex-1 truncate">
                            {user.name || user.email}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtro por Equipe */}
                {companyTeams && companyTeams.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Equipe</Label>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {companyTeams.map((team: any) => (
                        <div key={team.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`filter-team-${team.id}`}
                            checked={filters?.teams.includes(team.id) ?? false}
                            onCheckedChange={() => handleTeamToggle(team.id)}
                          />
                          <label htmlFor={`filter-team-${team.id}`} className="text-sm cursor-pointer flex-1 truncate">
                            {team.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtro por Conexão */}
                {connections && connections.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Conexão</Label>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {connections.map((conn: any) => (
                        <div key={conn.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`filter-conn-${conn.id}`}
                            checked={filters?.connections.includes(conn.id) ?? false}
                            onCheckedChange={() => handleConnectionToggle(conn.id)}
                          />
                          <label htmlFor={`filter-conn-${conn.id}`} className="text-sm cursor-pointer flex-1 truncate">
                            {conn.config_name || conn.configName || conn.name || conn.sessionName || 'Conexão'}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="my-4" />

                {/* Filtro por Valor */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Valor (R$)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Mín"
                      className="h-7 text-xs"
                      value={filters?.valueMin ?? ''}
                      onChange={(e) => handleValueMinChange(e.target.value)}
                    />
                    <span className="text-muted-foreground text-xs">—</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Máx"
                      className="h-7 text-xs"
                      value={filters?.valueMax ?? ''}
                      onChange={(e) => handleValueMaxChange(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Filtro por Data */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Criado em
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'all' as const, label: 'Todos' },
                      { value: '7d' as const, label: '7 dias' },
                      { value: '30d' as const, label: '30 dias' },
                      { value: '90d' as const, label: '90 dias' },
                    ].map(({ value, label }) => (
                      <Button
                        key={value}
                        variant={filters?.dateRange === value ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => handleDateRangeChange(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Link href={`/kanban/${funnel.id}/edit`}>
            <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3">
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline ml-1.5">Editar</span>
            </Button>
          </Link>

          <ImportKommoModal />
          
          <Button size="sm" onClick={onAddCard} className="h-8 px-2 sm:px-3">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Novo Lead</span>
          </Button>
        </div>
      </div>

      <div className="px-3 pb-3 lg:hidden">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            className="pl-8 h-8 w-full text-sm"
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}