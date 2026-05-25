// src/components/kanban/funnel-toolbar.tsx
'use client';

import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Search, Plus, SlidersHorizontal, Settings, X, Calendar,
  Wifi, User, Users, Tag, Layers, DollarSign, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import type { KanbanFunnel, KanbanStage } from '@/lib/types';
import type { KanbanFilters } from '@/app/(main)/kanban/[funnelId]/page';
import Link from 'next/link';
import { ImportKommoModal } from './import-kommo-modal';
import { cn } from '@/lib/utils';

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
  availableTags?: any[];
}

// ─── FilterSection — colapsável fechado por padrão ──────────────────────────
function FilterSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <Badge className="h-4 min-w-4 px-1.5 py-0 text-[10px] bg-primary/15 text-primary border border-primary/30 font-semibold">
              {count}
            </Badge>
          )}
        </div>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="p-2 space-y-0.5 bg-background">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── FilterCheckItem ─────────────────────────────────────────────────────────
function FilterCheckItem({
  id,
  label,
  checked,
  color,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  color?: string;
  onToggle: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors text-sm',
        checked
          ? 'bg-primary/10 text-primary'
          : 'text-foreground hover:bg-muted'
      )}
    >
      <div className={cn(
        'h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
        checked
          ? 'bg-primary border-primary'
          : 'border-border bg-background'
      )}>
        {checked && (
          <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {color && (
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="flex-1 truncate text-[13px]">{label}</span>
    </button>
  );
}

// ─── SectionSearch ───────────────────────────────────────────────────────────
function SectionSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative mb-1.5">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Buscar...'}
        className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function FunnelToolbar({
  funnel, onAddCard, onSearch, filters, onFiltersChange, activeFilterCount,
  companyUsers, companyTeams, connections, availableTags,
}: FunnelToolbarProps): JSX.Element {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [connSearch, setConnSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [stageSearch, setStageSearch] = useState('');

  const toggle = (key: keyof KanbanFilters, value: string) => {
    if (!filters || !onFiltersChange) return;
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onFiltersChange({ ...filters, [key]: next });
  };

  const handleClearFilters = () => {
    if (!onFiltersChange) return;
    onFiltersChange({
      stages: [], priority: [], valueMin: null, valueMax: null,
      dateRange: 'all', dateFrom: null, dateTo: null,
      assignedUsers: [], teams: [], connections: [], tags: [],
    });
  };

  const filteredConns = useMemo(() =>
    (connections || []).filter(c =>
      (c.config_name || c.configName || c.name || '').toLowerCase().includes(connSearch.toLowerCase())
    ), [connections, connSearch]);

  const filteredUsers = useMemo(() =>
    (companyUsers || []).filter(u =>
      (u.name || u.email || '').toLowerCase().includes(userSearch.toLowerCase())
    ), [companyUsers, userSearch]);

  const filteredTeams = useMemo(() =>
    (companyTeams || []).filter(t =>
      (t.name || '').toLowerCase().includes(teamSearch.toLowerCase())
    ), [companyTeams, teamSearch]);

  const filteredTags = useMemo(() =>
    (availableTags || []).filter(t =>
      (t.name || '').toLowerCase().includes(tagSearch.toLowerCase())
    ), [availableTags, tagSearch]);

  const filteredStages = useMemo(() =>
    (funnel?.stages || []).filter(s =>
      (s.title || '').toLowerCase().includes(stageSearch.toLowerCase())
    ), [funnel?.stages, stageSearch]);

  const hasFilters = (activeFilterCount ?? 0) > 0;

  return (
    <div className="border-b bg-background flex-shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 gap-3">
        {/* Funnel Name */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold truncate">{funnel.name}</h2>
          <div className="text-xs text-muted-foreground">
            {funnel.totalLeads || 0} leads
            {(funnel.totalValue ?? 0) > 0 && (
              <span> • R$ {(funnel.totalValue || 0).toLocaleString('pt-BR')}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Desktop search */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              className="pl-8 h-8 w-40 xl:w-56 text-sm"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>

          {/* Filters Popover */}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                id="kanban-filter-btn"
                className="h-8 px-2 sm:px-3 relative gap-1.5"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline ml-0.5">Filtros</span>
                {hasFilters && (
                  <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-80 p-0 bg-background border border-border shadow-lg"
              align="end"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Filtros</span>
                  {hasFilters && (
                    <Badge className="h-4 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold">
                      {activeFilterCount}
                    </Badge>
                  )}
                </div>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    <X className="h-3 w-3" />
                    Limpar
                  </Button>
                )}
              </div>

              {/* Scrollable filter body */}
              <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">

                {/* Conexão */}
                {(connections || []).length > 0 && (
                  <FilterSection
                    icon={<Wifi className="h-3.5 w-3.5" />}
                    title="Conexão"
                    count={filters?.connections.length}
                  >
                    {(connections || []).length > 4 && (
                      <SectionSearch value={connSearch} onChange={setConnSearch} placeholder="Buscar conexão..." />
                    )}
                    {filteredConns.map(conn => (
                      <FilterCheckItem
                        key={conn.id}
                        id={`filter-conn-${conn.id}`}
                        label={conn.config_name || conn.configName || conn.name || conn.sessionName || 'Conexão'}
                        checked={filters?.connections.includes(conn.id) ?? false}
                        onToggle={() => toggle('connections', conn.id)}
                      />
                    ))}
                    {filteredConns.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma encontrada.</p>
                    )}
                  </FilterSection>
                )}

                {/* Usuário Atribuído */}
                {(companyUsers || []).length > 0 && (
                  <FilterSection
                    icon={<User className="h-3.5 w-3.5" />}
                    title="Usuário Atribuído"
                    count={filters?.assignedUsers.length}
                  >
                    {(companyUsers || []).length > 4 && (
                      <SectionSearch value={userSearch} onChange={setUserSearch} placeholder="Buscar usuário..." />
                    )}
                    {filteredUsers.map(user => (
                      <FilterCheckItem
                        key={user.id}
                        id={`filter-user-${user.id}`}
                        label={user.name || user.email}
                        checked={filters?.assignedUsers.includes(user.id) ?? false}
                        onToggle={() => toggle('assignedUsers', user.id)}
                      />
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">Nenhum encontrado.</p>
                    )}
                  </FilterSection>
                )}

                {/* Equipe */}
                {(companyTeams || []).length > 0 && (
                  <FilterSection
                    icon={<Users className="h-3.5 w-3.5" />}
                    title="Equipe"
                    count={filters?.teams.length}
                  >
                    {(companyTeams || []).length > 4 && (
                      <SectionSearch value={teamSearch} onChange={setTeamSearch} placeholder="Buscar equipe..." />
                    )}
                    {filteredTeams.map(team => (
                      <FilterCheckItem
                        key={team.id}
                        id={`filter-team-${team.id}`}
                        label={team.name}
                        checked={filters?.teams.includes(team.id) ?? false}
                        onToggle={() => toggle('teams', team.id)}
                      />
                    ))}
                    {filteredTeams.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma encontrada.</p>
                    )}
                  </FilterSection>
                )}

                {/* Etiquetas */}
                {(availableTags || []).length > 0 && (
                  <FilterSection
                    icon={<Tag className="h-3.5 w-3.5" />}
                    title="Etiquetas"
                    count={filters?.tags.length}
                  >
                    {(availableTags || []).length > 4 && (
                      <SectionSearch value={tagSearch} onChange={setTagSearch} placeholder="Buscar etiqueta..." />
                    )}
                    {filteredTags.map(tag => (
                      <FilterCheckItem
                        key={tag.id}
                        id={`filter-tag-${tag.id}`}
                        label={tag.name}
                        color={tag.color || undefined}
                        checked={filters?.tags.includes(tag.id) ?? false}
                        onToggle={() => toggle('tags', tag.id)}
                      />
                    ))}
                    {filteredTags.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma encontrada.</p>
                    )}
                  </FilterSection>
                )}

                <Separator className="my-1" />

                {/* Etapas */}
                {(funnel?.stages || []).length > 0 && (
                  <FilterSection
                    icon={<Layers className="h-3.5 w-3.5" />}
                    title="Etapas"
                    count={filters?.stages.length}
                  >
                    {(funnel?.stages || []).length > 5 && (
                      <SectionSearch value={stageSearch} onChange={setStageSearch} placeholder="Buscar etapa..." />
                    )}
                    {filteredStages.map((stage: KanbanStage) => (
                      <FilterCheckItem
                        key={stage.id}
                        id={`filter-stage-${stage.id}`}
                        label={stage.title}
                        checked={filters?.stages.includes(stage.id) ?? false}
                        onToggle={() => toggle('stages', stage.id)}
                      />
                    ))}
                  </FilterSection>
                )}

                {/* Data de Criação */}
                <FilterSection
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  title="Criado em"
                  count={filters?.dateRange !== 'all' ? 1 : 0}
                >
                  <div className="flex gap-1.5 flex-wrap py-1 px-1">
                    {([
                      { value: 'all'       , label: 'Todos' },
                      { value: 'today'     , label: 'Hoje' },
                      { value: 'yesterday' , label: 'Ontem' },
                      { value: '7d'        , label: '7 dias' },
                      { value: '30d'       , label: '30 dias' },
                      { value: '90d'       , label: '90 dias' },
                      { value: 'custom'    , label: 'Personalizado' },
                    ] as { value: KanbanFilters['dateRange']; label: string }[]).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onFiltersChange?.({
                          ...(filters!),
                          dateRange: value,
                          // Limpar datas ao mudar de modo
                          ...(value !== 'custom' ? { dateFrom: null, dateTo: null } : {}),
                        })}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                          filters?.dateRange === value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-border hover:bg-muted'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Período personalizado */}
                  {filters?.dateRange === 'custom' && (
                    <div className="flex flex-col gap-2 px-1 pb-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-muted-foreground w-10 flex-shrink-0">De</label>
                        <input
                          type="date"
                          value={filters?.dateFrom ?? ''}
                          onChange={e => onFiltersChange?.({ ...filters!, dateFrom: e.target.value || null })}
                          className="flex-1 h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-muted-foreground w-10 flex-shrink-0">Até</label>
                        <input
                          type="date"
                          value={filters?.dateTo ?? ''}
                          onChange={e => onFiltersChange?.({ ...filters!, dateTo: e.target.value || null })}
                          className="flex-1 h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  )}
                </FilterSection>

                {/* Valor */}
                <FilterSection
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  title="Valor (R$)"
                  count={(filters?.valueMin !== null || filters?.valueMax !== null) ? 1 : 0}
                >
                  <div className="flex items-center gap-2 px-1 py-1">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Mín"
                      className="h-7 text-xs"
                      value={filters?.valueMin ?? ''}
                      onChange={e => onFiltersChange?.({ ...filters!, valueMin: e.target.value ? Number(e.target.value) : null })}
                    />
                    <span className="text-muted-foreground text-sm flex-shrink-0">—</span>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Máx"
                      className="h-7 text-xs"
                      value={filters?.valueMax ?? ''}
                      onChange={e => onFiltersChange?.({ ...filters!, valueMax: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </FilterSection>

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

          <Button size="sm" onClick={onAddCard} id="kanban-new-lead-btn" className="h-8 px-2 sm:px-3">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Novo Lead</span>
          </Button>
        </div>
      </div>

      {/* Mobile search */}
      <div className="px-3 pb-3 lg:hidden">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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