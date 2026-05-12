import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface UnreadCount {
  [chatId: string]: number;
}

export const useUnreadMessages = () => {
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const { currentOrganization } = useOrganization();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchUnreadCounts = useCallback(async () => {
    if (!currentOrganization?.id) return;
    
    const now = Date.now();
    if (now - lastFetchRef.current < 300) return;
    lastFetchRef.current = now;
    
    const { data, error } = await supabase
      .rpc('get_unread_counts', { org_id: currentOrganization.id });

    if (error) {
      console.error('Erro ao buscar mensagens não lidas:', error);
      return;
    }

    const counts: UnreadCount = {};
    
    if (data) {
      data.forEach((item: { chat_id: string; unread_count: number }) => {
        counts[item.chat_id] = Number(item.unread_count);
      });
    }

    setUnreadCounts(counts);
    // Total = número de CHATS com mensagens não lidas
    setTotalUnread(Object.keys(counts).length);
  }, [currentOrganization?.id]);

  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchUnreadCounts();
    }, 500);
  }, [fetchUnreadCounts]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    
    fetchUnreadCounts();

    const orgFilter = `organization_id=eq.${currentOrganization.id}`;

    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: orgFilter,
        },
        () => {
          debouncedFetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: orgFilter,
        },
        () => {
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, fetchUnreadCounts, debouncedFetch]);

  // Marcar como lido de forma COMPARTILHADA (atualiza chats.last_read_at para todos os agentes)
  const markAsRead = async (chatId: string) => {
    if (!currentOrganization?.id) return;
    
    // 1. ATUALIZAÇÃO OTIMISTA IMEDIATA
    setUnreadCounts((prev) => {
      const newCounts = { ...prev };
      if (newCounts[chatId]) {
        delete newCounts[chatId];
      }
      return newCounts;
    });
    setTotalUnread((prev) => Math.max(0, prev - 1));
    
    const now = new Date().toISOString();
    
    // 2. Atualizar chats.last_read_at (COMPARTILHADO - um agente lê, some para todos)
    supabase
      .from('chats')
      .update({ last_read_at: now })
      .eq('id', chatId)
      .eq('organization_id', currentOrganization.id)
      .then(({ error }) => {
        if (error) {
          console.error('Erro ao marcar chat como lido:', error);
        }
      });
  };

  // Marcar mensagens como lidas quando o usuário responde
  const markAsReadOnReply = async (chatId: string) => {
    if (!currentOrganization?.id) return;
    
    // 1. ATUALIZAÇÃO OTIMISTA IMEDIATA
    setUnreadCounts((prev) => {
      const newCounts = { ...prev };
      if (newCounts[chatId]) {
        delete newCounts[chatId];
      }
      return newCounts;
    });
    setTotalUnread((prev) => Math.max(0, prev - 1));
    
    const now = new Date().toISOString();
    
    // 2. Atualizar last_read_at e limpar human_requested_at (COMPARTILHADO)
    supabase
      .from('chats')
      .update({ last_read_at: now, human_requested_at: null })
      .eq('id', chatId)
      .eq('organization_id', currentOrganization.id)
      .then(({ error }) => {
        if (error) {
          console.error('Erro ao marcar chat como lido ao responder:', error);
        }
      });
  };

  return {
    unreadCounts,
    totalUnread,
    markAsRead,
    markAsReadOnReply,
    refetch: fetchUnreadCounts,
  };
};
