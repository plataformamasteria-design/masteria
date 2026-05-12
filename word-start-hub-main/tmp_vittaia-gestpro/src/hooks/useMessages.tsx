import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, MessagesByDay } from '@/types/message';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAudioNotifications } from './useAudioNotifications';
import { useOrganization } from '@/contexts/OrganizationContext';

export const useMessages = (chatId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesByDay, setMessagesByDay] = useState<MessagesByDay[]>([]);
  const [loading, setLoading] = useState(true);
  const { playNotificationSound } = useAudioNotifications();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setMessagesByDay([]);
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      
      let query = supabase.from('messages').select('*').eq('chat_id', chatId);
      
      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        setLoading(false);
        return;
      }

      const typedMessages = (data || []) as Message[];
      setMessages(typedMessages);
      groupMessagesByDay(typedMessages);
      setLoading(false);
    };

    fetchMessages();

    // Realtime subscription
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
              const updatedMessages = [...prev, newMessage];
              groupMessagesByDay(updatedMessages);
              return updatedMessages;
            });
            
            // Tocar som apenas para mensagens do LEAD (is_from_user: false)
            // e ignorar mensagens de sistema
            if (!newMessage.is_from_user && newMessage.message_type !== 'system') {
              playNotificationSound();
            }
            
            // Buscar chat atualizado para pegar last_message e updated_at (apenas para mensagens públicas)
            if (!newMessage.private) {
              const fetchUpdatedChat = async () => {
                const { data: updatedChat } = await supabase
                  .from('chats')
                  .select('last_message, updated_at')
                  .eq('id', chatId)
                  .single();
                
                // Disparar evento com dados completos para reordenar lista de conversas
                window.dispatchEvent(new CustomEvent('chat-message-received', {
                  detail: { 
                    chatId,
                    lastMessage: updatedChat?.last_message,
                    updatedAt: updatedChat?.updated_at
                  }
                }));
              };
              
              fetchUpdatedChat();
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

  return { messages, messagesByDay, loading };
};
