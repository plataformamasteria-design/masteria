// src/components/atendimentos/active-chat.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from '@/contexts/session-context';
import { assignChatToUser } from '@/app/actions/chat-assignment';
import {
  Paperclip,
  Send,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Clock,
  Bot,
  PanelRightOpen,
  PanelRightClose,
  Wifi,
  Archive,
  Undo,
  RefreshCcw,
  ChevronDown,
  UserPlus,
} from 'lucide-react';
import { format, isToday, isYesterday, differenceInDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MessageBubble } from './message-bubble';
import type { Conversation, Message, Template, Contact } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { is24HourWindowOpen, formatTimeLeft, getMillisecondsLeft } from '@/lib/utils';
import { SendTemplateDialog } from './send-template-dialog';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
import { ChatAssignmentDropdown } from './chat-assignment';
import { MessageInput } from './chat/MessageInput';


interface ActiveChatProps {
  conversation: Conversation | null;
  contact: Contact | null;
  messages: Message[];
  loadingMessages: boolean;
  templates: Template[];
  onSendMessage: (text: string) => Promise<void>;
  onBack: () => void;
  onToggleAi: (conversationId: string, aiActive: boolean) => Promise<void>;
  onLoadMoreMessages?: () => Promise<void>;
  hasMoreMessages?: boolean;
  isLoadingMoreMessages?: boolean;
  showContactDetails?: boolean;
  onToggleContactDetails?: () => void;
  availableConnections?: Array<{ id: string; config_name: string; connectionType: string; phoneNumber?: string; phone?: string; status?: string }>;
  onSwitchConnection?: (connectionId: string) => Promise<void>;
  onRefreshConversations?: () => void;
  onSyncHistory?: () => Promise<void>;
}

export function ActiveChat({
  conversation,
  contact,
  messages,
  loadingMessages,
  templates,
  onSendMessage,
  onBack,
  onToggleAi,
  onLoadMoreMessages,
  hasMoreMessages = false,
  isLoadingMoreMessages = false,
  showContactDetails = false,
  onToggleContactDetails,
  availableConnections = [],
  onSwitchConnection,
  onRefreshConversations,
  onSyncHistory,
}: ActiveChatProps) {
  const isMobile = useIsMobile();
  const { session } = useSession();
  const currentUserId = session?.userId ?? null;
  const [messageText, setMessageText] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [replyToMessage, setReplyToMessage] = React.useState<Message | null>(null);
  const [showConnectionDropdown, setShowConnectionDropdown] = React.useState(false);
  const connectionDropdownRef = React.useRef<HTMLDivElement>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previousScrollHeightRef = React.useRef<number>(0);
  const isInitialLoadRef = React.useRef(true);
  const lastMessageIdRef = React.useRef<string | null>(null);

  // ✅ v2: Optimistic Assignment state for immediate UI feedback
  const [optimisticAssignment, setOptimisticAssignment] = React.useState<{ assignedTo: string | null, teamId: string | null } | null>(null);

  React.useEffect(() => {
    setOptimisticAssignment(null);
  }, [conversation?.id]);

  // ✅ v2: Assignment-based access control
  const activeAssignedTo = optimisticAssignment ? optimisticAssignment.assignedTo : conversation?.assignedTo;
  const activeTeamId = optimisticAssignment ? optimisticAssignment.teamId : conversation?.teamId;

  const isConversationAssigned = !!activeAssignedTo || !!activeTeamId;
  const isAssignedToMe = activeAssignedTo === currentUserId;
  const canSendMessage = isAssignedToMe;

  const lastWindowOpeningMessage = React.useMemo(() => {
    const relevantMessages = [...messages].filter(m =>
      m.senderType === 'CONTACT' ||
      (m.senderType === 'AGENT' && m.content && m.content.startsWith('Template:'))
    );
    return relevantMessages.sort((a, b) =>
      new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    )[0];
  }, [messages]);

  const is24hRestricted = conversation?.connectionType === 'meta_api';

  const [timeLeft, setTimeLeft] = React.useState<number | null>(
    (is24hRestricted && lastWindowOpeningMessage) ? getMillisecondsLeft(lastWindowOpeningMessage.sentAt) : null
  );

  const canSendFreeform = React.useMemo(() => {
    // Baileys não tem restrição de 24h — sempre pode enviar
    if (!is24hRestricted || !conversation) return true;
    // Meta API: Se não houve mensagem do lead, janela está fechada
    if (!lastWindowOpeningMessage) return false;
    // Se o timer em tempo real registrou zero, fecha imediatamente
    if (timeLeft !== null && timeLeft <= 0) return false;
    return is24HourWindowOpen(lastWindowOpeningMessage.sentAt);
  }, [is24hRestricted, conversation, lastWindowOpeningMessage, timeLeft]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (connectionDropdownRef.current && !connectionDropdownRef.current.contains(e.target as Node)) {
        setShowConnectionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    // Timer roda sempre que há uma mensagem de abertura em conexão meta_api,
    // independente de canSendFreeform, para que timeLeft transite para 0 corretamente
    if (is24hRestricted && lastWindowOpeningMessage) {
      const msLeft = getMillisecondsLeft(lastWindowOpeningMessage.sentAt);
      setTimeLeft(msLeft > 0 ? msLeft : 0);

      if (msLeft > 0) {
        interval = setInterval(() => {
          const updated = getMillisecondsLeft(lastWindowOpeningMessage.sentAt);
          setTimeLeft(updated > 0 ? updated : 0);
        }, 1000);
      }
    } else {
      setTimeLeft(null);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [is24hRestricted, lastWindowOpeningMessage]);

  React.useEffect(() => {
    if (scrollAreaRef.current && isInitialLoadRef.current && messages.length > 0 && !loadingMessages) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'auto' });
      lastMessageIdRef.current = messages[messages.length - 1].id;
      isInitialLoadRef.current = false;
    }
  }, [messages, loadingMessages]);

  React.useEffect(() => {
    if (scrollAreaRef.current && !isInitialLoadRef.current && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessageIdRef.current !== lastMessage.id) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        lastMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages]);

  React.useEffect(() => {
    if (scrollAreaRef.current && previousScrollHeightRef.current > 0 && !isLoadingMoreMessages) {
      const newScrollHeight = scrollAreaRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - previousScrollHeightRef.current;
      if (scrollDiff > 0) {
        scrollAreaRef.current.scrollTop = scrollDiff;
      }
      previousScrollHeightRef.current = 0;
    }
  }, [messages, isLoadingMoreMessages]);

  React.useEffect(() => {
    isInitialLoadRef.current = true;
  }, [conversation?.id]);

  const handleScroll = React.useCallback(() => {
    if (!scrollAreaRef.current || !onLoadMoreMessages || !hasMoreMessages || isLoadingMoreMessages) return;

    const scrollTop = scrollAreaRef.current.scrollTop;
    const threshold = 100;

    if (scrollTop < threshold) {
      previousScrollHeightRef.current = scrollAreaRef.current.scrollHeight;
      onLoadMoreMessages();
    }
  }, [onLoadMoreMessages, hasMoreMessages, isLoadingMoreMessages]);

  React.useEffect(() => {
    const container = scrollAreaRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleSendMessage = async (e: React.FormEvent | undefined) => {
    if (e?.preventDefault) e.preventDefault();
    if (!messageText.trim() || !conversation) return;

    setIsSending(true);
    try {
      await onSendMessage(messageText);
      setMessageText('');
      setReplyToMessage(null);
    } catch (error) {
      // Error is handled by the caller
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  if (!conversation || !contact) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <p className="text-muted-foreground/50">Selecione uma conversa para começar.</p>
      </div>
    );
  }

  const isArchived = conversation.status === 'ARCHIVED';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Premium Chat Header */}
      <div className="flex items-center gap-3 p-3 shrink-0 bg-card/80 backdrop-blur-md border-b border-white/[0.06] z-10">
        <div className="flex items-center gap-3 shrink-0">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 hover:bg-white/[0.04]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-white/[0.06]">
              <AvatarImage src={contact.avatarUrl || ''} alt={contact.name} data-ai-hint="avatar user" />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                {(contact.name || contact.phone || 'US').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {/* Online status dot */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-card" />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <p className="font-semibold text-[14px] truncate leading-tight tracking-tight">
            <Link href={`/contacts/${contact.id}`} target="_blank" className="hover:text-primary transition-colors duration-200">
              {contact.name}
            </Link>
          </p>
          <p className="text-[11px] text-muted-foreground/60 truncate font-medium" title={contact.phone}>{contact.phone}</p>
          {/* Metadata: Tags + Funnel */}
          <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
            {/* Tags badge */}
            {conversation.tags && conversation.tags.length > 0 && (() => {
              const lastTag = conversation.tags[conversation.tags.length - 1];
              const extraCount = conversation.tags.length - 1;
              return (
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] truncate max-w-[80px]"
                    style={{ color: lastTag.color, backgroundColor: `${lastTag.color}15` }}
                  >
                    {lastTag.name}
                  </span>
                  {extraCount > 0 && (
                    <span className="text-[9px] font-semibold text-muted-foreground/60 bg-muted px-1 py-0.5 rounded-[3px]">
                      +{extraCount}
                    </span>
                  )}
                </div>
              );
            })()}
            {/* Funnel badge */}
            {conversation.kanbanBoardName && conversation.kanbanStageName && (
              <span className={cn(
                "text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] truncate max-w-[150px] shrink-0",
                conversation.kanbanStageType === 'WIN' ? 'text-emerald-600 bg-emerald-500/10' :
                conversation.kanbanStageType === 'LOSS' ? 'text-rose-500 bg-rose-500/10' :
                'text-blue-500 bg-blue-500/10'
              )}>
                📊 {conversation.kanbanBoardName} → {conversation.kanbanStageName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Assignment Dropdown */}
          <ChatAssignmentDropdown
            conversation={conversation}
            onAssignUpdate={onRefreshConversations || (() => { })}
          />

          {/* Connection Toggle */}
          {availableConnections.length > 0 && onSwitchConnection && (
            <div className="relative" ref={connectionDropdownRef}>
              <button
                type="button"
                onClick={() => setShowConnectionDropdown(prev => !prev)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 mr-1",
                  ['baileys', 'evolution'].includes((conversation as any)?.connectionType || '')
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'
                )}
              >
                <Wifi className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {['baileys', 'evolution'].includes((conversation as any)?.connectionType || '') ? 'Baileys' : 'API'}
                </span>
                <ChevronDown className={cn(
                  "h-3 w-3 transition-transform duration-300",
                  showConnectionDropdown && 'rotate-180'
                )} />
              </button>

              {showConnectionDropdown && (
                <div className="absolute top-full right-0 mt-1.5 w-64 bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/30 z-50 py-1 animate-in fade-in-0 zoom-in-95">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-white/[0.06]">
                    Trocar Conexão
                  </div>
                  {availableConnections.map((conn) => {
                    const isActive = conn.id === conversation?.connectionId;
                    const isBaileys = ['baileys', 'evolution'].includes(conn.connectionType);
                    return (
                      <button
                        key={conn.id}
                        type="button"
                        onClick={async () => {
                          if (!isActive) {
                            await onSwitchConnection(conn.id);
                          }
                          setShowConnectionDropdown(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-all duration-200",
                          isActive
                            ? 'bg-primary/5 text-primary'
                            : 'hover:bg-white/[0.04]'
                        )}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0 transition-colors",
                          isActive ? 'bg-primary shadow-[0_0_6px_hsl(161_79%_39%_/_0.4)]' : 'bg-muted-foreground/20'
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate text-[13px]">{conn.config_name}</span>
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                              isBaileys
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-emerald-500/10 text-emerald-400'
                            )}>
                              {isBaileys ? 'Baileys' : 'API'}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground/50">
                            {conn.phoneNumber || conn.phone || 'Sem número'}
                            {isBaileys ? ' • Gratuito' : ' • Templates pagos'}
                          </span>
                        </div>
                        {isActive && (
                          <span className="text-[10px] text-primary font-bold">Ativo</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* AI Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200",
                  conversation.aiActive
                    ? "bg-primary/10 border-primary/20"
                    : "bg-white/[0.02] border-white/[0.06]"
                )}>
                  <Bot className={cn(
                    "h-4 w-4 transition-colors duration-200",
                    conversation.aiActive ? "text-primary" : "text-muted-foreground/50"
                  )} />
                  <Switch
                    id={`ai-switch-${conversation.id}`}
                    checked={conversation.aiActive}
                    onCheckedChange={(checked) => onToggleAi(conversation.id, checked)}
                    aria-label="Ativar/Desativar IA"
                    className="shrink-0"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-card/95 backdrop-blur-md border-white/[0.08]">
                <p>{conversation.aiActive ? 'IA Ativa' : 'IA Desativada'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Contact Details Toggle */}
          {onToggleContactDetails && !isMobile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onToggleContactDetails}
                    className={cn(
                      "shrink-0 h-9 w-9 rounded-lg transition-all duration-200",
                      showContactDetails
                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                        : "hover:bg-white/[0.04] text-muted-foreground"
                    )}
                  >
                    {showContactDetails ? (
                      <PanelRightClose className="h-[18px] w-[18px]" />
                    ) : (
                      <PanelRightOpen className="h-[18px] w-[18px]" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/95 backdrop-blur-md border-white/[0.08]">
                  <p>{showContactDetails ? 'Ocultar Detalhes' : 'Ver Detalhes do Contato'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Sync History Button - Only for Baileys */}
          {onSyncHistory && ['baileys', 'evolution'].includes((conversation as any)?.connectionType || '') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onSyncHistory}
                    className="shrink-0 h-9 w-9 rounded-lg hover:bg-white/[0.04] transition-all duration-200 text-blue-400 hover:text-blue-300"
                  >
                    <RefreshCcw className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/95 backdrop-blur-md border-white/[0.08]">
                  <p>Sincronizar Histórico (Dispositivo pareado)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}


        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 min-h-0 h-full w-full relative chat-pattern chat-pattern-light overflow-hidden">
        <ScrollArea className="h-full w-full relative z-[1]" viewportRef={scrollAreaRef} type="always">
          <div className="px-4 md:px-6 lg:px-10 py-4 space-y-2 max-w-full overflow-hidden">
            {hasMoreMessages && (
              <div className="flex justify-center py-2">
                {isLoadingMoreMessages ? (
                  <div className="flex items-center gap-2 text-muted-foreground/40">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs font-medium">Carregando mensagens anteriores...</span>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLoadMoreMessages}
                    className="text-xs text-muted-foreground/50 hover:text-foreground rounded-full px-4"
                  >
                    <Clock className="h-3 w-3 mr-2" />
                    Ver histórico de mensagens anteriores
                  </Button>
                )}
              </div>
            )}
            {loadingMessages ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
              </div>
            ) : (
              messages.map((msg, index) => {
                const currentDate = new Date(msg.sentAt);
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const prevDate = prevMsg ? new Date(prevMsg.sentAt) : null;
                
                const showDivider = !prevDate || !isSameDay(currentDate, prevDate);
                
                return (
                  <React.Fragment key={msg.id}>
                    {showDivider && (
                       <div className="w-full flex justify-center py-2 relative z-10 w-full col-span-full">
                         <span className="bg-background/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] uppercase font-bold text-muted-foreground/70 border border-white/[0.04]">
                           {isToday(currentDate) ? 'Hoje' : 
                            isYesterday(currentDate) ? 'Ontem' : 
                            differenceInDays(new Date(), currentDate) < 7 ? format(currentDate, 'EEEE', { locale: ptBR }) :
                            format(currentDate, "dd 'de' MMM, yyyy", { locale: ptBR })}
                         </span>
                       </div>
                    )}
                    <MessageBubble 
                      message={msg as any} 
                      allMessages={messages as any} 
                      contactName={contact.name}
                      onReply={(m) => setReplyToMessage(m as Message)}
                      onCopy={(text) => navigator.clipboard.writeText(text)}
                    />
                  </React.Fragment>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Premium Input Area */}
      <div className="shrink-0 border-t border-white/[0.06] bg-card/80 backdrop-blur-md p-3 overflow-x-hidden">
        {!isArchived && (
          <>
            {/* ✅ v2: Only show 24h window for Meta API — Baileys has no 24h restriction */}
            {is24hRestricted && (() => {
              // Cenário 1: Janela aberta com tempo restante
              if (canSendFreeform && timeLeft !== null && timeLeft > 0) {
                return (
                  <div className="mb-2.5 text-[11px] text-center text-muted-foreground/60 font-semibold flex items-center justify-center gap-1.5 bg-primary/5 py-1.5 rounded-full mx-auto w-fit px-4 border border-primary/10">
                    <Clock className="h-3 w-3 shrink-0 text-primary/60" />
                    <span>Janela de 24h aberta • Restam {formatTimeLeft(timeLeft)}</span>
                  </div>
                );
              }

              // Cenário 2 e 3: Janela expirada (timer zerou) OU lead sem histórico (nunca mandou mensagem)
              if (!canSendFreeform) {
                return (
                  <div className="mb-3 mx-2 flex flex-col sm:flex-row items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-500 gap-3">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="font-medium text-[12px] sm:text-[13px]">
                        {!lastWindowOpeningMessage 
                          ? 'Janela de 24h fechada — Nenhuma mensagem do lead.' 
                          : 'Janela de 24h expirada.'}
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-500/60 hidden sm:inline">Envie um template para iniciar conversa</span>
                    
                    <SendTemplateDialog templates={templates} connectionId={conversation.connectionId!} contact={contact}>
                       <Button type="button" size="sm" className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 h-8 rounded-lg text-xs font-semibold px-4 w-full sm:w-auto shadow-none">
                           Escolher Template
                       </Button>
                    </SendTemplateDialog>
                  </div>
                );
              }

              return null;
            })()}
          </>
        )}
        {/* ✅ v2: Assignment requirement replaces the input entirely */}
        {/* ✅ v2: Assignment requirement replaces the input entirely */}
        <MessageInput
           messageText={messageText}
           setMessageText={setMessageText}
           onSubmit={handleSendMessage}
           isSending={isSending}
           disabled={!canSendMessage || (!canSendFreeform && is24hRestricted) || isSending || isArchived}
           replyToMessage={replyToMessage}
           onClearReply={() => setReplyToMessage(null)}
           isConversationAssigned={isConversationAssigned}
           isAssignedToMe={isAssignedToMe}
           assignedUserName={conversation.assignedUserName || conversation.teamName || null}
           isAssigning={isAssigning}
           onAssignToMe={async () => {
             if (!currentUserId) return;
             setIsAssigning(true);
             try {
               const res = await assignChatToUser(conversation.id, currentUserId);
               if (res.success) {
                 setOptimisticAssignment({ assignedTo: currentUserId, teamId: null });
                 onRefreshConversations?.();
               } else {
                 console.error("Failed to assign:", res.error);
               }
             } finally {
               setIsAssigning(false);
             }
           }}
           placeholder={isArchived ? "Esta conversa está arquivada." : (!canSendFreeform && is24hRestricted ? "Janela 24h fechada." : "Digite sua mensagem...")}
           actionMenuSlot={
              <SendTemplateDialog templates={templates} connectionId={conversation.connectionId!} contact={contact}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 focus:bg-muted"
                  disabled={isArchived}
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </SendTemplateDialog>
           }
        />
      </div>
    </div>
  );
}
