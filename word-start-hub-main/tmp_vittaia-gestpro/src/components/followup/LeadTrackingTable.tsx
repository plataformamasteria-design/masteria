import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TrackingData {
  id: string;
  chat_id: string;
  current_step: number;
  next_trigger_at: string;
  responded: boolean;
  completed: boolean;
  last_sent_at: string | null;
  chats: {
    wa_name: string;
    phone: string;
    last_message: string;
  };
  follow_up_sequences: {
    name: string;
    follow_up_steps: { count: number }[];
  };
}

const LeadTrackingTable = () => {
  const { currentOrganization } = useOrganization();
  const [tracking, setTracking] = useState<TrackingData[]>([]);
  const [removingLead, setRemovingLead] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 50;

  const fetchTracking = useCallback(async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Get total count first
      const { count, error: countError } = await (supabase as any)
        .from('lead_follow_up_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id);

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Fetch paginated data with ordering at DB level
      const { data, error } = await (supabase as any)
        .from('lead_follow_up_tracking')
        .select(`
          *,
          chats(wa_name, phone, last_message),
          follow_up_sequences(
            name,
            follow_up_steps(count)
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('completed', { ascending: true })
        .order('responded', { ascending: true })
        .order('next_trigger_at', { ascending: true })
        .range(from, to);

      if (error) throw error;
      setTracking(data || []);
    } catch (error) {
      console.error('Error fetching tracking:', error);
    }
  }, [currentOrganization?.id, currentPage]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    
    fetchTracking();

    const channel = supabase
      .channel('lead_follow_up_tracking_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_follow_up_tracking'
        },
        () => fetchTracking()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, fetchTracking]);

  const getStatusBadge = (item: TrackingData) => {
    if (item.responded) {
      return <Badge className="bg-green-500">✓ Respondeu</Badge>;
    }
    
    if (item.completed && !item.responded) {
      return <Badge className="bg-gray-500">⊗ Finalizado</Badge>;
    }
    
    const now = new Date();
    const nextTrigger = new Date(item.next_trigger_at);
    
    if (item.last_sent_at && nextTrigger > now) {
      return <Badge className="bg-blue-500">✉ Enviado</Badge>;
    }
    
    if (nextTrigger <= now && !item.completed) {
      return <Badge className="bg-yellow-500">⏰ Pronto para Enviar</Badge>;
    }
    
    return <Badge variant="outline">⏳ Aguardando</Badge>;
  };

  const formatTimeRemaining = (nextTrigger: string) => {
    const now = new Date();
    const target = new Date(nextTrigger);
    const diff = target.getTime() - now.getTime();
    
    if (diff < 0) return 'Pronto para enviar';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const handleRemoveFromFollowUp = async (trackingId: string, chatId: string) => {
    try {
      const { data: trackingData } = await (supabase as any)
        .from('lead_follow_up_tracking')
        .select('sequence_id')
        .eq('id', trackingId)
        .single();

      if (!trackingData) {
        toast.error('Erro ao buscar dados do tracking');
        return;
      }

      const { data: steps } = await (supabase as any)
        .from('follow_up_steps')
        .select('tag_id')
        .eq('sequence_id', trackingData.sequence_id);

      if (steps) {
        const tagIds = steps.map((s: any) => s.tag_id);
        await (supabase as any)
          .from('chat_tags')
          .delete()
          .eq('chat_id', chatId)
          .in('tag_id', tagIds);
      }

      const { error } = await (supabase as any)
        .from('lead_follow_up_tracking')
        .update({ completed: true })
        .eq('id', trackingId);

      if (error) throw error;

      toast.success('Lead removido do follow-up');
      setRemovingLead(null);
      fetchTracking();
    } catch (error) {
      console.error('Error removing from follow-up:', error);
      toast.error('Erro ao remover lead do follow-up');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Follow Up</CardTitle>
        <CardDescription>
          Histórico completo de todos os leads em follow-up (ativos, respondidos e finalizados)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Nome</th>
                <th className="text-left p-2">Telefone</th>
                <th className="text-left p-2">Sequência</th>
                <th className="text-left p-2">Etapa</th>
                <th className="text-left p-2">Próximo Envio</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tracking.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/50">
                  <td className="p-2">{item.chats?.wa_name || 'Sem nome'}</td>
                  <td className="p-2">{item.chats?.phone}</td>
                  <td className="p-2">{item.follow_up_sequences?.name}</td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        Etapa {item.current_step}
                        {item.follow_up_sequences?.follow_up_steps?.[0]?.count 
                          ? `/${item.follow_up_sequences.follow_up_steps[0].count}` 
                          : ''}
                      </span>
                      {item.last_sent_at && (
                        <span className="text-xs text-muted-foreground">
                          Último envio: {new Date(item.last_sent_at).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="text-sm">
                      {new Date(item.next_trigger_at).toLocaleString('pt-BR')}
                      <p className="text-xs text-muted-foreground">
                        {formatTimeRemaining(item.next_trigger_at)}
                      </p>
                    </div>
                  </td>
                  <td className="p-2">{getStatusBadge(item)}</td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemovingLead(item.id)}
                      title="Remover do Follow Up"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tracking.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum lead encontrado
            </p>
          )}
        </div>

        {totalCount > ITEMS_PER_PAGE && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {tracking.length} de {totalCount} leads
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm flex items-center px-3">
                Página {currentPage} de {Math.ceil(totalCount / ITEMS_PER_PAGE)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!removingLead} onOpenChange={() => setRemovingLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do Follow Up</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este lead do follow-up? Todas as etiquetas de follow-up serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const item = tracking.find(t => t.id === removingLead);
                if (item) {
                  handleRemoveFromFollowUp(item.id, item.chat_id);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default LeadTrackingTable;