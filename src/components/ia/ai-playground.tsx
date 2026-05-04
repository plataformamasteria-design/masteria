// src/components/ai/ai-playground.tsx
'use client';

import { useState, useRef, useEffect, FormEvent, useCallback, useMemo } from 'react';
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  User,
  Plus,
  Trash2,
  Edit,
  Check,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { processMessageContent } from '@/lib/markdown';
import { createToastNotifier } from '@/lib/toast-helper';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import type { AiChat, AiChatMessage } from '@/lib/types';
import { companyAgent } from '@/ai/agents/company-agent-flow';
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


interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
}

const EmptyState = ({ onPromptClick }: { onPromptClick: (prompt: string) => void }) => {
    const insights = [
        "Quantos contatos eu tenho no total?",
        "Analise minha última conversa com o João da Silva.",
        "Crie uma tag chamada 'Lead Frio' com a cor azul.",
        "Liste todas as campanhas que falharam.",
    ]
    return (
        <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8">
            <Sparkles className="h-12 w-12 mb-4 text-primary" />
            <h3 className="text-lg font-semibold">Agente de Dados da Empresa</h3>
            <p className="text-sm">Selecione uma conversa ou comece a interagir abaixo.</p>
            
             <div className="mt-8 w-full max-w-md">
                 <h4 className="font-semibold text-foreground mb-4 flex items-center justify-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-400"/> Experimente perguntar:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {insights.map(insight => (
                        <button key={insight} onClick={() => onPromptClick(insight)} className="p-3 border rounded-lg text-xs text-left hover:bg-accent transition-colors">
                            {insight}
                        </button>
                    ))}
                </div>
             </div>
        </div>
    );
};

const ChatSidebar = ({ chats, selectedChat, onSelectChat, onCreateChat, onDeleteChat, onRenameChat, loading }: {
    chats: AiChat[];
    selectedChat: AiChat | null;
    onSelectChat: (chat: AiChat) => void;
    onCreateChat: () => void;
    onDeleteChat: (chatId: string) => void;
    onRenameChat: (chatId: string, newTitle: string) => void;
    loading: boolean;
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [chatToDelete, setChatToDelete] = useState<AiChat | null>(null);

    const handleRename = (chat: AiChat) => {
        setEditingId(chat.id);
        setRenameValue(chat.title || 'Nova Conversa');
    };

    const handleSaveRename = () => {
        if (editingId && renameValue) {
            onRenameChat(editingId, renameValue);
        }
        setEditingId(null);
    };
    
    return (
        <div className="h-full flex flex-col bg-muted/50 border-r">
            <div className="p-2 border-b">
                 <Button variant="outline" className="w-full justify-start" onClick={onCreateChat}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Conversa
                </Button>
            </div>
            <ScrollArea className="flex-1">
                <nav className="p-2 space-y-1">
                   {loading ? (
                     <div className="space-y-2">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                    </div>
                   ) : (
                    chats.map(chat => (
                        <div key={chat.id} className={cn("group flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm cursor-pointer", selectedChat?.id === chat.id ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                           {editingId === chat.id ? (
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={handleSaveRename}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                                    className="bg-transparent text-sm w-full outline-none"
                                    autoFocus
                                />
                           ) : (
                                <button className="truncate flex-1 text-left" onClick={() => onSelectChat(chat)}>
                                    {chat.title}
                                </button>
                           )}
                           <div className={cn("items-center gap-1", editingId === chat.id ? "flex" : "hidden group-hover:flex")}>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editingId === chat.id ? handleSaveRename() : handleRename(chat)}>
                                    {editingId === chat.id ? <Check className="h-4 w-4"/> : <Edit className="h-4 w-4"/>}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setChatToDelete(chat)}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                           </div>
                        </div>
                    ))
                   )}
                </nav>
            </ScrollArea>
             <AlertDialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                        <AlertDialogDescription>Tem certeza que deseja excluir a conversa &quot;{chatToDelete?.title}&quot;? Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if(chatToDelete) onDeleteChat(chatToDelete.id); setChatToDelete(null); }}>Sim, Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export function AiPlayground() {
  const [chats, setChats] = useState<AiChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<AiChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const normalizeMessage = (msg: AiChatMessage): Message => ({
    id: msg.id,
    sender: msg.role as 'user' | 'ai',
    content: msg.content,
  });

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const response = await fetch('/api/v1/ai/chats');
      if (!response.ok) throw new Error('Falha ao carregar conversas.');
      const data = await response.json();
      setChats(data);
      if (data.length > 0 && !selectedChat) {
        handleSelectChat(data[0]);
      }
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setLoadingChats(false);
    }
  }, [notify, selectedChat]); // eslint-disable-line

  useEffect(() => {
      fetchChats();
  }, []); // eslint-disable-line

  const handleSelectChat = async (chat: AiChat) => {
    setSelectedChat(chat);
    setLoadingMessages(true);
    try {
        const response = await fetch(`/api/v1/ai/chats/${chat.id}/messages`);
        if (!response.ok) throw new Error('Falha ao carregar mensagens.');
        const payload = await response.json();
        
        const messageList: AiChatMessage[] = Array.isArray(payload) ? payload : (payload?.messages ?? []);
        
        setMessages(messageList.map(normalizeMessage));

    } catch (error) {
         notify.error('Erro', (error as Error).message);
    } finally {
        setLoadingMessages(false);
    }
  };
  
  const handleCreateChat = async () => {
    try {
        const response = await fetch('/api/v1/ai/chats', { method: 'POST' });
        if (!response.ok) throw new Error('Falha ao criar nova conversa.');
        const newChat = await response.json();
        setChats(prev => [newChat, ...prev]);
        handleSelectChat(newChat);
    } catch(error) {
        notify.error('Erro', (error as Error).message);
    }
  }

  const handleDeleteChat = async (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (selectedChat?.id === chatId) {
        setSelectedChat(null);
        setMessages([]);
    }
    try {
        const response = await fetch(`/api/v1/ai/chats/${chatId}`, { 
            method: 'DELETE',
            credentials: 'include',
        });
        if (response.status !== 204) throw new Error('Falha ao excluir a conversa.');
        notify.success('Conversa Excluída!');
    } catch(error) {
        notify.error('Erro', (error as Error).message);
        fetchChats(); // Re-fetch to restore state on error
    }
  }

   const handleRenameChat = async (chatId: string, newTitle: string) => {
    const originalChats = [...chats];
    setChats(prev => prev.map(c => c.id === chatId ? {...c, title: newTitle} : c));
     try {
        const response = await fetch(`/api/v1/ai/chats/${chatId}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        if (!response.ok) throw new Error('Falha ao renomear a conversa.');
    } catch(error) {
        notify.error('Erro', (error as Error).message);
        setChats(originalChats);
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !selectedChat) return;
    
    const userMessage: Message = { id: `user-${Date.now()}`, sender: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsSending(true);

    try {
        // O agente já salva a mensagem do utilizador no banco
        const result = await companyAgent({ chatId: selectedChat.id, query: currentInput });

        if (!result || typeof result.answer !== 'string') {
            throw new Error('A resposta da API é inválida.');
        }

        const aiMessage: Message = { id: `ai-${Date.now()}`, sender: 'ai', content: result.answer };
        setMessages(prev => [...prev, aiMessage]);
        
        // O agente já salva a resposta da IA no banco

    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorResponseMessage: Message = { id: `err-${Date.now()}`, sender: 'ai', content: errorMessage };
      setMessages(prev => [...prev.filter(m => m.id !== userMessage.id), errorResponseMessage]);
      setInput(currentInput);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handlePromptClick = (prompt: string) => {
    if (!selectedChat) {
        handleCreateChat().then(() => {
            setInput(prompt);
             setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        });
    } else {
        setInput(prompt);
         setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    }
  }

  return (
    <div className="grid grid-cols-[280px_1fr] h-full" style={{ height: 'calc(100vh - 7rem)' }}>
      <ChatSidebar 
        chats={chats} 
        selectedChat={selectedChat}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        loading={loadingChats}
      />
      <div className="border rounded-lg flex flex-col h-full min-h-0">
        {!selectedChat ? (
            <EmptyState onPromptClick={handlePromptClick} />
        ) : (
            <>
                <div className="p-3 border-b flex items-center gap-3">
                    <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground"><Bot/></AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{selectedChat.title}</p>
                        <p className="text-xs text-green-500">Online</p>
                    </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-6">
                        {loadingMessages ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : messages.length === 0 ? (
                           <EmptyState onPromptClick={handlePromptClick} />
                        ) : messages.map((message) => (
                        <div key={message.id} className={cn('flex gap-4 items-start max-w-[90%]', message.sender === 'user' ? 'ml-auto flex-row-reverse' : '')}>
                            <Avatar className={cn("h-8 w-8 shrink-0", message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card')}>
                                <AvatarFallback>
                                    {message.sender === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                                </AvatarFallback>
                            </Avatar>
                             <div
                              className={cn('prose prose-chat max-w-none rounded-lg px-4 py-3 text-sm shadow-sm', message.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none')}
                              dangerouslySetInnerHTML={{ __html: processMessageContent(message.content) }}
                            />
                        </div>
                        ))}
                        {isSending && (
                            <div className="flex gap-4 items-start">
                                <Avatar className="h-8 w-8 bg-card shrink-0">
                                    <AvatarFallback><Bot className="h-5 w-5"/></AvatarFallback>
                                </Avatar>
                                <div className="bg-muted rounded-lg px-4 py-3 text-sm">
                                    <Loader2 className="h-5 w-5 animate-spin"/>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                <form onSubmit={handleSubmit} className="border-t bg-background p-4 flex items-start gap-3">
                    <Textarea 
                        ref={textareaRef}
                        rows={1} value={input}
                        onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit(e); } }}
                        placeholder="Pergunte algo sobre seus dados..."
                        disabled={isSending} className="w-full resize-none max-h-40" />
                    <Button type="submit" size="icon" disabled={isSending || !input.trim()}><Send className="h-4 w-4" /></Button>
                </form>
            </>
        )}
      </div>
    </div>
  );
}
