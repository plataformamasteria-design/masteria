// src/components/atendimentos/conversation-list.tsx
'use client';

import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import type { Conversation, Message } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Search, Check, CheckCheck, Clock, MessageSquare, Smartphone, FileText,
    Loader2, X, Instagram, SlidersHorizontal, BellDot, MessageCircle, Bot,
    Users, User, ChevronDown, Hash, Columns3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/contexts/session-context';
import { Badge } from '../ui/badge';
import { RelativeTime } from '../ui/relative-time';
import { Button } from '../ui/button';
import { Switch } from '@/components/ui/switch';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import type { AdvancedFilters } from '@/services/api/conversations-service';
import {
    getOrganizationUsers,
    getOrganizationTeams,
    getOrganizationTags,
    getOrganizationKanbanBoards
} from '@/app/actions/chat-assignment';


function StatusIcon({ status }: { status: Message['status'] }) {
    switch (status) {
        case 'sent': return <Check className="h-3.5 w-3.5 text-muted-foreground/50" />;
        case 'delivered': return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/50" />;
        case 'read': return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
        case 'failed': return <X className="h-3.5 w-3.5 text-destructive/60" />;
        default: return <Clock className="h-3 w-3 text-muted-foreground/30" />;
    }
}

// --- Individual Conversation Card ---

const ConversationListItem = memo(({ conversation, isSelected, onSelect }: { conversation: Conversation, isSelected: boolean, onSelect: (id: string) => void }) => {
    const lastMsg = conversation.lastMessage || '';
    const isFromContact = conversation.lastMessageSenderType && !['SYSTEM', 'USER'].includes(conversation.lastMessageSenderType);

    const renderLastMsg = () => {
        if (!lastMsg) return 'Sem mensagens';
        if (lastMsg.startsWith('Template:')) {
            const tName = lastMsg.replace('Template:', '').trim();
            const formatted = tName.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/_/g, ' ');
            return (
                <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3 shrink-0 opacity-70" />
                    <span className="capitalize">{formatted}</span>
                </span>
            );
        }
        return lastMsg;
    };

    return (
        <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(conversation.id)}
            className={cn(
                "w-full flex items-center gap-3.5 px-4 py-3.5 transition-all duration-200 text-left group relative outline-none border-b border-border/40 box-border overflow-hidden",
                isSelected
                    ? "bg-zinc-100 dark:bg-white/[0.04] border-l-[3px] border-l-primary"
                    : "bg-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.02] border-l-[3px] border-l-transparent"
            )}
            style={{ maxWidth: '100%' }}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <Avatar className="h-[46px] w-[46px]">
                    <AvatarImage src={conversation.contactAvatar || undefined} alt={conversation.contactName || ''} />
                    <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-[14px] font-semibold text-zinc-600 dark:text-zinc-400">
                        {(conversation.contactName || '?').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                {/* Status indicator */}
                {conversation.aiActive && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center ring-2 ring-white dark:ring-[#111b21]" title="IA Ativa">
                        <Bot className="h-2.5 w-2.5 text-white" />
                    </div>
                )}
            </div>

            {/* Content Container */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                {/* Top Row: Name + Time */}
                <div className="flex items-center justify-between w-full min-w-0 mb-0.5">
                    <span className={cn(
                        "text-[15px] font-medium tracking-tight truncate",
                        isSelected ? "text-foreground" : "text-foreground"
                    )}>
                        {conversation.contactName || conversation.phone || 'Desconhecido'}
                    </span>
                    <div className="flex-shrink-0 text-[12px] text-muted-foreground whitespace-nowrap ml-2">
                        <RelativeTime date={conversation.lastMessageAt} />
                    </div>
                </div>

                {/* Bottom Row: Status + Message + Labels */}
                <div className="flex items-center gap-1 w-full min-w-0 overflow-hidden">
                    {conversation.lastMessageStatus && !isFromContact && (
                        <StatusIcon status={conversation.lastMessageStatus} />
                    )}
                    <span className={cn(
                        "text-[13px] truncate flex-1 min-w-0 leading-relaxed",
                        isFromContact && conversation.lastMessageStatus !== 'read' ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}>
                        {renderLastMsg()}
                    </span>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                        {/* API/WA Label */}
                        {conversation.connectionType && (
                            <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider max-w-[100px] truncate",
                                conversation.connectionType === 'meta_api' ? "text-emerald-500 bg-emerald-500/10" : 
                                conversation.connectionType === 'instagram' ? "text-pink-500 bg-pink-500/10" : "text-blue-500 bg-blue-500/10"
                            )} title={conversation.connectionName || undefined}>
                                {conversation.connectionName ? conversation.connectionName : (conversation.connectionType === 'meta_api' ? 'API' : conversation.connectionType === 'instagram' ? 'IG' : 'WA')}
                            </span>
                        )}

                        {/* Assignment */}
                        {conversation.assignedTo ? (
                            <span className="text-[9px] font-medium text-muted-foreground flex items-center gap-0.5 bg-muted/50 px-1.5 py-0.5 rounded-sm max-w-[70px] truncate" title={`Atribuído a ${conversation.assignedUserName}`}>
                                <User className="h-3 w-3 shrink-0" />
                                <span className="truncate">{conversation.assignedUserName?.split(' ')[0] || 'User'}</span>
                            </span>
                        ) : conversation.teamId ? (
                            <span className="text-[9px] font-medium text-muted-foreground flex items-center gap-0.5 bg-muted/50 px-1.5 py-0.5 rounded-sm max-w-[70px] truncate" title={`Atribuído a equipe: ${conversation.teamName}`}>
                                <Users className="h-3 w-3 shrink-0" />
                                <span className="truncate">{conversation.teamName || 'Equipe'}</span>
                            </span>
                        ) : null}

                        {/* Unread */}
                        {isFromContact && conversation.lastMessageStatus !== 'read' && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 ml-0.5">
                            </div>
                        )}
                    </div>
                </div>
                
                {/* 3rd Row: Tags */}
                {conversation.tags && conversation.tags.length > 0 && (
                     <div className="flex items-center gap-1 mt-1 w-full min-w-0 overflow-hidden flex-nowrap">
                        {conversation.tags.slice(0, 3).map(t => (
                             <span key={t.id} className="text-[9px] font-medium px-1.5 py-0.5 rounded-[4px] truncate max-w-[70px] shrink-0" style={{ color: t.color, backgroundColor: `${t.color}15` }}>
                                 {t.name}
                             </span>
                        ))}
                        {conversation.tags.length > 3 && (
                            <span className="text-[9px] text-muted-foreground">+{conversation.tags.length - 3}</span>
                        )}
                     </div>
                )}
            </div>
        </motion.button>
    );
}, (prev, next) => {
    return prev.isSelected === next.isSelected && 
           prev.conversation.id === next.conversation.id && 
           prev.conversation.lastMessageAt === next.conversation.lastMessageAt && 
           prev.conversation.lastMessageStatus === next.conversation.lastMessageStatus && 
           prev.conversation.assignedTo === next.conversation.assignedTo &&
           prev.conversation.aiActive === next.conversation.aiActive &&
           prev.conversation.contactAvatar === next.conversation.contactAvatar;
});



// --- Advanced Filters Panel ---

interface AdvancedFiltersPanelProps {
    filters: AdvancedFilters;
    onFiltersChange: (filters: AdvancedFilters) => void;
}

function AdvancedFiltersPanel({ filters, onFiltersChange }: AdvancedFiltersPanelProps) {
    const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
    const [agents, setAgents] = useState<{ id: string; name: string | null }[]>([]);
    const [tagsList, setTagsList] = useState<{ id: string; name: string; color: string }[]>([]);
    const [boardsList, setBoardsList] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        getOrganizationTeams().then(res => {
            if (res.success && res.data) setTeams(res.data);
        });
        getOrganizationUsers().then(res => {
            if (res.success && res.data) setAgents(res.data.map((u: any) => ({ id: u.id, name: u.name || u.email })));
        });
        getOrganizationTags().then(res => {
            if (res.success && res.data) setTagsList(res.data);
        });
        getOrganizationKanbanBoards().then(res => {
            if (res.success && res.data) setBoardsList(res.data);
        });
    }, []);

    const toggle = (key: 'onlyUnread' | 'awaitingResponse' | 'robotService') => {
        onFiltersChange({ ...filters, [key]: !filters[key] });
    };

    const activeCount = [
        filters.onlyUnread, filters.awaitingResponse, filters.robotService,
        !!filters.filterTeamId, !!filters.filterAgentId, !!filters.filterTagId, !!filters.filterKanbanId
    ].filter(Boolean).length;

    return (
        <div className="space-y-2.5 px-1 bg-background pt-1">
            {/* Toggle Filters */}
            <div className="space-y-1.5">
                <FilterToggle
                    icon={BellDot}
                    label="Apenas não lidos"
                    active={filters.onlyUnread}
                    onToggle={() => toggle('onlyUnread')}
                    color="text-amber-500"
                />
                <FilterToggle
                    icon={MessageCircle}
                    label="Aguardando resposta"
                    active={filters.awaitingResponse}
                    onToggle={() => toggle('awaitingResponse')}
                    color="text-blue-500"
                />
                <FilterToggle
                    icon={Bot}
                    label="Atendimento robô"
                    active={filters.robotService}
                    onToggle={() => toggle('robotService')}
                    color="text-violet-500"
                />
            </div>

            {/* Dropdown filters */}
            <div className="space-y-1.5 pt-2">
                {teams.length > 0 && (
                    <Select
                        value={filters.filterTeamId || '__all__'}
                        onValueChange={(v) => onFiltersChange({ ...filters, filterTeamId: v === '__all__' ? null : v })}
                    >
                        <SelectTrigger className="h-8 text-xs font-medium border-border/50">
                            <div className="flex items-center gap-1.5 focus:outline-none focus:ring-0">
                                <Users className="h-3 w-3 text-cyan-600" />
                                <SelectValue placeholder="Filtrar por equipe" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">Todas as equipes</SelectItem>
                            {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}

                {agents.length > 0 && (
                    <Select
                        value={filters.filterAgentId || '__all__'}
                        onValueChange={(v) => onFiltersChange({ ...filters, filterAgentId: v === '__all__' ? null : v })}
                    >
                        <SelectTrigger className="h-8 text-xs font-medium border-border/50">
                            <div className="flex items-center gap-1.5 focus:outline-none focus:ring-0">
                                <User className="h-3 w-3 text-indigo-600" />
                                <SelectValue placeholder="Filtrar por agente" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">Todos os agentes</SelectItem>
                            {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name || 'Sem nome'}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}

                {tagsList.length > 0 && (
                    <Select
                        value={filters.filterTagId || '__all__'}
                        onValueChange={(v) => onFiltersChange({ ...filters, filterTagId: v === '__all__' ? null : v })}
                    >
                        <SelectTrigger className="h-8 text-xs font-medium border-border/50">
                            <div className="flex items-center gap-1.5 focus:outline-none focus:ring-0">
                                <Hash className="h-3 w-3 text-emerald-600" />
                                <SelectValue placeholder="Filtrar por etiqueta" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">Todas as etiquetas</SelectItem>
                            {tagsList.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#ccc' }} />
                                        {t.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {boardsList.length > 0 && (
                    <Select
                        value={filters.filterKanbanId || '__all__'}
                        onValueChange={(v) => onFiltersChange({ ...filters, filterKanbanId: v === '__all__' ? null : v })}
                    >
                        <SelectTrigger className="h-8 text-xs font-medium border-border/50">
                            <div className="flex items-center gap-1.5 focus:outline-none focus:ring-0">
                                <Columns3 className="h-3 w-3 text-rose-500" />
                                <SelectValue placeholder="Filtrar por funil (CRM)" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">Todos os funis</SelectItem>
                            {boardsList.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Clear all */}
            {activeCount > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-[10px] text-muted-foreground hover:text-destructive mt-3"
                    onClick={() => onFiltersChange({ onlyUnread: false, awaitingResponse: false, robotService: false, filterTeamId: null, filterAgentId: null, filterKanbanId: null, filterTagId: null })}
                >
                    Limpar todos os filtros ({activeCount})
                </Button>
            )}
        </div>
    );
}

function FilterToggle({ icon: Icon, label, active, onToggle, color }: {
    icon: any; label: string; active: boolean; onToggle: () => void; color: string;
}) {
    return (
        <button
            onClick={onToggle}
            className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-300",
                active
                    ? "bg-muted text-foreground shadow-sm font-medium"
                    : "text-muted-foreground border border-transparent hover:bg-muted/50 hover:text-foreground"
            )}
        >
            <Icon className={cn("h-3.5 w-3.5", active ? "text-primary" : color)} />
            <span className="flex-1 text-left font-medium">{label}</span>
            <div className={cn(
                "w-7 h-4 rounded-full relative transition-all duration-200",
                active ? "bg-primary" : "bg-muted-foreground/20"
            )}>
                <div className={cn(
                    "w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all duration-200",
                    active ? "left-3.5" : "left-0.5"
                )} />
            </div>
        </button>
    );
}


// --- Main ConversationList ---

interface ConversationListProps {
    conversations: Conversation[];
    currentConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
    isSearching?: boolean;
    activeFilter?: 'all' | 'mine' | 'team' | 'resolved';
    onFilterChange?: (filter: 'all' | 'mine' | 'team' | 'resolved') => void;
    advancedFilters?: AdvancedFilters;
    onAdvancedFiltersChange?: (filters: AdvancedFilters) => void;
}

export function ConversationList({
    conversations,
    currentConversationId,
    onSelectConversation,
    onLoadMore,
    hasMore = false,
    isLoadingMore = false,
    searchTerm = '',
    onSearchChange,
    isSearching = false,
    activeFilter,
    onFilterChange,
    advancedFilters,
    onAdvancedFiltersChange,
}: ConversationListProps) {
    const [localSearch, setLocalSearch] = useState(searchTerm);
    const [sourceFilter, setSourceFilter] = useState<'all' | 'meta_api' | 'baileys' | 'instagram'>('all');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    
    const { session } = useSession();
    const userPermissions = session?.userData?.permissions as { viewMode?: string } | undefined;
    const isLimitedView = session?.userData?.role === 'atendente' && userPermissions?.viewMode === 'assigned_only';
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setLocalSearch(searchTerm);
    }, [searchTerm]);

    const handleSearchInputChange = useCallback((value: string) => {
        setLocalSearch(value);

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            onSearchChange?.(value);
        }, 500);
    }, [onSearchChange]);

    const handleClearSearch = useCallback(() => {
        setLocalSearch('');
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        onSearchChange?.('');
    }, [onSearchChange]);

    useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []);

    const filteredConversations = useMemo(() => {
        let filtered = conversations;

        if (sourceFilter !== 'all') {
            if (sourceFilter === 'baileys') {
                filtered = filtered.filter(c => ['baileys', 'evolution'].includes(c.connectionType || ''));
            } else {
                filtered = filtered.filter(c => c.connectionType === sourceFilter);
            }
        }

        return filtered;
    }, [conversations, sourceFilter]);

    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current || !onLoadMore || !hasMore || isLoadingMore) return;

        const container = scrollContainerRef.current;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        const threshold = 100;
        if (scrollHeight - scrollTop - clientHeight < threshold) {
            onLoadMore();
        }
    }, [onLoadMore, hasMore, isLoadingMore]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    const filterOptions = [
        { value: 'all', label: 'Todas', icon: null },
        { value: 'meta_api', label: 'Business', icon: MessageSquare },
        { value: 'baileys', label: 'Normal', icon: Smartphone },
        { value: 'instagram', label: 'Insta', icon: Instagram },
    ] as const;

    const advFilterCount = advancedFilters
        ? [advancedFilters.onlyUnread, advancedFilters.awaitingResponse, advancedFilters.robotService, !!advancedFilters.filterTeamId, !!advancedFilters.filterAgentId].filter(Boolean).length
        : 0;

    return (
        <div className="h-full flex flex-col min-h-0 overflow-hidden bg-transparent">
            <div className="shrink-0 bg-transparent border-b border-border/40 backdrop-blur-md">
                {/* Search & Toggle Row */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="relative group flex-1">
                        {isSearching ? (
                            <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 animate-spin" />
                        ) : (
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors" />
                        )}
                        <Input
                            placeholder="Buscar conversa..."
                            className="pl-10 pr-9 h-9 rounded-lg bg-white dark:bg-[#111b21] border-none text-[13px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-border/50 transition-all duration-300 shadow-none"
                            value={localSearch}
                            onChange={(e) => handleSearchInputChange(e.target.value)}
                        />
                        {localSearch && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground/50 hover:text-foreground bg-transparent"
                                onClick={handleClearSearch}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                    
                    {/* Advanced Filters toggle button */}
                    {onAdvancedFiltersChange && (
                        <button
                            type="button"
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={cn(
                                "flex items-center justify-center w-[36px] h-[36px] shrink-0 rounded-lg text-muted-foreground hover:text-foreground transition-colors relative",
                                showAdvancedFilters || advFilterCount > 0
                                    ? "bg-zinc-200/50 dark:bg-white/10 text-foreground"
                                    : "hover:bg-zinc-200/50 dark:hover:bg-white/5"
                            )}
                            title="Filtros avançados"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            {advFilterCount > 0 && (
                                <span className="absolute 1 top-1 right-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-zinc-50 dark:ring-[#202c33]"></span>
                            )}
                        </button>
                    )}
                </div>

                {/* Expanded Filters */}
                {showAdvancedFilters && (
                    <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex gap-2 w-full">
                            {onFilterChange && activeFilter && (
                                <div className="flex-1">
                                    <Select value={activeFilter} onValueChange={(v) => onFilterChange(v as any)}>
                                        <SelectTrigger className="w-full h-[32px] bg-white dark:bg-[#111b21] rounded-md text-[11px] font-medium border-border/40 shadow-none">
                                            <SelectValue placeholder="Estado" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="mine" className="text-[11px]">Minhas</SelectItem>
                                            {!isLimitedView && (
                                                <>
                                                    <SelectItem value="team" className="text-[11px]">Equipe</SelectItem>
                                                    <SelectItem value="all" className="text-[11px]">Todas</SelectItem>
                                                </>
                                            )}
                                            <SelectItem value="resolved" className="text-[11px]">📦 Arquivadas</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="flex-1">
                                <Select value={sourceFilter} onValueChange={(v: any) => setSourceFilter(v)}>
                                    <SelectTrigger className="w-full h-[32px] bg-white dark:bg-[#111b21] rounded-md text-[11px] font-medium border-border/40 shadow-none">
                                        <SelectValue placeholder="Canal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filterOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-[11px]">
                                                <div className="flex items-center gap-1.5">
                                                    {opt.icon && <opt.icon className="h-3 w-3" />}
                                                    {opt.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {advancedFilters && onAdvancedFiltersChange && (
                            <div className="p-2 rounded-lg bg-white/50 dark:bg-[#111b21]/50 border border-border/30">
                                <AdvancedFiltersPanel filters={advancedFilters} onFiltersChange={onAdvancedFiltersChange} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ScrollArea className="flex-1 min-h-0 relative bg-transparent overflow-hidden" viewportRef={scrollContainerRef}>
                <div className="flex flex-col w-full overflow-hidden">
                    {filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 mt-10 text-center animate-in fade-in duration-500">
                            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                                <MessageSquare className="h-6 w-6 opacity-40 text-muted-foreground" />
                            </div>
                            <p className="text-[13px] font-medium tracking-tight text-foreground/80">Nenhuma conversa</p>
                            <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">Ajuste filtros ou busque novamente.</p>
                        </div>
                    ) : (
                        <>
                            {filteredConversations.map(conversation => (
                                <ConversationListItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    isSelected={currentConversationId === conversation.id}
                                    onSelect={onSelectConversation}
                                />
                            ))}
                            {hasMore && (
                                <div
                                    ref={loadMoreTriggerRef}
                                    className="flex justify-center py-4"
                                >
                                    {isLoadingMore ? (
                                        <div className="flex items-center gap-2 text-muted-foreground/50">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-xs font-medium">Carregando mais...</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground/40 font-medium">
                                            Role para carregar mais
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
