import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useOrganization } from '@/contexts/OrganizationContext';

// Extended chat shape used by the UI.
// NOTE: Keep as a lightweight structural type to avoid TS deep instantiation issues
// coming from generated DB types.
export interface ChatWithTags {
  id: string;
  organization_id: string;
  phone: string;
  is_group: boolean;
  agent_off: boolean;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  resolved_at?: string | null;
  hidden_from_chat?: boolean;
  assigned_to?: string | null;
  team_id?: string | null;
  wa_name?: string | null;
  wa_photo_url?: string | null;
  group_name?: string | null;
  group_photo_url?: string | null;
  participant_count?: number | null;
  name_locked?: boolean | null;
  channel?: string;
  tags?: Array<{ id: string; name: string; color: string; icon?: string }>;
  unreadCount?: number;
  assigned_profile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  human_requested_at?: string | null;
  transfer_requested_at?: string | null;
  campaign_name?: string | null;
  ad_name?: string | null;
}

export type ChatFilter = 'all' | 'mine' | 'team' | 'resolved';

export interface AdvancedFilters {
  onlyUnread: boolean;
  awaitingResponse: boolean;
  robotService: boolean;
  conversationAssignment: boolean;
  botFinished: boolean;
  humanRequested: boolean;
  teamId: string | null;
  agentId: string | null;
  channel: string | null;
}

// Also export from useChatList for components that might still use it
export { useChatList } from './useChatList';

const PAGE_SIZE = 20;

export const useChatListPaginated = (
  filter: ChatFilter = 'all',
  showOnlyGroups: boolean = false,
  advancedFilters?: AdvancedFilters,
  showTeamAssignedChats: boolean = false
) => {
  const [chats, setChats] = useState<ChatWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const [awaitingResponseChatIds, setAwaitingResponseChatIds] = useState<Set<string>>(new Set());
  const { currentOrganization } = useOrganization();

  // Refs para manter valores atuais acessíveis no callback de realtime
  const searchQueryRef = useRef(searchQuery);
  const filterRef = useRef(filter);
  const selectedTagsRef = useRef(selectedTags);
  const currentUserIdRef = useRef(currentUserId);
  const userTeamIdsRef = useRef(userTeamIds);
  const pageRef = useRef(page);
  const showOnlyGroupsRef = useRef(showOnlyGroups);
  const advancedFiltersRef = useRef(advancedFilters);
  const awaitingResponseChatIdsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef(false);
  const fetchIdRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const filterChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initCompletedRef = useRef(false);

  // Manter refs sincronizadas
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    selectedTagsRef.current = selectedTags;
  }, [selectedTags]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    userTeamIdsRef.current = userTeamIds;
  }, [userTeamIds]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    showOnlyGroupsRef.current = showOnlyGroups;
  }, [showOnlyGroups]);

  useEffect(() => {
    advancedFiltersRef.current = advancedFilters;
  }, [advancedFilters]);

  // Sync awaiting response ref
  useEffect(() => {
    awaitingResponseChatIdsRef.current = awaitingResponseChatIds;
  }, [awaitingResponseChatIds]);

  // Buscar IDs de chats aguardando resposta
  const fetchAwaitingResponseIds = useCallback(async () => {
    if (!currentOrganization?.id) return;

    const { data, error } = await supabase
      .rpc('get_chats_awaiting_response', { org_id: currentOrganization.id });

    if (!error && data) {
      const rows = (data as any[]) || [];
      const ids = new Set<string>(rows.map((item) => String(item.chat_id)));
      setAwaitingResponseChatIds(ids);
      awaitingResponseChatIdsRef.current = ids;
    }
  }, [currentOrganization?.id]);

  const fetchChatsPage = useCallback(async (
    pageNum: number,
    isRealtimeUpdate: boolean = false,
    isReset: boolean = false
  ) => {
    if (!currentOrganization?.id) return;

    // Generate unique fetch ID for concurrency control
    const currentFetchId = ++fetchIdRef.current;

    // Prevent concurrent fetches (except for realtime which should replace)
    if (isFetchingRef.current && !isRealtimeUpdate) return;
    isFetchingRef.current = true;

    // Usar refs para obter valores atuais durante realtime updates
    const currentSearchQuery = searchQueryRef.current;
    const currentFilter = filterRef.current;
    const currentSelectedTags = selectedTagsRef.current;
    const currentUserIdValue = currentUserIdRef.current;
    const currentUserTeamIds = userTeamIdsRef.current;
    const currentShowOnlyGroups = showOnlyGroupsRef.current;
    const currentAdvancedFilters = advancedFiltersRef.current;

    // Precompute tag/awaitingResponse/unread constraints at DB level to keep pagination consistent
    let constrainedChatIds: string[] | null = null;
    const awaitingIdsSet = currentAdvancedFilters?.awaitingResponse
      ? awaitingResponseChatIdsRef.current
      : null;

    // Show loading only when we have no data yet
    if (pageNum === 0 && chats.length === 0 && !isRealtimeUpdate) {
      setLoading(true);
    } else if (pageNum > 0) {
      setLoadingMore(true);
    }

    try {
      // If tags are selected, fetch matching chat ids from backend (ALL tags)
      if (currentSelectedTags.length > 0) {
        const { data: tagRows, error: tagErr } = await supabase
          .rpc('get_chat_ids_with_all_tags', {
            org_id: currentOrganization.id,
            tag_ids: currentSelectedTags,
          });

        if (tagErr) {
          console.error('Erro ao buscar chats por tags:', tagErr);
          return;
        }

        const ids = ((tagRows as any[]) || [])
          .map((r) => String(r.chat_id))
          .filter(Boolean);
        constrainedChatIds = ids;
      }

      // If awaitingResponse is active, intersect with awaiting ids (DB-level constraint)
      if (awaitingIdsSet) {
        const awaitingIdsArray = Array.from(awaitingIdsSet);
        constrainedChatIds = constrainedChatIds
          ? constrainedChatIds.filter((id) => awaitingIdsSet.has(id))
          : awaitingIdsArray;
      }

      // If onlyUnread is active, fetch unread chat IDs and intersect
      if (currentAdvancedFilters?.onlyUnread) {
        const { data: unreadData } = await supabase
          .rpc('get_unread_counts', { org_id: currentOrganization.id });

        if (unreadData) {
          const unreadIds = new Set<string>((unreadData as any[]).map((item) => String(item.chat_id)));
          if (constrainedChatIds) {
            constrainedChatIds = constrainedChatIds.filter((id) => unreadIds.has(id));
          } else {
            constrainedChatIds = Array.from(unreadIds);
          }
        }
      }

      // If constraints result in zero ids, return empty list quickly (avoids invalid .in([]))
      if (constrainedChatIds && constrainedChatIds.length === 0) {
        if (isRealtimeUpdate && pageNum === 0) {
          setChats([]);
        } else if (pageNum === 0 || isReset) {
          setChats([]);
        }
        setHasMore(false);
        return;
      }

      // Buscar chats com profile do agente atribuído e human_requested_at
      // NOTE: explicit any here to avoid TS deep instantiation issues with complex generated types.
      const sb: any = supabase as any;
      let query: any = sb
        .from('chats')
        .select(`
          *,
          assigned_profile:profiles!chats_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('hidden_from_chat', false)
        .order('last_message_at', { ascending: false });

      // Apply DB-level chat id constraint (tags / awaitingResponse)
      if (constrainedChatIds) {
        query = query.in('id', constrainedChatIds);
      }

      // Apply search filter at database level
      if (currentSearchQuery) {
        query = query.or(
          `phone.ilike.%${currentSearchQuery}%,wa_name.ilike.%${currentSearchQuery}%,custom_name.ilike.%${currentSearchQuery}%,group_name.ilike.%${currentSearchQuery}%,last_message.ilike.%${currentSearchQuery}%`
        );
      }

      // Resolved filter (new tab)
      if (currentFilter === 'resolved') {
        query = query.not('resolved_at', 'is', null);
      } else {
        // Default tabs should not include resolved chats
        query = query.is('resolved_at', null);

        // Apply assignment filter at database level
        // Skip tab filter when advanced agentId is set (avoids conflicting assigned_to conditions)
        const hasAdvancedAgent = !!currentAdvancedFilters?.agentId;
        // Skip tab team filter when advanced teamId is set (avoids conflicting team_id conditions)
        const hasAdvancedTeam = !!currentAdvancedFilters?.teamId;

        if (currentFilter === 'mine' && currentUserIdValue && !hasAdvancedAgent) {
          query = query.eq('assigned_to', currentUserIdValue);
        } else if (currentFilter === 'team' && currentUserTeamIds.length > 0 && !hasAdvancedTeam) {
          // "Equipe" - se showTeamAssignedChats está ativo, mostra todos os chats do time
          // Caso contrário, mostra apenas chats sem agente atribuído
          if (hasAdvancedAgent) {
            // If advanced agent filter is set, don't add team constraint
          } else if (showTeamAssignedChats) {
            query = query.in('team_id', currentUserTeamIds);
          } else {
            query = query.in('team_id', currentUserTeamIds).is('assigned_to', null);
          }
        }
      }

      // Apply groups filter
      if (currentShowOnlyGroups) {
        query = query.eq('is_group', true);
      }

      // Advanced filters: icon-based states
      if (currentAdvancedFilters?.robotService) {
        query = query.eq('agent_off', false);
      }

      if (currentAdvancedFilters?.channel) {
        query = query.eq('channel', currentAdvancedFilters.channel);
      }

      if (currentAdvancedFilters?.conversationAssignment) {
        query = query.not('transfer_requested_at', 'is', null);
      }

      if (currentAdvancedFilters?.botFinished) {
        query = query.not('bot_finished_at', 'is', null);
      }

      if (currentAdvancedFilters?.humanRequested) {
        query = query.not('human_requested_at', 'is', null);
      }

      // Apply advanced team filter
      if (currentAdvancedFilters?.teamId) {
        query = query.eq('team_id', currentAdvancedFilters.teamId);
      }

      // Apply advanced agent filter
      if (currentAdvancedFilters?.agentId) {
        query = query.eq('assigned_to', currentAdvancedFilters.agentId);
      }

      // Pagination
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data: chatsData, error: chatsError } = await query;

      if (chatsError) {
        console.error('Erro ao buscar chats:', chatsError);
        return;
      }

      // Fetch whatsapp connections for connection display name mapping (Multi-Channel)
      let connectionsMap: Record<string, string> = {};
      if (currentOrganization?.id) {
        const { data: connections } = await (supabase as any)
          .from('whatsapp_connections')
          .select('instance_name, display_name')
          .eq('organization_id', currentOrganization.id);
        if (connections && connections.length > 1) {
          for (const conn of connections) {
            if (conn.instance_name && conn.display_name) {
              connectionsMap[conn.instance_name] = conn.display_name;
            }
          }
        }
      }

      // Fetch tags for ALL chats in a single batch query (avoids N+1)
      const chatIds = (chatsData || []).map((c: any) => c.id);
      let allChatTags: any[] = [];
      if (chatIds.length > 0) {
        const { data: batchTags } = await supabase
          .from('chat_tags')
          .select('chat_id, tag_id, tags(id, name, color, icon)')
          .in('chat_id', chatIds)
          .eq('organization_id', currentOrganization.id);
        allChatTags = batchTags || [];
      }

      // Group tags by chat_id
      const tagsByChatId = new Map<string, any[]>();
      for (const ct of allChatTags) {
        if (!ct.tags) continue;
        const arr = tagsByChatId.get(ct.chat_id) || [];
        arr.push(ct.tags);
        tagsByChatId.set(ct.chat_id, arr);
      }

      const chatsWithTags = (chatsData || []).map((chat: any) => {
        const connection_display_name = chat.channel && connectionsMap[chat.channel]
          ? connectionsMap[chat.channel]
          : null;

        return {
          ...chat,
          agent_off: !!chat.agent_off,
          created_at: chat.created_at ?? new Date().toISOString(),
          updated_at: chat.updated_at ?? new Date().toISOString(),
          tags: tagsByChatId.get(chat.id) || [],
          unreadCount: 0,
          connection_display_name,
        };
      });

      // Remaining filters already applied at DB-level; keep client-side list as-is
      const filteredChats = chatsWithTags;

      // Concurrency check: only update state if this is still the most recent fetch
      if (fetchIdRef.current !== currentFetchId) {
        console.log('[useChatListPaginated] Fetch cancelado - nova requisição em andamento');
        isFetchingRef.current = false;
        return;
      }

      if (isRealtimeUpdate && pageNum === 0) {
        // Realtime: merge new page-0 data with existing chats from older pages
        // This preserves chats the user already scrolled to load
        setChats(prev => {
          const newIds = new Set(filteredChats.map((c: ChatWithTags) => c.id));
          // Keep existing chats not in the new page-0 result (from older pages)
          const olderChats = prev.filter(c => !newIds.has(c.id));
          const merged = [...filteredChats, ...olderChats];
          // Re-sort by last_message_at descending
          merged.sort((a, b) => {
            const dateA = a.last_message_at || a.updated_at || a.created_at;
            const dateB = b.last_message_at || b.updated_at || b.created_at;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          return merged;
        });
      } else if (pageNum === 0 || isReset) {
        // Substituir diretamente - não limpa antes
        setChats(filteredChats);
      } else {
        setChats(prev => [...prev, ...filteredChats]);
      }

      // hasMore deve ser baseado no tamanho da página retornada pelo banco,
      // não no tamanho filtrado client-side (evita "encurtar" a paginação)
      setHasMore((chatsData?.length || 0) === PAGE_SIZE);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [currentOrganization?.id]);

  const handleRealtimeUpdate = useCallback(async () => {
    // Se o filtro de aguardando resposta está ativo, atualizar os IDs primeiro
    if (advancedFiltersRef.current?.awaitingResponse) {
      await fetchAwaitingResponseIds();
    }
    // Para atualizações realtime, buscar com os filtros atuais usando refs
    fetchChatsPage(0, true);
  }, [fetchChatsPage, fetchAwaitingResponseIds]);

  // Debounced realtime update to prevent rapid consecutive calls
  const debouncedRealtimeUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      handleRealtimeUpdate();
    }, 500);
  }, [handleRealtimeUpdate]);

  const fetchUserInfo = async () => {
    try {
      // Use getSession (local-first) to avoid auth race/network calls on route changes
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setCurrentUserId(null);
        setUserTeamIds([]);
        currentUserIdRef.current = null;
        userTeamIdsRef.current = [];
        return;
      }

      currentUserIdRef.current = user.id;
      setCurrentUserId(user.id);

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      const teamIds = teamMembers?.map(tm => tm.team_id) || [];
      userTeamIdsRef.current = teamIds;
      setUserTeamIds(teamIds);
    } catch (error) {
      console.error('Erro ao buscar informações do usuário:', error);
    }
  };

  const resetAndFetch = useCallback(async () => {
    // Atualizar refs imediatamente para garantir sincronização
    searchQueryRef.current = searchQuery;
    filterRef.current = filter;
    selectedTagsRef.current = selectedTags;
    showOnlyGroupsRef.current = showOnlyGroups;
    advancedFiltersRef.current = advancedFilters;

    setPage(0);
    setHasMore(true);

    // Se o filtro de aguardando resposta está ativo, buscar os IDs primeiro
    if (advancedFiltersRef.current?.awaitingResponse) {
      await fetchAwaitingResponseIds();
    }
    // Buscar página 0 como reset
    await fetchChatsPage(0, false, true);
  }, [fetchChatsPage, fetchAwaitingResponseIds, searchQuery, filter, selectedTags, showOnlyGroups, advancedFilters]);

  // Initial setup - only runs once when org changes
  useEffect(() => {
    if (!currentOrganization?.id) {
      setChats([]);
      setLoading(false);
      initCompletedRef.current = false;
      return;
    }

    let mounted = true;
    initCompletedRef.current = false;

    const initialize = async () => {
      await fetchUserInfo();
      if (!mounted) return;

      await resetAndFetch();
      if (!mounted) return;

      initCompletedRef.current = true;
    };

    void initialize();
    const orgFilter = `organization_id=eq.${currentOrganization.id}`;

    const chatsChannel = supabase
      .channel('chats-changes-paginated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: orgFilter }, debouncedRealtimeUpdate)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && initCompletedRef.current) {
          debouncedRealtimeUpdate();
        }
      });

    const tagsChannel = supabase
      .channel('chat-tags-changes-paginated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_tags', filter: orgFilter }, debouncedRealtimeUpdate)
      .subscribe();

    const messagesChannel = supabase
      .channel('messages-changes-paginated')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: orgFilter }, debouncedRealtimeUpdate)
      .subscribe();

    const teamMembersChannel = supabase
      .channel('team-members-changes-paginated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: orgFilter }, () => {
        fetchUserInfo();
        debouncedRealtimeUpdate();
      })
      .subscribe();

    return () => {
      mounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (filterChangeTimeoutRef.current) {
        clearTimeout(filterChangeTimeoutRef.current);
      }
      supabase.removeChannel(chatsChannel);
      supabase.removeChannel(tagsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(teamMembersChannel);
    };
  }, [currentOrganization?.id, debouncedRealtimeUpdate, resetAndFetch]);

  // Separate effect for filter changes - with proper debouncing
  useEffect(() => {
    if (!currentOrganization?.id || !initCompletedRef.current) return;

    // Cancel any pending timeout
    if (filterChangeTimeoutRef.current) {
      clearTimeout(filterChangeTimeoutRef.current);
    }

    // Debounce filter changes to prevent rapid consecutive calls
    filterChangeTimeoutRef.current = setTimeout(() => {
      resetAndFetch();
    }, 300);

    return () => {
      if (filterChangeTimeoutRef.current) {
        clearTimeout(filterChangeTimeoutRef.current);
      }
    };
  }, [searchQuery, filter, currentUserId, userTeamIds, selectedTags, showOnlyGroups, advancedFilters, currentOrganization?.id, resetAndFetch]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchChatsPage(nextPage);
    }
  }, [page, loadingMore, hasMore, fetchChatsPage]);

  const refreshChats = useCallback(() => {
    fetchChatsPage(0, true);
  }, [fetchChatsPage]);

  const forceRefresh = useCallback(() => {
    resetAndFetch();
  }, [resetAndFetch]);

  return {
    chats,
    loading,
    loadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    selectedTags,
    setSelectedTags,
    currentUserId,
    userTeamIds,
    loadMore,
    refreshChats,
    forceRefresh,
  };
};