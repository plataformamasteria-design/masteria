import React, { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bot, BotOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ChatBotToggleProps {
  chatId: string;
  phone: string;
  agentOff: boolean;
}

export const ChatBotToggle: React.FC<ChatBotToggleProps> = ({
  chatId,
  phone,
  agentOff: initialAgentOff,
}) => {
  const [agentOff, setAgentOff] = useState(initialAgentOff);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setAgentOff(initialAgentOff);
  }, [initialAgentOff]);

  // Realtime subscription para atualizações do status do bot
  useEffect(() => {
    const channel = supabase
      .channel(`chat-bot-status:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: `id=eq.${chatId}`,
        },
        (payload) => {
          if (payload.new && 'agent_off' in payload.new) {
            const newAgentOff = payload.new.agent_off as boolean;
            setAgentOff(newAgentOff);
            
            // Disparar evento customizado para atualizar outras partes da UI
            window.dispatchEvent(new CustomEvent('chat-bot-updated', {
              detail: { chatId, agentOff: newAgentOff }
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const handleToggle = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('chats')
        .update({ agent_off: !enabled })
        .eq('id', chatId);

      if (error) throw error;

      toast({
        title: enabled ? 'Bot ativado' : 'Bot desativado',
        description: `O bot foi ${enabled ? 'ativado' : 'desativado'} para este chat.`,
      });
    } catch (error) {
      console.error('Error toggling bot:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status do bot.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={`gap-1 transition-opacity ${isUpdating ? 'opacity-50' : 'opacity-100'}`}
      >
        {agentOff ? (
          <>
            <BotOff className="h-3 w-3" />
            Bot OFF
          </>
        ) : (
          <>
            <Bot className="h-3 w-3" />
            Bot ON
          </>
        )}
      </Badge>
      <Switch
        checked={!agentOff}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
      />
    </div>
  );
};
