'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Trash2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AgentTestChatProps {
  personaId: string;
  personaName: string;
}

export function AgentTestChat({ personaId, personaName }: AgentTestChatProps) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setLoading(true);

    const tempUserMessage: TestMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await fetch(`/api/v1/ia/personas/${personaId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar mensagem');
      }

      const data = await response.json();

      const assistantMessage: TestMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setTokensUsed(data.tokensUsed ?? 0);
    } catch (err: any) {
      setError(err.message || 'Erro ao comunicar com o agente');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setTokensUsed(0);
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Testar Agente: {personaName}
          </span>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Teste o comportamento do agente em tempo real. As mensagens não são salvas.
          {tokensUsed > 0 && (
            <span className="block mt-1 text-xs">
              Tokens utilizados: {tokensUsed.toLocaleString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <ScrollArea className="flex-1 px-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Bot className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma mensagem ainda</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Envie uma mensagem abaixo para começar a testar seu agente de IA.
                A conversa não será salva no sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex gap-3 items-start',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-lg px-4 py-2 max-w-[80%]',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <span className="text-xs opacity-70 mt-1 block">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-lg px-4 py-2 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {error && (
          <div className="px-6 py-3 bg-destructive/10 text-destructive text-sm border-t">
            <strong>Erro:</strong> {error}
          </div>
        )}

        <div className="p-6 border-t">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              disabled={loading}
              className="min-h-[60px] max-h-[120px] resize-none"
              rows={2}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || loading}
              size="lg"
              className="flex-shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Dica: Use Shift+Enter para adicionar uma nova linha
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
