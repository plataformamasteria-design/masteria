import { ChatListFilter } from './list/ChatListFilter';
import { ChatListItem } from './list/ChatListItem';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CountBadge } from './CountBadge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Users, Loader2, Tags, Settings2, Bot, BotOff, ArrowRightLeft, Facebook, Instagram, CheckCircle2, ChevronDown, ChevronRight, Copy, Download, Eye, Trash2, Pin, PinOff, Phone } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { ScheduledMessageBadge } from './ScheduledMessageBadge';
import { DynamicDistributionDialog } from './DynamicDistributionDialog';
import { ChatWithTags } from '@/hooks/useChatListPaginated';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewContactDialog } from './NewContactDialog';
import { CreateGroupDialog } from './CreateGroupDialog';
import { LeadAvatar } from '@/components/leads/LeadAvatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGhlMappings } from '@/hooks/use-ghl-mappings';
import { GhlBadge } from '@/components/ui/ghl-badge';
import { WhatsAppConnectionStatus } from './WhatsAppConnectionStatus';
import { InstagramConnectionStatus } from './InstagramConnectionStatus';
import { MessengerConnectionStatus } from './MessengerConnectionStatus';
import { WhatsAppCloudConnectionStatus } from './WhatsAppCloudConnectionStatus';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePhoneStore } from '@/store/usePhoneStore';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Team {
  id: string;
  name: string;
}

function TagPill({
  name,
  color,
  subtle,
}: {
  name: string;
  color?: string;
  subtle?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0 text-xs',
        'bg-muted/30 text-foreground',
        subtle && 'text-muted-foreground'
      )}
      style={
        color && !subtle
          ? { borderColor: color + '60', color, backgroundColor: color + '15' }
          : undefined
      }
    >
      {name}
    </span>
  );
}

export interface AdvancedFilters {
  onlyUnread: boolean;
  awaitingResponse: boolean;
  robotService: boolean;
  botFinished: boolean;
  humanRequested: boolean;
  conversationAssignment: boolean;
  teamId: string | null;
  agentId: string | null;
}

interface ChatListProps {
  chats: ChatWithTags[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onSelectedTagsChange: (tagIds: string[]) => void;
  tags: Tag[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  refreshChats: () => void;
  unreadCounts: { [chatId: string]: number };
  activeFilter: 'all' | 'mine' | 'team' | 'resolved';
  onFilterChange: (filter: 'all' | 'mine' | 'team' | 'resolved') => void;
  showOnlyGroups: boolean;
  onShowOnlyGroupsChange: (value: boolean) => void;
  advancedFilters: AdvancedFilters;
  onAdvancedFiltersChange: (filters: AdvancedFilters) => void;
  currentUserId?: string | null;
  userTeamIds?: string[];
  pinnedChatIds?: string[];
  onTogglePin?: (chatId: string) => void;
  isPinned?: (chatId: string) => boolean;
  pinnedCount?: number;
  maxPins?: number;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  searchQuery,
  onSearchChange,
  selectedTags,
  onSelectedTagsChange,
  tags,
  loading,
  loadingMore = false,
  hasMore = true,
  onLoadMore,
  refreshChats,
  unreadCounts,
  activeFilter,
  onFilterChange,
  showOnlyGroups,
  onShowOnlyGroupsChange,
  advancedFilters,
  onAdvancedFiltersChange,
  currentUserId,
  userTeamIds = [],
  pinnedChatIds = [],
  onTogglePin,
  isPinned,
  pinnedCount = 0,
  maxPins = 3,
}) => {
  const [dynamicDistributionOpen, setDynamicDistributionOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [agents, setAgents] = useState<{ id: string; full_name: string | null }[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const { currentOrganization } = useOrganization();
  const { getGhlId } = useGhlMappings();

  // Fetch teams and agents for filter
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const fetchTeams = async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .eq('active', true)
        .order('name');
      setTeams(data || []);
    };

    const fetchAgents = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', currentOrganization.id)
        .eq('approved', true)
        .order('full_name');
      setAgents(data || []);
    };

    fetchTeams();
    fetchAgents();
  }, [currentOrganization?.id]);

  // Display chats - onlyUnread is now filtered at DB level
  const displayChats = chats;

  useEffect(() => {
    if (!onLoadMore) return;

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Use the scroll viewport as root for proper intersection detection
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          onLoadMore();
        }
      },
      {
        root: scrollViewportRef.current,
        rootMargin: '200px'
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onLoadMore, hasMore, loadingMore, loading]);







  const hasActiveAdvancedFilters =
    advancedFilters.onlyUnread ||
    advancedFilters.awaitingResponse ||
    advancedFilters.robotService ||
    advancedFilters.conversationAssignment ||
    !!advancedFilters.teamId ||
    !!advancedFilters.agentId;

  // For "mine" filter - count unread chats assigned to current user
  const mineUnreadCount = chats.filter(chat =>
    chat.assigned_to === currentUserId &&
    !chat.resolved_at && // Added check for resolved
    unreadCounts[chat.id] &&
    unreadCounts[chat.id] > 0
  ).length;

  // For "team" filter - count unread chats assigned to user's teams (UNASSIGNED)
  const teamUnreadCount = chats.filter(chat =>
    chat.team_id &&
    !chat.assigned_to &&
    !chat.is_group &&
    !chat.resolved_at &&
    userTeamIds.includes(chat.team_id) &&
    unreadCounts[chat.id] &&
    unreadCounts[chat.id] > 0
  ).length;

  const allUnreadChatsCount = chats.filter(chat =>
    !chat.resolved_at &&
    unreadCounts[chat.id] &&
    unreadCounts[chat.id] > 0
  ).length;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <ChatListFilter
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedTags={selectedTags}
        onSelectedTagsChange={onSelectedTagsChange}
        tags={tags}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
        mineUnreadCount={mineUnreadCount}
        teamUnreadCount={teamUnreadCount}
        allUnreadChatsCount={allUnreadChatsCount}
        showOnlyGroups={showOnlyGroups}
        onShowOnlyGroupsChange={onShowOnlyGroupsChange}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={onAdvancedFiltersChange}
        hasActiveAdvancedFilters={hasActiveAdvancedFilters}
        teams={teams}
        agents={agents}
        currentOrganization={currentOrganization}
        setDynamicDistributionOpen={setDynamicDistributionOpen}
        onSelectChat={onSelectChat}
        refreshChats={refreshChats}
      />

      <DynamicDistributionDialog
        open={dynamicDistributionOpen}
        onOpenChange={setDynamicDistributionOpen}
        teams={teams}
      />

      {/* Lista de conversas */}
      <ScrollArea className="flex-1" viewportRef={scrollViewportRef}>
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Carregando conversas...
          </div>
        ) : displayChats.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {showOnlyGroups && 'Nenhum grupo encontrado'}
            {!showOnlyGroups && activeFilter === 'mine' && 'Nenhuma conversa atribuída a você'}
            {!showOnlyGroups && activeFilter === 'team' && 'Nenhuma conversa atribuída à sua equipe'}
            {!showOnlyGroups && activeFilter === 'all' && 'Nenhuma conversa encontrada'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Separated pinned + regular chats */}
            {(() => {
              const pinned = displayChats.filter(c => pinnedChatIds.includes(c.id));
              const regular = displayChats.filter(c => !pinnedChatIds.includes(c.id));

              const renderChatCard = (chat: any, showPinIndicator: boolean) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  showPinIndicator={showPinIndicator}
                  selectedChatId={selectedChatId}
                  onSelectChat={onSelectChat}
                  unreadCounts={unreadCounts}
                  getGhlId={getGhlId}
                  onTogglePin={onTogglePin}
                  isPinned={isPinned}
                  pinnedCount={pinnedCount}
                  maxPins={maxPins}
                />
              );


              return (
                <>
                  {pinned.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Pin className="h-3 w-3 rotate-45" />
                          Fixadas ({pinned.length}/{maxPins})
                        </span>
                      </div>
                      {pinned.map(chat => renderChatCard(chat, true))}
                      {regular.length > 0 && (
                        <div className="px-3 py-1 bg-muted/30 border-b border-border">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Todas as conversas
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {regular.map(chat => renderChatCard(chat, false))}
                </>
              );
            })()}

            {hasMore && (
              <div ref={loadMoreRef} className="p-4 text-center">
                {loadingMore && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Carregando mais...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};