import { useState, useEffect } from "react";
import { Clock, Edit2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";

interface ScheduledMessage {
  id: string;
  content: string;
  scheduled_for: string;
  created_at: string;
}

interface ScheduledMessagesPanelProps {
  chatId: string;
  onClose: () => void;
  refreshTrigger?: number;
}

export function ScheduledMessagesPanel({ chatId, onClose, refreshTrigger }: ScheduledMessagesPanelProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  useEffect(() => {
    fetchScheduledMessages();
  }, [chatId, currentOrganization?.id, refreshTrigger]);

  const fetchScheduledMessages = async () => {
    if (!chatId || !currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('id, content, scheduled_for, created_at')
        .eq('chat_id', chatId)
        .eq('organization_id', currentOrganization.id)
        .is('sent_at', null)
        .is('cancelled_at', null)
        .order('scheduled_for');

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching scheduled messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "A mensagem não será mais enviada",
      });

      fetchScheduledMessages();
    } catch (error) {
      console.error('Error cancelling message:', error);
      toast({
        title: "Erro",
        description: "Falha ao cancelar agendamento",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="border-b border-border bg-amber-50/50 dark:bg-amber-900/10 p-3">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          Carregando agendamentos...
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return null;
  }

  return (
    <>
      <div className="border-b border-border bg-amber-50/50 dark:bg-amber-900/10">
        <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200/50 dark:border-amber-800/30">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4" />
            Mensagens Agendadas ({messages.length})
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="max-h-[150px]">
          <div className="p-2 space-y-2">
            {messages.map((msg) => {
              const date = new Date(msg.scheduled_for);
              const isToday = date.toDateString() === new Date().toDateString();
              const formattedDate = isToday 
                ? `Hoje às ${format(date, 'HH:mm')}` 
                : format(date, "dd/MM 'às' HH:mm", { locale: ptBR });

              return (
                <div
                  key={msg.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-white dark:bg-card border border-amber-200/50 dark:border-amber-800/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {formattedDate}
                    </p>
                    <p className="text-sm text-foreground truncate mt-0.5">
                      {msg.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleEdit(msg)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleCancel(msg.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <ScheduleMessageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        chatId={chatId}
        message={editingMessage}
        onSaved={fetchScheduledMessages}
      />
    </>
  );
}
