import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Chat } from '@/types/database-helpers';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface ChatWithTags extends Chat {
  tags?: Array<{ id: string; name: string; color: string; icon?: string }>;
  unreadCount?: number;
}

export type ChatFilter = 'all' | 'mine' | 'team' | 'unread' | 'resolved';

export const useChatList = (filter: ChatFilter = 'all') => {
  const [chats, setChats] = useState<ChatWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userTeamIds, setUserTeamIds] = useState<string[]>([]);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (!currentOrganization?.id) {
      setChats([]);
      setLoading(false);
      return;
    }

    fetchUserInfo();
    fetchChats(true); // Initial load with loading state

    // Realtime subscription para chats - atualiza sem loading
    const chatsChannel = supabase
      .channel('chats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
        },
        () => {
          fetchChats(false); // Update without loading state
        }
      )
      .subscribe();

    // Realtime subscription para chat_tags - atualiza sem loading
    const tagsChannel = supabase
      .channel('chat-tags-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_tags',
        },
        () => {
          fetchChats(false); // Update without loading state
        }
      )
      .subscribe();

    // Realtime subscription para messages - atualiza lista quando novas mensagens chegam
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchChats(false); // Update without loading state
        }
      )
      .subscribe();

    // Realtime subscription para team_members - atualiza quando usuário entra/sai de equipes
    const teamMembersChannel = supabase
      .channel('team-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
        },
        () => {
          fetchUserInfo();
          fetchChats(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatsChannel);
      supabase.removeChannel(tagsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(teamMembersChannel);
    };
  }, [currentOrganization?.id]);

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Buscar equipes do usuário
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      setUserTeamIds(teamMembers?.map(tm => tm.team_id) || []);
    } catch (error) {
      console.error('Erro ao buscar informações do usuário:', error);
    }
  };

  const fetchChats = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    
    // Filtrar por organization_id
    let query = supabase.from('chats').select('*');
    
    if (currentOrganization?.id) {
      query = query.eq('organization_id', currentOrganization.id);
    }
    
    const { data: chatsData, error: chatsError } = await query.order('last_message_at', { ascending: false });

    if (chatsError) {
      console.error('Erro ao buscar chats:', chatsError);
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    // Buscar tags para cada chat
    const chatsWithTags = await Promise.all(
      (chatsData || []).map(async (chat) => {
        const { data: chatTags } = await supabase
          .from('chat_tags')
          .select('tag_id, tags(id, name, color, icon)')
          .eq('chat_id', chat.id);

        const tags =
          chatTags?.map((ct: any) => ct.tags).filter(Boolean) || [];

        return {
          ...chat,
          tags,
          unreadCount: 0,
        };
      })
    );

    setChats(chatsWithTags);
    if (showLoading) {
      setLoading(false);
    }
  };

  const filteredChats = chats.filter((chat) => {
    // Aplicar filtro de busca
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      chat.phone.includes(query) ||
      chat.wa_name?.toLowerCase().includes(query) ||
      chat.last_message?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    // Aplicar filtro de atribuição
    switch (filter) {
      case 'resolved':
        return !!chat.resolved_at;
      case 'mine':
        return !chat.resolved_at && chat.assigned_to === currentUserId;
      case 'team':
        // "Equipe = só sem agente" + esconder resolvidas
        return !chat.resolved_at && !chat.assigned_to && !!chat.team_id && userTeamIds.includes(chat.team_id);
      case 'all':
      default:
        return !chat.resolved_at;
    }
  });

  return {
    chats: filteredChats,
    loading,
    searchQuery,
    setSearchQuery,
    currentUserId,
    userTeamIds,
    refreshChats: () => fetchChats(false), // Manual refresh without loading
    forceRefresh: () => fetchChats(true), // Force refresh with loading if needed
  };
};
