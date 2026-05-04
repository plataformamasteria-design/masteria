'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, MessageSquare, Phone } from 'lucide-react';
import type { Connection } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function WhatsAppBaileysPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingConnections, setFetchingConnections] = useState(true);
  const { toast } = useToast();

  const fetchBaileysConnections = useCallback(async () => {
    try {
      setFetchingConnections(true);
      const response = await fetch('/api/v1/connections');
      
      if (!response.ok) {
        throw new Error('Falha ao carregar conexões');
      }

      const data = await response.json();
      const baileysConnections = data.filter(
        (conn: Connection) => conn.connectionType === 'baileys' && conn.isActive
      );
      
      setConnections(baileysConnections);

      if (baileysConnections.length === 1) {
        setSelectedConnectionId(baileysConnections[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar conexões WhatsApp Normal:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as conexões WhatsApp Normal',
      });
    } finally {
      setFetchingConnections(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBaileysConnections();
  }, [fetchBaileysConnections]);

  const handleSendMessage = async () => {
    if (!selectedConnectionId) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma conexão',
        description: 'Escolha uma conexão WhatsApp Normal ativa antes de enviar',
      });
      return;
    }

    if (!recipient.trim()) {
      toast({
        variant: 'destructive',
        title: 'Número do destinatário obrigatório',
        description: 'Digite o número do WhatsApp do destinatário',
      });
      return;
    }

    if (!message.trim()) {
      toast({
        variant: 'destructive',
        title: 'Mensagem obrigatória',
        description: 'Digite a mensagem que deseja enviar',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/whatsapp-baileys/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          to: recipient,
          message: message,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao enviar mensagem');
      }

      toast({
        title: 'Mensagem enviada!',
        description: `Mensagem enviada com sucesso para ${recipient}`,
      });

      setRecipient('');
      setMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedConnection = connections.find(c => c.id === selectedConnectionId);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mensagens WhatsApp Normal</h1>
        <p className="text-muted-foreground mt-2">
          Envie mensagens de texto simples via WhatsApp Normal (QR Code)
        </p>
      </div>

      {fetchingConnections ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : connections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma conexão WhatsApp Normal ativa</CardTitle>
            <CardDescription>
              Você precisa criar e conectar uma conexão WhatsApp Normal antes de enviar mensagens.
              Acesse &quot;Conexões&quot; no menu para criar uma nova conexão via QR Code.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Enviar Mensagem
              </CardTitle>
              <CardDescription>
                Envie mensagens de texto diretamente para contatos via WhatsApp Normal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connection">Conexão WhatsApp Normal</Label>
                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                  <SelectTrigger id="connection">
                    <SelectValue placeholder="Selecione uma conexão" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <div className="flex items-center gap-2">
                          <span>{conn.config_name}</span>
                          {conn.phone && (
                            <Badge variant="outline" className="text-xs">
                              <Phone className="h-3 w-3 mr-1" />
                              {conn.phone}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedConnection && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>Status:</span>
                    <Badge
                      variant={selectedConnection.status === 'Conectado' ? 'default' : 'secondary'}
                    >
                      {selectedConnection.status}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient">Número do Destinatário</Label>
                <Input
                  id="recipient"
                  type="tel"
                  placeholder="5511999999999"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.replace(/\D/g, ''))}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Digite apenas números (com código do país). Exemplo: 5511999999999
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  placeholder="Digite sua mensagem aqui..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length} caracteres
                </p>
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={loading || !selectedConnectionId || !recipient || !message}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Mensagem
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sobre Mensagens WhatsApp Normal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>✓ Suportado:</strong> Mensagens de texto simples
              </p>
              <p>
                <strong>✗ Não suportado:</strong> Templates estruturados, botões interativos, mídia com
                cabeçalhos
              </p>
              <p className="text-xs mt-4">
                Para templates estruturados e recursos avançados, use conexões Whatsapp Business na página
                &quot;Templates&quot;.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
