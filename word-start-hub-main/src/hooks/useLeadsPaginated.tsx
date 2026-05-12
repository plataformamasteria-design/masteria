import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface Chat {
  id: string;
  phone: string;
  wa_name: string | null;
  wa_photo_url: string | null;
  last_message: string | null;
  last_message_at?: string;
  agent_off: boolean;
  updated_at: string;
  assigned_to: string | null;
  team_id: string | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  teams?: {
    name: string;
  } | null;
  chat_tags?: Array<{
    tag_id: string;
    tags: {
      id: string;
      name: string;
      color: string;
      order_position: number | null;
    };
  }>;
  calendar_events?: Array<{ id: string }>;
  tasks?: Array<{ id: string }>;
  transactions?: Array<{ id: string; amount: number }>;
}

const PAGE_SIZE = 20;

export const useLeadsPaginated = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { currentOrganization } = useOrganization();

  // Refs para manter valores estáveis durante realtime
  const pageRef = useRef(page);
  const searchRef = useRef(search);
  const selectedTagsRef = useRef(selectedTags);
  const isFetchingRef = useRef(false);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { selectedTagsRef.current = selectedTags; }, [selectedTags]);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setChats([]);
      setLoading(false);
      return;
    }

    resetAndFetch();

    // Realtime subscription
    const channel = supabase
      .channel('leads-changes-paginated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_tags' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, handleRealtimeUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id]);

  // Reset when search or tag filter changes
  useEffect(() => {
    if (currentOrganization?.id) {
      resetAndFetch();
    }
  }, [search, selectedTags]);

  const fetchChatsPage = useCallback(async (pageNum: number, isRealtimeUpdate: boolean = false) => {
    if (!currentOrganization?.id) return;
    
    // Evitar fetches concorrentes
    if (isFetchingRef.current && !isRealtimeUpdate) return;
    isFetchingRef.current = true;

    const currentSearch = searchRef.current;
    const currentSelectedTags = selectedTagsRef.current;

    // Apply tag constraints at DB level to avoid pagination issues
    let constrainedChatIds: string[] | null = null;

    if (pageNum === 0 && !isRealtimeUpdate) {
      setLoading(true);
    } else if (pageNum > 0) {
      setLoadingMore(true);
    }

    try {
      if (currentSelectedTags.length > 0) {
        const { data: tagRows, error: tagErr } = await supabase
          .rpc('get_chat_ids_with_all_tags', {
            org_id: currentOrganization.id,
            tag_ids: currentSelectedTags,
          });

        if (tagErr) {
          console.error('Error fetching leads by tags:', tagErr);
          return;
        }

        constrainedChatIds = ((tagRows as any[]) || [])
          .map((r) => String(r.chat_id))
          .filter(Boolean);

        // If no results, return quickly (avoids invalid .in([]))
        if (constrainedChatIds.length === 0) {
          if (isRealtimeUpdate && pageNum === 0) {
            setChats([]);
          } else if (pageNum === 0) {
            setChats([]);
          }
          setHasMore(false);
          return;
        }
      }

      let query = (supabase as any)
        .from('chats')
        .select(`
          *,
          profiles:assigned_to (
            full_name,
            avatar_url
          ),
          teams:team_id (
            name
          ),
          chat_tags(
            tag_id,
            tags(id, name, color, order_position)
          ),
          calendar_events(id),
          tasks(id),
          transactions(id, amount)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('last_message_at', { ascending: false });

      if (constrainedChatIds) {
        query = query.in('id', constrainedChatIds);
      }

      // Apply search filter
      if (currentSearch) {
        query = query.or(`phone.ilike.%${currentSearch}%,wa_name.ilike.%${currentSearch}%,custom_name.ilike.%${currentSearch}%,group_name.ilike.%${currentSearch}%`);
      }

      // Pagination
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching chats:', error);
        return;
      }

      const rawDataLength = data?.length || 0;
      const filteredData = data || [];

      if (isRealtimeUpdate && pageNum === 0) {
        // Realtime: apenas atualizar/inserir no topo, preservar páginas carregadas
        setChats(prev => {
          const newIds = new Set(filteredData.map((c: Chat) => c.id));
          // Manter itens antigos que não estão nos novos dados
          const kept = prev.filter(c => !newIds.has(c.id));
          // Combinar novos (topo) + antigos preservados, limitado pelo total de páginas carregadas
          const maxItems = PAGE_SIZE * (pageRef.current + 1);
          return [...filteredData, ...kept].slice(0, maxItems);
        });
      } else if (pageNum === 0) {
        setChats(filteredData);
      } else {
        setChats(prev => [...prev, ...filteredData]);
      }

      // hasMore baseado no tamanho RAW do banco (antes de filtrar client-side)
      setHasMore(rawDataLength === PAGE_SIZE);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [currentOrganization?.id]);

  const handleRealtimeUpdate = useCallback(() => {
    fetchChatsPage(0, true);
  }, [fetchChatsPage]);

  const resetAndFetch = useCallback(() => {
    setPage(0);
    pageRef.current = 0;
    setHasMore(true);
    fetchChatsPage(0, false);
  }, [fetchChatsPage]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchChatsPage(nextPage);
    }
  }, [page, loadingMore, hasMore]);

  const refreshChats = useCallback(() => {
    fetchChatsPage(0, true);
  }, []);

  const forceRefresh = useCallback(() => {
    resetAndFetch();
  }, [resetAndFetch]);

  return {
    chats,
    loading,
    loadingMore,
    hasMore,
    search,
    setSearch,
    selectedTags,
    setSelectedTags,
    loadMore,
    refreshChats,
    forceRefresh,
  };
};
