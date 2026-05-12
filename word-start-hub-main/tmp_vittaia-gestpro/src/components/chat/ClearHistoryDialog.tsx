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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ClearHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  chatName?: string;
  /**
   * Called after a successful clear.
   * If action === 'remove', the chat was also marked as resolved (removed from main list).
   */
  onCleared: (result?: { action: 'keep' | 'remove' }) => void;
  /** Show the "remove from list" option (marks chat as resolved). */
  showRemoveOption?: boolean;
}

export const ClearHistoryDialog: React.FC<ClearHistoryDialogProps> = ({
  open,
  onOpenChange,
  chatId,
  chatName,
  onCleared,
  showRemoveOption = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const isConfirmed = confirmText.toUpperCase() === 'CONFIRMAR';

  const clearMessages = async () => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('chat_id', chatId);

    if (error) throw error;

    // Always reset last_message metadata
    await supabase
      .from('chats')
      .update({
        last_message: null,
        last_message_at: null,
        // Reset automation timestamps so the next inbound message is evaluated correctly
        // for Welcome (first/after 24h) and Away (1x/h) rules.
        last_inbound_at: null,
        last_welcome_sent_at: null,
        last_away_sent_at: null,
      })
      .eq('id', chatId);
  };

  const handleClearKeep = async () => {
    if (!isConfirmed) return;
    setLoading(true);

    try {
      await clearMessages();

      toast({
        title: 'Histórico limpo',
        description: 'A conversa foi limpa e permanece na lista.',
      });

      setConfirmText('');
      onOpenChange(false);
      onCleared?.({ action: 'keep' });
    } catch (error: any) {
      console.error('Error clearing history (keep):', error);
      toast({
        title: 'Erro ao limpar histórico',
        description: error.message || 'Ocorreu um erro ao tentar limpar o histórico.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearRemove = async () => {
    if (!isConfirmed) return;
    setLoading(true);

    try {
      await clearMessages();

      const { data: auth } = await supabase.auth.getUser();
      const resolvedBy = auth?.user?.id ?? null;

      await (supabase as any)
        .from('chats')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          hidden_from_chat: true,
        })
        .eq('id', chatId);

      toast({
        title: 'Histórico limpo',
        description: 'A conversa foi limpa e removida do Chat (permanece no Lead).',
      });

      setConfirmText('');
      onOpenChange(false);
      onCleared?.({ action: 'remove' });
    } catch (error: any) {
      console.error('Error clearing history (remove):', error);
      toast({
        title: 'Erro ao limpar histórico',
        description: error.message || 'Ocorreu um erro ao tentar limpar o histórico.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Limpar Histórico
          </AlertDialogTitle>
          {/* AlertDialogDescription renderiza um <p>; usamos asChild para evitar <div> dentro de <p> */}
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Você está prestes a apagar <span className="font-semibold">TODAS</span> as mensagens
                de <span className="font-semibold">{chatName || 'esta conversa'}</span>.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive">
                <p className="font-semibold flex items-center gap-2">⚠️ ATENÇÃO</p>
                <p className="text-sm mt-1">
                  Esta ação é <span className="font-bold">permanente e irreversível</span>. Todas as
                  mensagens, arquivos e mídias serão perdidos para sempre.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <Label htmlFor="confirm">
                  Digite <span className="font-bold text-foreground">CONFIRMAR</span> para continuar:
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CONFIRMAR"
                  className="uppercase"
                  disabled={loading}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          {showRemoveOption ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <AlertDialogAction
                onClick={handleClearKeep}
                disabled={loading || !isConfirmed}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  'Limpar e manter'
                )}
              </AlertDialogAction>

              <AlertDialogAction
                onClick={handleClearRemove}
                disabled={loading || !isConfirmed}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  'Limpar e remover'
                )}
              </AlertDialogAction>
            </div>
          ) : (
            <AlertDialogAction
              onClick={handleClearKeep}
              disabled={loading || !isConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Limpando...
                </>
              ) : (
                'Limpar Histórico'
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
