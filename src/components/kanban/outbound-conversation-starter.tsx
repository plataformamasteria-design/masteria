'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { startOutboundConversationAction } from '@/app/actions/chat';
import { fetchAvailableConnections } from '@/app/actions/chat';

interface OutboundConversationStarterProps {
  contactId: string;
  kanbanCardId: string;
  onConversationStarted: () => void;
}

export function OutboundConversationStarter({ contactId, kanbanCardId, onConversationStarted }: OutboundConversationStarterProps) {
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingConnections, setFetchingConnections] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadConnections = async () => {
      setFetchingConnections(true);
      try {
        const data = await fetchAvailableConnections();
        setConnections(data);
        if (data.length > 0) {
          setSelectedConnection(data[0].id);
        }
      } catch (error) {
        console.error("Erro ao carregar conexões", error);
      } finally {
        setFetchingConnections(false);
      }
    };
    loadConnections();
  }, []);

  const handleStartConversation = async () => {
    if (!message.trim()) {
      toast({ title: 'Aviso', description: 'Digite uma mensagem para iniciar o atendimento.', variant: 'destructive' });
      return;
    }
    if (!selectedConnection) {
      toast({ title: 'Aviso', description: 'Selecione uma conexão para enviar a mensagem.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await startOutboundConversationAction(contactId, kanbanCardId, selectedConnection, message);
      if (result.success) {
        toast({ title: 'Sucesso', description: 'Conversa iniciada! O lead foi atribuído a você.' });
        onConversationStarted();
      } else {
        toast({ title: 'Erro', description: result.error || 'Erro ao iniciar conversa.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro inesperado.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 max-w-md mx-auto w-full">
      <MessageCircle className="h-12 w-12 text-primary/50 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">Iniciar Atendimento</h3>
      <p className="text-sm text-center mb-6">
        Este lead não possui conversas ativas. Envie a primeira mensagem para iniciar o atendimento e atribuir este lead a você.
      </p>

      <div className="w-full space-y-4">
        {fetchingConnections ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <div className="text-sm text-destructive text-center p-3 bg-destructive/10 rounded-md">
            Nenhuma conexão de WhatsApp ativa encontrada.
          </div>
        ) : (
          <>
            {connections.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Enviar por:</label>
                <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conexão" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]">
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.config_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Primeira Mensagem</label>
              <Textarea
                placeholder="Olá, vi que você se interessou..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleStartConversation} 
              disabled={loading || !selectedConnection || !message.trim()}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Iniciar Conversa
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
