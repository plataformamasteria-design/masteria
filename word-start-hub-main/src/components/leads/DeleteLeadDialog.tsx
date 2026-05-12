import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface DeleteLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  chatName?: string;
  onDeleted: () => void;
}

export const DeleteLeadDialog: React.FC<DeleteLeadDialogProps> = ({
  open,
  onOpenChange,
  chatId,
  chatName,
  onDeleted,
}) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    
    try {
      // Cascade delete in order (respecting foreign keys)
      // 1. Delete messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);
      if (messagesError) throw messagesError;

      // 2. Delete chat_tags
      const { error: chatTagsError } = await supabase
        .from('chat_tags')
        .delete()
        .eq('chat_id', chatId);
      if (chatTagsError) throw chatTagsError;

      // 3. Delete chat_tags_history
      const { error: chatTagsHistoryError } = await supabase
        .from('chat_tags_history')
        .delete()
        .eq('chat_id', chatId);
      if (chatTagsHistoryError) throw chatTagsHistoryError;

      // 4. Delete chat_reads
      const { error: chatReadsError } = await supabase
        .from('chat_reads')
        .delete()
        .eq('chat_id', chatId);
      if (chatReadsError) throw chatReadsError;

      // 5. Delete chat_assignment_history
      const { error: assignmentHistoryError } = await supabase
        .from('chat_assignment_history')
        .delete()
        .eq('chat_id', chatId);
      if (assignmentHistoryError) throw assignmentHistoryError;

      // 6. Delete transactions
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .eq('chat_id', chatId);
      if (transactionsError) throw transactionsError;

      // 7. Delete calendar_events
      const { error: eventsError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('chat_id', chatId);
      if (eventsError) throw eventsError;

      // 8. Delete tasks
      const { error: tasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('chat_id', chatId);
      if (tasksError) throw tasksError;

      // 9. Delete lead_follow_up_tracking
      const { error: followUpError } = await supabase
        .from('lead_follow_up_tracking')
        .delete()
        .eq('chat_id', chatId);
      if (followUpError) throw followUpError;

      // 10. Delete clients (if exists)
      const { error: clientsError } = await supabase
        .from('clients')
        .delete()
        .eq('chat_id', chatId);
      if (clientsError) throw clientsError;

      // 11. Delete bookings
      const { error: bookingsError } = await supabase
        .from('bookings')
        .delete()
        .eq('chat_id', chatId);
      if (bookingsError) throw bookingsError;

      // 12. Delete slash_command_executions
      const { error: commandsError } = await supabase
        .from('slash_command_executions')
        .delete()
        .eq('chat_id', chatId);
      if (commandsError) throw commandsError;

      // 13. Finally delete the chat
      const { error: chatError } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);
      if (chatError) throw chatError;

      toast({
        title: 'Lead excluído',
        description: 'O lead e todo o histórico foram removidos com sucesso.',
      });

      onOpenChange(false);
      onDeleted();
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      toast({
        title: 'Erro ao excluir lead',
        description: error.message || 'Ocorreu um erro ao tentar excluir o lead.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Tem certeza que deseja excluir{' '}
              <span className="font-semibold">{chatName || 'este lead'}</span>?
            </p>
            <p className="text-destructive font-medium">
              ⚠️ Esta ação irá remover permanentemente:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-2">
              <li>Todas as mensagens da conversa</li>
              <li>Todas as etiquetas associadas</li>
              <li>Transações financeiras</li>
              <li>Eventos de calendário</li>
              <li>Tarefas vinculadas</li>
              <li>Histórico de atribuições</li>
            </ul>
            <p className="text-destructive font-semibold mt-2">
              Esta ação é irreversível!
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir Lead'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
