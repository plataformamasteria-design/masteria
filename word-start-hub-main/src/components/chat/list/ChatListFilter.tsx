import React, { useState, useEffect } from 'react';
import { Search, Tags, Users, Settings2, ChevronRight, Bot, ArrowRightLeft, Trash2, Phone, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CountBadge } from '../CountBadge';
import { WhatsAppConnectionStatus } from '../WhatsAppConnectionStatus';
import { InstagramConnectionStatus } from '../InstagramConnectionStatus';
import { MessengerConnectionStatus } from '../MessengerConnectionStatus';
import { WhatsAppCloudConnectionStatus } from '../WhatsAppCloudConnectionStatus';
import { NewContactDialog } from '../NewContactDialog';
import { CreateGroupDialog } from '../CreateGroupDialog';
import { cn } from '@/lib/utils';
import { usePhoneStore } from '@/store/usePhoneStore';
import { useMultiWhatsApp } from '@/hooks/useMultiWhatsApp';

export function ChatListFilter({
    searchQuery, onSearchChange,
    selectedTags, onSelectedTagsChange, tags,
    activeFilter, onFilterChange,
    mineUnreadCount, teamUnreadCount, allUnreadChatsCount,
    showOnlyGroups, onShowOnlyGroupsChange,
    advancedFilters, onAdvancedFiltersChange, hasActiveAdvancedFilters,
    teams, agents,
    currentOrganization,
    setDynamicDistributionOpen,
    onSelectChat, refreshChats
}: any) {
    const [tagFilterOpen, setTagFilterOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const { openPhone } = usePhoneStore();
    const { connections } = useMultiWhatsApp();
    const [localSearch, setLocalSearch] = useState(searchQuery);

    // Sincronizar com o pai se o filtro for limpo externamente
    useEffect(() => {
        setLocalSearch(searchQuery);
    }, [searchQuery]);

    // Debounce local de 400ms para evitar travamentos de re-renderização massiva do chat
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (localSearch !== searchQuery) {
                onSearchChange(localSearch);
            }
        }, 400);
        return () => clearTimeout(timeoutId);
    }, [localSearch]);

    const handleTagToggle = (tagId: string) => {
        if (selectedTags.includes(tagId)) {
            onSelectedTagsChange(selectedTags.filter((id: string) => id !== tagId));
        } else {
            onSelectedTagsChange([...selectedTags, tagId]);
        }
    };

    const clearAllTags = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectedTagsChange([]);
    };

    return (
        <div className="p-3 border-b border-border bg-card space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground shrink-0">Conversas</h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => openPhone()}
                        className="p-1.5 rounded-full hover:bg-muted transition-colors"
                        title="Abrir Telefone"
                    >
                        <Phone className="h-4 w-4 text-emerald-500" />
                    </button>
                    <WhatsAppConnectionStatus />
                    <InstagramConnectionStatus />
                    <MessengerConnectionStatus />
                    <WhatsAppCloudConnectionStatus />
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <NewContactDialog
                    onChatCreated={onSelectChat}
                    onRefresh={refreshChats}
                />
                <CreateGroupDialog
                    onChatCreated={onSelectChat}
                    onRefresh={refreshChats}
                />
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="pl-9 pr-10 bg-muted border-border h-9"
                />

                {/* Tag filter button inside search bar */}
                <TooltipProvider>
                    <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                    <button
                                        className={cn(
                                            "absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300",
                                            "hover:bg-background focus:outline-none",
                                            selectedTags.length > 0 && "ring-2 ring-primary/30"
                                        )}
                                    >
                                        {selectedTags.length > 0 ? (
                                            <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-sm">
                                                <span className="text-[9px] font-bold text-primary-foreground">
                                                    {selectedTags.length}
                                                </span>
                                            </div>
                                        ) : (
                                            <Tags className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                        )}
                                    </button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                                {selectedTags.length > 0
                                    ? `${selectedTags.length} etiqueta(s) selecionada(s)`
                                    : 'Filtrar por etiquetas'}
                            </TooltipContent>
                        </Tooltip>

                        <PopoverContent className="w-[200px] p-0 z-50 bg-popover" align="end">
                            <div className="p-2 border-b border-border flex items-center justify-between">
                                <span className="text-sm font-medium">Etiquetas</span>
                                {selectedTags.length > 0 && (
                                    <button
                                        onClick={clearAllTags}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Limpar
                                    </button>
                                )}
                            </div>
                            <ScrollArea className="max-h-[200px]">
                                <div className="p-1.5 space-y-0.5">
                                    {tags.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                            Nenhuma etiqueta
                                        </p>
                                    ) : (
                                        tags.map((tag: any) => (
                                            <label
                                                key={tag.id}
                                                className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted transition-colors"
                                            >
                                                <Checkbox
                                                    checked={selectedTags.includes(tag.id)}
                                                    onCheckedChange={() => handleTagToggle(tag.id)}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: tag.color }}
                                                />
                                                <span className="text-xs truncate flex-1">{tag.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </TooltipProvider>
            </div>

            {/* New Filter Layout: Tabs + Icon Buttons */}
            <div className="flex items-center gap-1.5">
                <Tabs value={activeFilter} onValueChange={(v) => onFilterChange(v as any)} className="flex-1 min-w-0">
                    <TabsList className="grid w-full grid-cols-4 h-auto p-0.5">
                        <TabsTrigger value="mine" className="relative text-[10px] px-1 py-1">
                            Minhas
                            <CountBadge count={mineUnreadCount} variant="primary" />
                        </TabsTrigger>
                        <TabsTrigger value="team" className="relative text-[10px] px-1 py-1">
                            Equipe
                            <CountBadge count={teamUnreadCount} variant="primary" />
                        </TabsTrigger>
                        <TabsTrigger value="all" className="relative text-[10px] px-1 py-1">
                            Todas
                            <CountBadge count={allUnreadChatsCount} variant="destructive" />
                        </TabsTrigger>
                        <TabsTrigger value="resolved" className="relative text-[10px] px-1 py-1">
                            Resolvidas
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Groups toggle button */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={showOnlyGroups ? "default" : "ghost"}
                                size="icon"
                                className={cn(
                                    "h-8 w-8 shrink-0",
                                    showOnlyGroups && "bg-green-600 hover:bg-green-700"
                                )}
                                onClick={() => onShowOnlyGroupsChange(!showOnlyGroups)}
                            >
                                <Users className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                            {showOnlyGroups ? 'Mostrar todas as conversas' : 'Mostrar apenas grupos'}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {/* Advanced filters button */}
                <TooltipProvider>
                    <Popover open={configOpen} onOpenChange={setConfigOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={hasActiveAdvancedFilters ? "default" : "ghost"}
                                        size="icon"
                                        className={cn(
                                            "h-8 w-8 shrink-0",
                                            hasActiveAdvancedFilters && "bg-primary"
                                        )}
                                    >
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                                Filtros avançados
                            </TooltipContent>
                        </Tooltip>

                        <PopoverContent className="w-[280px] p-0 z-50 bg-background/80 backdrop-blur-md border-white/10 shadow-xl overflow-hidden rounded-xl" align="end">
                            <div className="p-4 border-b border-border/50 bg-muted/30">
                                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Settings2 className="h-4 w-4 text-primary" />
                                    Filtros Avançados
                                </span>
                            </div>
                            <ScrollArea className="max-h-[65vh]">
                              <div className="p-4 space-y-4">
                                {/* Dynamic distribution */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Equipe & Distribuição</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-between text-xs bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-primary/30 transition-all group"
                                        onClick={() => {
                                            setConfigOpen(false);
                                            setDynamicDistributionOpen(true);
                                        }}
                                        disabled={!currentOrganization?.id}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Users className="h-3.5 w-3.5 text-primary/70" />
                                            Distribuição Dinâmica
                                        </span>
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                                    </Button>
                                </div>

                                <div className="space-y-2.5 pt-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Estados da Conversa</span>
                                    </div>

                                    <label className="flex items-center gap-3 cursor-pointer group hover:bg-muted/30 p-1 rounded-md transition-colors">
                                        <Checkbox
                                            checked={advancedFilters.onlyUnread}
                                            onCheckedChange={(checked) =>
                                                onAdvancedFiltersChange({ ...advancedFilters, onlyUnread: checked as boolean })
                                            }
                                            className="data-[state=checked]:bg-primary border-muted-foreground/30"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium group-hover:text-primary transition-colors">Apenas não lidas</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group hover:bg-muted/30 p-1 rounded-md transition-colors">
                                        <Checkbox
                                            checked={advancedFilters.awaitingResponse}
                                            onCheckedChange={(checked) =>
                                                onAdvancedFiltersChange({ ...advancedFilters, awaitingResponse: checked as boolean })
                                            }
                                            className="data-[state=checked]:bg-primary border-muted-foreground/30"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium group-hover:text-primary transition-colors">Aguardando resposta</span>
                                            <span className="text-[11px] text-muted-foreground">Conversas sem retorno nosso</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group hover:bg-muted/30 p-1 rounded-md transition-colors">
                                        <Checkbox
                                            checked={advancedFilters.robotService}
                                            onCheckedChange={(checked) =>
                                                onAdvancedFiltersChange({ ...advancedFilters, robotService: checked as boolean })
                                            }
                                            className="data-[state=checked]:bg-primary border-muted-foreground/30"
                                        />
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium group-hover:text-primary transition-colors">Robô Ativo</span>
                                            <Bot className="h-3.5 w-3.5 text-primary/60 group-hover:text-primary transition-colors" />
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group hover:bg-muted/30 p-1 rounded-md transition-colors">
                                        <Checkbox
                                            checked={advancedFilters.botFinished}
                                            onCheckedChange={(checked) =>
                                                onAdvancedFiltersChange({ ...advancedFilters, botFinished: checked as boolean })
                                            }
                                            className="data-[state=checked]:bg-emerald-500 border-muted-foreground/30"
                                        />
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium group-hover:text-emerald-500 transition-colors">Pronto (Robô Concluído)</span>
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/60 group-hover:text-emerald-500 transition-colors" />
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group hover:bg-muted/30 p-1 rounded-md transition-colors">
                                        <Checkbox
                                            checked={advancedFilters.humanRequested}
                                            onCheckedChange={(checked) =>
                                                onAdvancedFiltersChange({ ...advancedFilters, humanRequested: checked as boolean })
                                            }
                                            className="data-[state=checked]:bg-yellow-500 border-muted-foreground/30"
                                        />
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium group-hover:text-yellow-600 transition-colors">Solicitando Atendente</span>
                                            <Bot className="h-3.5 w-3.5 text-yellow-500/80 group-hover:text-yellow-600 transition-colors" />
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group hover:bg-muted/30 p-1 rounded-md transition-colors">
                                        <Checkbox
                                            checked={advancedFilters.conversationAssignment}
                                            onCheckedChange={(checked) =>
                                                onAdvancedFiltersChange({
                                                    ...advancedFilters,
                                                    conversationAssignment: checked as boolean,
                                                })
                                            }
                                            className="data-[state=checked]:bg-blue-500 border-muted-foreground/30"
                                        />
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium group-hover:text-blue-500 transition-colors">Em Transferência</span>
                                            <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500/60 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    </label>
                                </div>

                                <div className="pt-2 border-t border-border">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                                        Filtrar por equipe
                                    </Label>
                                    <Select
                                        value={advancedFilters.teamId || "all"}
                                        onValueChange={(value) =>
                                            onAdvancedFiltersChange({
                                                ...advancedFilters,
                                                teamId: value === "all" ? null : value
                                            })
                                        }
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Todas as equipes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas as equipes</SelectItem>
                                            {teams.map((team: any) => (
                                                <SelectItem key={team.id} value={team.id}>
                                                    {team.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="pt-2 border-t border-border">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                                        Filtrar por agente
                                    </Label>
                                    <Select
                                        value={advancedFilters.agentId || "all"}
                                        onValueChange={(value) =>
                                            onAdvancedFiltersChange({
                                                ...advancedFilters,
                                                agentId: value === "all" ? null : value
                                            })
                                        }
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Todos os agentes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os agentes</SelectItem>
                                            {agents.map((agent: any) => (
                                                <SelectItem key={agent.id} value={agent.id}>
                                                    {agent.full_name || 'Sem nome'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="pt-2 border-t border-border">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                                        Filtrar por conexão
                                    </Label>
                                    <Select
                                        value={advancedFilters.channel || "all"}
                                        onValueChange={(value) =>
                                            onAdvancedFiltersChange({
                                                ...advancedFilters,
                                                channel: value === "all" ? null : value
                                            })
                                        }
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Todas as conexões" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas as conexões</SelectItem>
                                            {connections?.map((conn: any) => (
                                                <SelectItem key={conn.id} value={conn.instance_name}>
                                                    {conn.display_name || conn.instance_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="pt-2 border-t border-border/50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-[11px] h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                                        onClick={() => onAdvancedFiltersChange({
                                            onlyUnread: false,
                                            awaitingResponse: false,
                                            robotService: false,
                                            botFinished: false,
                                            humanRequested: false,
                                            conversationAssignment: false,
                                            teamId: null,
                                            agentId: null,
                                            channel: null
                                        })}
                                    >
                                        <Trash2 className="h-3 w-3 mr-2" />
                                        Limpar filtros
                                    </Button>
                                </div>
                              </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </TooltipProvider>
            </div>
        </div>
    );
}
