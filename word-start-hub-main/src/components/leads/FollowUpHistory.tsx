import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Repeat, Check, X, Clock, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FollowUpTrack {
  id: string;
  sequence_id: string;
  current_step: number;
  completed: boolean;
  responded: boolean;
  responded_at_step: number | null;
  created_at: string;
  next_trigger_at: string;
  last_sent_at: string | null;
  sequence_name?: string;
}

interface FollowUpHistoryProps {
  chatId: string;
}

export const FollowUpHistory = ({ chatId }: FollowUpHistoryProps) => {
  const [history, setHistory] = useState<FollowUpTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [chatId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('lead_follow_up_tracking')
        .select(`
          *,
          follow_up_sequences(name)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const historyWithNames = (data || []).map((item: any) => ({
        ...item,
        sequence_name: item.follow_up_sequences?.name || 'Sequência removida'
      }));

      setHistory(historyWithNames);
    } catch (error) {
      console.error('Error fetching follow-up history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-muted rounded w-1/3"></div>
          <div className="h-12 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  const getStatusInfo = (track: FollowUpTrack) => {
    if (track.responded) {
      return {
        label: 'Respondeu',
        color: 'bg-green-500/10 text-green-600 border-green-500/30',
        icon: Check
      };
    }
    if (track.completed) {
      return {
        label: 'Perdido',
        color: 'bg-destructive/10 text-destructive border-destructive/30',
        icon: X
      };
    }
    return {
      label: 'Em andamento',
      color: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
      icon: Clock
    };
  };

  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 space-y-3">
      <h3 className="font-semibold flex items-center gap-2 text-purple-600">
        <Repeat className="h-5 w-5" />
        Histórico de Follow-ups ({history.length})
      </h3>
      <div className="space-y-2">
        {history.map((track) => {
          const status = getStatusInfo(track);
          const StatusIcon = status.icon;
          
          return (
            <div key={track.id} className="p-3 bg-background/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{track.sequence_name}</p>
                <Badge variant="outline" className={status.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  <span>Etapa: {track.current_step}</span>
                  {track.responded && track.responded_at_step && (
                    <span className="text-green-600">(respondeu na {track.responded_at_step})</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Iniciado: {format(new Date(track.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              </div>
              {!track.completed && !track.responded && (
                <p className="text-xs text-amber-600">
                  Próximo envio: {format(new Date(track.next_trigger_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
