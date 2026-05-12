import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, MessagesByDay } from '@/types/message';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAudioNotifications } from './useAudioNotifications';
import { useOrganization } from '@/contexts/OrganizationContext';

const PAGE_SIZE = 30;

export const useMessagesPaginated = (chatId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesByDay, setMessagesByDay] = useState<MessagesByDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [oldestMessageDate, setOldestMessageDate] = useState<string | null>(null);
  const { playNotificationSound } = useAudioNotifications();
  const { currentOrganization } = useOrganization();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setMessagesByDay([]);
      setLoading(false);
      setHasMore(true);
      setOldestMessageDate(null);
      return;
    }

    isInitialLoad.current = true;
    fetchInitialMessages();

    // Realtime subscription for new messages
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
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMessage.id)) return prev;
              const updatedMessages = [...prev, newMessage];
              groupMessagesByDay(updatedMessages);
              return updatedMessages;
            });

            // Só notificar se:
            // 1. Mensagem não é nossa (is_from_user = false)
            // 2. Não é mensagem de sistema
            // 3. Mensagem não foi lida (read_at = null)
            if (!newMessage.is_from_user && newMessage.message_type !== 'system' && !newMessage.read_at) {
              playNotificationSound();
            }

            if (!newMessage.private) {
              fetchUpdatedChat(chatId);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => {
              const updatedMessages = prev.map((msg) =>
                msg.id === payload.new.id ? (payload.new as Message) : msg
              );
              groupMessagesByDay(updatedMessages);
              return updatedMessages;
            });
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => {
              const updatedMessages = prev.filter((msg) => msg.id !== payload.old.id);
              groupMessagesByDay(updatedMessages);
              return updatedMessages;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const fetchUpdatedChat = async (chatId: string) => {
    const { data: updatedChat } = await supabase
      .from('chats')
      .select('last_message, updated_at')
      .eq('id', chatId)
      .single();

    window.dispatchEvent(new CustomEvent('chat-message-received', {
      detail: {
        chatId,
        lastMessage: updatedChat?.last_message,
        updatedAt: updatedChat?.updated_at
      }
    }));
  };

  const fetchInitialMessages = async () => {
    if (!chatId) return;
    
    // Only show loading spinner on first load, not on refresh
    if (messages.length === 0) {
      setLoading(true);
    }
    
    // Don't clear messages immediately - keep showing old data while loading
    // setMessages([]); // REMOVED - preserve existing messages during refresh
    setHasMore(true);

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        // Keep existing messages on error instead of clearing
        setLoading(false);
        isInitialLoad.current = false;
        return;
      }

      // Reverse to show oldest first
      const sortedMessages = (data || []).reverse() as Message[];
      setMessages(sortedMessages);
      groupMessagesByDay(sortedMessages);
      
      if (sortedMessages.length > 0) {
        setOldestMessageDate(sortedMessages[0].created_at);
      } else {
        setOldestMessageDate(null);
      }
      
      setHasMore(sortedMessages.length === PAGE_SIZE);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      // Keep existing messages on error
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  };

  const loadMoreMessages = useCallback(async () => {
    if (!chatId || loadingMore || !hasMore || !oldestMessageDate) return;

    setLoadingMore(true);

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .lt('created_at', oldestMessageDate)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar mais mensagens:', error);
        return;
      }

      const olderMessages = (data || []).reverse() as Message[];
      
      if (olderMessages.length > 0) {
        setMessages(prev => {
          const newMessages = [...olderMessages, ...prev];
          groupMessagesByDay(newMessages);
          return newMessages;
        });
        setOldestMessageDate(olderMessages[0].created_at);
      }
      
      setHasMore(olderMessages.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, loadingMore, hasMore, oldestMessageDate, currentOrganization?.id]);

  const groupMessagesByDay = (msgs: Message[]) => {
    const grouped: { [key: string]: Message[] } = {};

    msgs.forEach((msg) => {
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

    const result: MessagesByDay[] = Object.entries(grouped).map(
      ([date, messages]) => ({
        date,
        messages,
      })
    );

    setMessagesByDay(result);
  };

  return { 
    messages, 
    messagesByDay, 
    loading, 
    loadingMore, 
    hasMore, 
    loadMoreMessages,
    isInitialLoad: isInitialLoad.current 
  };
};
