import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, MessagesByDay } from '@/types/message';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAudioNotifications } from './useAudioNotifications';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from './useUserRole';

const PAGE_SIZE = 30;

export const useMessagesPaginated = (chatId: string | null) => {
  const { playNotificationSound } = useAudioNotifications();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const isInitialLoad = useRef(true);
  const { isAdmin, isSubAdmin, isSuperAdmin, isHiden } = useUserRole();

  const queryKey = ['messages', chatId, currentOrganization?.id, isAdmin, isSubAdmin, isSuperAdmin, isHiden];

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!chatId) return { messages: [], nextCursor: null };

      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      if (!isAdmin && !isSubAdmin && !isSuperAdmin && !isHiden) {
        query = query.eq('is_hidden_from_agents', false);
      }

      const { data: fetchResult, error } = await query;
      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        throw error;
      }

      const fetchedMessages = (fetchResult || []) as Message[];
      let nextCursor = null;
      if (fetchedMessages.length === PAGE_SIZE) {
        nextCursor = fetchedMessages[fetchedMessages.length - 1].created_at;
      }
      return { messages: fetchedMessages, nextCursor };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    enabled: !!chatId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // Flat and reverse messages for UI (oldest at the top)
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    const allDescending = data.pages.flatMap(page => page.messages);
    return [...allDescending].reverse();
  }, [data?.pages]);

  const messagesByDay = useMemo(() => {
    const grouped: { [key: string]: Message[] } = {};

    messages.forEach((msg) => {
      const date = new Date(msg.created_at);
      let dateKey: string;

      if (isToday(date)) {
        dateKey = 'Hoje';
      } else if (isYesterday(date)) {
        dateKey = 'Ontem';
      } else {
        dateKey = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(msg);
    });

    return Object.entries(grouped).map(([date, msgs]) => ({
      date,
      messages: msgs,
    }));
  }, [messages]);

  const fetchUpdatedChat = async (cid: string) => {
    const { data: updatedChat } = await supabase
      .from('chats')
      .select('last_message, updated_at')
      .eq('id', cid)
      .single();

    window.dispatchEvent(new CustomEvent('chat-message-received', {
      detail: {
        chatId: cid,
        lastMessage: updatedChat?.last_message,
        updatedAt: updatedChat?.updated_at
      }
    }));
  };

  useEffect(() => {
    if (!chatId) {
      isInitialLoad.current = true;
      return;
    }

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            
            // Rejeitar se for oculto e o usuário for um agente comum
            if (!isAdmin && !isSubAdmin && !isSuperAdmin && !isHiden && newMessage.is_hidden_from_agents) {
              return;
            }

            // Reconciliação otimista do cache
            queryClient.setQueryData(queryKey, (oldData: any) => {
              if (!oldData || !oldData.pages || oldData.pages.length === 0) return oldData;
              
              // Verifica existência para evitar dupes
              const exists = oldData.pages.some((p: any) => 
                p.messages.some((m: Message) => m.id === newMessage.id)
              );
              if (exists) return oldData;

              const pages = [...oldData.pages];
              const firstPage = { ...pages[0] };
              // Unshift because page 0 is newest first
              firstPage.messages = [newMessage, ...firstPage.messages];
              pages[0] = firstPage;
              return { ...oldData, pages };
            });

            // Lógica de notificação
            if (!newMessage.is_from_user && newMessage.message_type !== 'system' && !newMessage.read_at) {
              playNotificationSound();
            }

            if (!newMessage.private) {
              fetchUpdatedChat(chatId);
            }
          } else if (payload.eventType === 'UPDATE') {
            queryClient.setQueryData(queryKey, (oldData: any) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  messages: page.messages.map((msg: Message) => 
                    msg.id === payload.new.id ? payload.new : msg
                  )
                }))
              };
            });
          } else if (payload.eventType === 'DELETE') {
            queryClient.setQueryData(queryKey, (oldData: any) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  messages: page.messages.filter((msg: Message) => msg.id !== payload.old.id)
                }))
              };
            });
          }
        }
      )
      .subscribe((status) => {
        // Self-Healing Strategy em Socket Reconnect
        if (status === 'SUBSCRIBED') {
          if (!isInitialLoad.current) {
            queryClient.invalidateQueries({ queryKey });
          }
          isInitialLoad.current = false;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, queryClient, currentOrganization?.id, playNotificationSound]);

  const loadMoreMessages = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return { 
    messages, 
    messagesByDay, 
    loading: isLoading, 
    loadingMore: isFetchingNextPage, 
    hasMore: hasNextPage, 
    loadMoreMessages,
    isInitialLoad: isInitialLoad.current
  };
};

