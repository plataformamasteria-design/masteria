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
  FileText,
  ImageIcon,
  Filter,
  Check,
  Link as LinkIcon,
  Unlink,
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
import { ManualTriggerModal } from '../automations/manual-trigger-modal';
import { MessageInput } from './chat/MessageInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ActiveChatProps {
  onFetchAllMessages?: () => void;
  conversation: Conversation | null;
  contact: Contact | null;
  messages: Message[];
  loadingMessages: boolean;
  templates: Template[];
  onSendMessage: (text: string, isInternalNote?: boolean, overrideConnectionId?: string) => Promise<void>;
  onSendMedia?: (file: File, caption?: string) => Promise<void>;
  onBack: () => void;
  onToggleAi: (conversationId: string, aiActive: boolean) => Promise<void>;
  onLoadMoreMessages?: () => Promise<void>;
  hasMoreMessages?: boolean;
  isLoadingMoreMessages?: boolean;
  showContactDetails?: boolean;
  onToggleContactDetails?: () => void;
  forceShowBack?: boolean;
  availableConnections?: Array<{ id: string; config_name: string; connectionType: string; phoneNumber?: string; phone?: string; status?: string; ownerId?: string | null }>;
  onSwitchConnection?: (connectionId: string) => Promise<any>;
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
  onSendMedia,
  onBack,
  onToggleAi,
  onLoadMoreMessages,
  hasMoreMessages = false,
  isLoadingMoreMessages = false,
  showContactDetails = false,
  onToggleContactDetails,
  forceShowBack = false,
  availableConnections = [],
  onSwitchConnection,
  onRefreshConversations,
  onFetchAllMessages,
  onSyncHistory,
}: ActiveChatProps) {
  const isMobile = useIsMobile();
  const { session } = useSession();
  const currentUserId = session?.userId ?? null;
  // Admins e SuperAdmins podem enviar em qualquer conversa
  const currentUserRole = session?.userData?.role ?? null;
  const isAdminOrSuperAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';
  const [messageText, setMessageText] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [replyToMessage, setReplyToMessage] = React.useState<Message | null>(null);
  const [showConnectionDropdown, setShowConnectionDropdown] = React.useState(false);
  const [showAllMessages, setShowAllMessages] = React.useState(false);
  const [isInternalNote, setIsInternalNote] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const connectionDropdownRef = React.useRef<HTMLDivElement>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previousScrollHeightRef = React.useRef<number>(0);
  const isInitialLoadRef = React.useRef(true);
  const lastMessageIdRef = React.useRef<string | null>(null);

  const [optimisticAssignment, setOptimisticAssignment] = React.useState<{ assignedTo: string | null; teamId: string | null } | null>(null);

  const [isManualTriggerOpen, setIsManualTriggerOpen] = React.useState(false);
  const [previewFile, setPreviewFile] = React.useState<File | null>(null);
  const [previewCaption, setPreviewCaption] = React.useState('');
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const activeConnectionIdsInChat = React.useMemo(() => {
    const ids = new Set<string>();
    messages.forEach((m: Message) => {
      if (m.connectionId) ids.add(m.connectionId);
    });
    return Array.from(ids);
  }, [messages]);

  const filterableConnections = React.useMemo(() => {
    return availableConnections.filter(c => activeConnectionIdsInChat.includes(c.id));
  }, [availableConnections, activeConnectionIdsInChat]);



  React.useEffect(() => {
    if (previewFile) {
      const url = URL.createObjectURL(previewFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [previewFile]);

  React.useEffect(() => {
    setOptimisticAssignment(null);
  }, [conversation?.id]);

  // ✅ v3: Assignment-based access control com bypass para admin/superadmin
  const activeAssignedTo = optimisticAssignment ? optimisticAssignment.assignedTo : conversation?.assignedTo;
  const activeTeamId = optimisticAssignment ? optimisticAssignment.teamId : conversation?.teamId;

  const isConversationAssigned = !!activeAssignedTo || !!activeTeamId;
  const isAssignedToMe = activeAssignedTo === currentUserId;
  const isTeamAssignedOnly = !activeAssignedTo && !!activeTeamId;

  const viewMode = (session?.userData?.permissions as any)?.viewMode || 'all';
  const isAssignedOnly = currentUserRole === 'atendente' && viewMode === 'assigned_only';
  const allowedConnectionIds = currentUserRole === 'atendente' ? ((session?.userData?.permissions as any)?.allowedConnectionIds || []) : null;
  const isConnectionAllowedOriginal = currentUserRole === 'atendente' && allowedConnectionIds?.length > 0
    ? (conversation?.connectionId && allowedConnectionIds.includes(conversation.connectionId))
    : true;

  // OVERRIDE DE CONEXÃO: Se for restrito e não for a conexão dele, forçamos a conexão dele!
  let activeConnectionId = conversation?.connectionId;
  let isConnectionForced = false;
  if (!isConnectionAllowedOriginal && allowedConnectionIds?.length > 0) {
    activeConnectionId = allowedConnectionIds[0]; // Trava na conexão atribuída
    isConnectionForced = true;
  }

  // O dropdown só deve mostrar as conexões permitidas
  const finalAvailableConnections = allowedConnectionIds?.length > 0 
    ? availableConnections.filter(c => allowedConnectionIds.includes(c.id))
    : availableConnections;

  const currentConnection = finalAvailableConnections.find(c => c.id === activeConnectionId) 
    || availableConnections.find(c => c.id === activeConnectionId);

  // Como forçamos a conexão permitida, o usuário sempre pode enviar (na SUA conexão)
  const isConnectionAllowed = true; 

  // Admins/SuperAdmins podem sempre enviar
  // Atendentes com visão total podem enviar se isConnectionAllowed
  // Atendentes restritos só podem enviar se atribuídos E isConnectionAllowed (no caso de novo chat, consideramos true)
  const canSendMessage = isAdminOrSuperAdmin || ((!isAssignedOnly || isAssignedToMe || isConnectionForced) && isConnectionAllowed);

  const lastWindowOpeningMessage = React.useMemo(() => {
    // A janela de 24 horas da Meta SÓ É ABERTA por mensagens do cliente.
    // Templates enviados pelo agente NÃO ABREM a janela para envio de mensagens livres.
    const relevantMessages = [...messages].filter(m => m.senderType === 'CONTACT');
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
      await onSendMessage(messageText, isInternalNote, isConnectionForced ? activeConnectionId : undefined);
      setMessageText('');
      setReplyToMessage(null);
      // Don't reset isInternalNote to allow multiple internal notes easily
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
    <div className="flex flex-col h-full min-h-0 bg-transparent">
      {/* Premium Chat Header */}
      <div className="flex items-center gap-3 p-3 lg:p-4 shrink-0 bg-transparent border-b border-white/5 z-10 relative">
        <div className="flex items-center gap-3 shrink-0">
          {(isMobile || forceShowBack) && onBack && (
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

        <div className="flex-1 flex flex-col min-w-[100px] px-2 sm:px-3 overflow-hidden">
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
                    className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] truncate max-w-[80px] bg-black/5 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lastTag.color || '#ccc' }} />
                    <span className="truncate">{lastTag.name}</span>
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

        <div className="flex items-center justify-end gap-1.5 shrink min-w-0 overflow-hidden">
          {/* Assignment Dropdown */}
          <ChatAssignmentDropdown
            conversation={conversation}
            onAssignUpdate={(newUserId) => {
               onRefreshConversations?.();
            }}
          />

          {/* Manual Trigger Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsManualTriggerOpen(true)}
            className="shrink-0 h-8 gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15 focus:ring-2 focus:ring-emerald-500/30 transition-all duration-200"
            title="Disparar Automação Manual"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden lg:inline text-[11px] font-semibold">Disparar</span>
          </Button>

          {/* Connection Toggle */}
          {finalAvailableConnections.length > 0 && onSwitchConnection && (
            <DropdownMenu open={showConnectionDropdown && finalAvailableConnections.length > 1} onOpenChange={setShowConnectionDropdown}>
              <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={finalAvailableConnections.length <= 1}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 mr-1 outline-none shrink min-w-0",
                      ['baileys', 'evolution'].includes(currentConnection?.connectionType || ('connectionType' in conversation ? conversation.connectionType as string : '') || '')
                        ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 focus:ring-2 focus:ring-blue-500/30'
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 focus:ring-2 focus:ring-emerald-500/30',
                      finalAvailableConnections.length <= 1 && 'cursor-default opacity-90 hover:bg-transparent'
                    )}
                  >
                    <Wifi className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden lg:inline max-w-[90px] truncate">
                      {currentConnection?.config_name || conversation.connectionName || (['baileys', 'evolution'].includes(('connectionType' in conversation ? conversation.connectionType as string : '') || '') ? 'Baileys' : 'API')}
                    </span>
                  {finalAvailableConnections.length > 1 && (
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform duration-300",
                      showConnectionDropdown && 'rotate-180'
                    )} />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/30 z-50 p-1">
                <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-white/[0.06] mb-1">
                  Trocar Conexão
                </DropdownMenuLabel>
                <div className="max-h-[350px] overflow-y-auto overflow-x-hidden">
                  {(() => {
                    if (finalAvailableConnections.length === 0) {
                      return (
                        <div className="px-3 py-6 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
                          <Wifi className="h-5 w-5 opacity-20" />
                          <span>Nenhuma conexão disponível.</span>
                        </div>
                      );
                    }

                    const sortedConnections = [...finalAvailableConnections].sort((a, b) => {
                      const isCurrentA = a.id === activeConnectionId;
                      const isCurrentB = b.id === activeConnectionId;
                      if (isCurrentA) return -1;
                      if (isCurrentB) return 1;

                      const isConnectedA = !a.status || ['open', 'connected', 'online', 'active', 'conectado', 'tudo ok', 'tudo_ok', 'ok', 'approved'].includes(a.status.toLowerCase());
                      const isConnectedB = !b.status || ['open', 'connected', 'online', 'active', 'conectado', 'tudo ok', 'tudo_ok', 'ok', 'approved'].includes(b.status.toLowerCase());

                      if (isConnectedA && !isConnectedB) return -1;
                      if (!isConnectedA && isConnectedB) return 1;

                      return a.config_name.localeCompare(b.config_name);
                    });

                    return sortedConnections.map((conn) => {
                      const isActive = conn.id === conversation?.connectionId;
                      const isBaileys = ['baileys', 'evolution'].includes(conn.connectionType);
                      const isConnected = !conn.status || ['open', 'connected', 'online', 'active', 'conectado', 'tudo ok', 'tudo_ok', 'ok', 'approved'].includes(conn.status.toLowerCase());

                      return (
                        <DropdownMenuItem
                          key={conn.id}
                          onClick={() => {
                            setShowAllMessages(false);
                            if (!isActive) {
                              if (onSwitchConnection) {
                                onSwitchConnection(conn.id);
                              }
                              setShowConnectionDropdown(false);
                            }
                          }}
                          className={cn(
                            "w-full flex items-start gap-3 px-3 py-2.5 text-left transition-all duration-200 cursor-pointer rounded-lg mb-1",
                            isActive
                              ? 'bg-primary/10 border border-primary/20'
                              : 'hover:bg-muted/50 border border-transparent'
                          )}
                        >
                          <div className="flex flex-col items-center gap-1.5 mt-1 shrink-0">
                            {isActive ? (
                              <div className="relative flex items-center justify-center w-4 h-4">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-20 animate-ping" />
                                <Check className="relative h-3 w-3 text-primary stroke-[3]" />
                              </div>
                            ) : (
                              <div className={cn(
                                "w-2 h-2 rounded-full mt-1 transition-colors",
                                isConnected ? 'bg-emerald-500/50' : 'bg-rose-500/50'
                              )} />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={cn(
                                "font-semibold truncate text-[13px]",
                                isActive ? "text-primary" : "text-foreground"
                              )}>
                                {conn.config_name}
                              </span>
                              <span className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold shrink-0 tracking-wider",
                                isBaileys
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-emerald-500/10 text-emerald-500'
                              )}>
                                {isBaileys ? 'WhatsApp' : 'Oficial API'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground/70">
                              <span className="truncate max-w-[120px]">{conn.phoneNumber || conn.phone || 'Sem número'}</span>
                              <span className="shrink-0">{isBaileys ? 'Sessão Web' : 'Templates pagos'}</span>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    });
                  })()}
                </div>
                {finalAvailableConnections.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem
                      onClick={() => {
                        setShowAllMessages(true);
                        setShowConnectionDropdown(false);
                        if (onFetchAllMessages) onFetchAllMessages();
                      }}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-3 py-2 text-center transition-all duration-200 cursor-pointer rounded-lg text-xs font-semibold",
                        showAllMessages
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'hover:bg-white/[0.04] text-muted-foreground hover:text-foreground border border-transparent'
                      )}
                    >
                      Mostrar mensagens de todas conexões
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}





          {/* AI Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200",
                  conversation.aiActive
                    ? "bg-violet-500/10 border-violet-500/20"
                    : "bg-white/[0.02] border-white/[0.06]"
                )}>
                  <Bot className={cn(
                    "h-4 w-4 transition-colors duration-200",
                    conversation.aiActive ? "text-violet-400" : "text-muted-foreground/50"
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
          {onSyncHistory && ['baileys', 'evolution'].includes(('connectionType' in conversation ? conversation.connectionType as string : '') || '') && (
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
              (showAllMessages ? messages : messages.filter((m: Message) => !m.connectionId || m.connectionId === conversation.connectionId)).map((msg, index, arr) => {
                const currentDate = new Date(msg.sentAt);
                const prevMsg = index > 0 ? arr[index - 1] : null;
                const prevDate = prevMsg ? new Date(prevMsg.sentAt) : null;
                
                const showDivider = !prevDate || !isSameDay(currentDate, prevDate);
                
                return (
                  <React.Fragment key={msg.id}>
                    {showDivider && (
                       <div className="w-full flex justify-center py-2 sticky top-2 z-20 col-span-full pointer-events-none">
                         <span className="bg-background/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] uppercase font-bold text-muted-foreground/70 border border-white/[0.04] shadow-sm">
                           {isToday(currentDate) ? 'Hoje' : 
                            isYesterday(currentDate) ? 'Ontem' : 
                            differenceInDays(new Date(), currentDate) < 7 ? format(currentDate, 'EEEE', { locale: ptBR }) :
                            format(currentDate, "dd 'de' MMM, yyyy", { locale: ptBR })}
                         </span>
                       </div>
                    )}
                    <MessageBubble 
                      message={msg} 
                      allMessages={messages} 
                      contactName={contact.name}
                      templates={templates}
                      connections={availableConnections}
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
      <div className="shrink-0 border-t border-white/5 bg-transparent p-3 pt-2 overflow-x-hidden relative">
        {!isArchived && currentUserRole === 'atendente' && !isConnectionAllowed && (
          <div className="w-full flex justify-center mb-1.5 pointer-events-none">
            <div className="text-[10px] text-rose-500 font-semibold flex items-center gap-1.5 bg-rose-500/10 py-1 px-3 rounded-full border border-rose-500/20">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Você não tem permissão para enviar mensagens por esta conexão.</span>
            </div>
          </div>
        )}
        {!isArchived && currentUserRole === 'atendente' && isConnectionAllowed && isAssignedOnly && !isAssignedToMe && (
          <div className="w-full flex justify-center mb-1.5 pointer-events-none">
            <div className="text-[10px] text-rose-500 font-semibold flex items-center gap-1.5 bg-rose-500/10 py-1 px-3 rounded-full border border-rose-500/20">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Você só pode enviar mensagens em conversas atribuídas a você.</span>
            </div>
          </div>
        )}
        {!isArchived && is24hRestricted && canSendMessage && (
          <div className="w-full flex justify-center mb-1.5 pointer-events-none">
            {canSendFreeform && timeLeft !== null && timeLeft > 0 ? (
              <div className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1.5 bg-emerald-500/10 py-1 px-3 rounded-full border border-emerald-500/20">
                <Clock className="h-3 w-3 shrink-0" />
                <span>Janela 24h aberta • Restam {formatTimeLeft(timeLeft)}</span>
              </div>
            ) : (
              <div className="text-[10px] text-amber-500 font-semibold flex items-center gap-1.5 bg-amber-500/10 py-1 px-3 rounded-full border border-amber-500/20">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>Janela fechada • Clique no clipe (📎) para enviar template</span>
              </div>
            )}
          </div>
        )}
        <MessageInput
           messageText={messageText}
           setMessageText={setMessageText}
           onSubmit={handleSendMessage}
           isSending={isSending}
           isInternalNote={isInternalNote}
           setIsInternalNote={setIsInternalNote}
           disabled={!canSendMessage || (!canSendFreeform && is24hRestricted && !isInternalNote) || isSending || isArchived}
           replyToMessage={replyToMessage}
           onClearReply={() => setReplyToMessage(null)}
           isConversationAssigned={isConversationAssigned}
           isAssignedToMe={isAdminOrSuperAdmin ? true : isAssignedToMe}
           isTeamAssignedOnly={isTeamAssignedOnly}
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
           placeholder={isArchived ? "Esta conversa está arquivada." : (!canSendFreeform && is24hRestricted && !isInternalNote ? "Janela 24h fechada." : "Digite sua mensagem...")}
           onSendMedia={onSendMedia}
           actionMenuSlot={
              <div className="flex items-center gap-1">
                {onSendMedia && (
                  <>
                    <input
                      type="file"
                      id={`media-upload-photo-${conversation.id}`}
                      className="hidden"
                      accept="image/*,video/*"
                      disabled={isArchived || (!canSendFreeform && is24hRestricted)}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPreviewFile(file);
                          setPreviewCaption('');
                        }
                        e.target.value = ''; // Reset
                      }}
                    />
                    <input
                      type="file"
                      id={`media-upload-doc-${conversation.id}`}
                      className="hidden"
                      accept="*"
                      disabled={isArchived || (!canSendFreeform && is24hRestricted)}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPreviewFile(file);
                          setPreviewCaption('');
                        }
                        e.target.value = ''; // Reset
                      }}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={isArchived || (!canSendFreeform && is24hRestricted)}
                        className={cn(
                          "shrink-0 h-10 w-10 rounded-full transition-all duration-200 flex items-center justify-center outline-none focus:outline-none",
                          isArchived || (!canSendFreeform && is24hRestricted)
                            ? "opacity-50 cursor-not-allowed"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted focus:bg-muted"
                        )}
                      >
                        <Paperclip className="h-5 w-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={12} className="w-56 bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/30 z-50 p-2 mb-2">
                        <DropdownMenuItem onClick={() => document.getElementById(`media-upload-doc-${conversation.id}`)?.click()} className="cursor-pointer gap-3 p-3 hover:bg-muted/80 focus:bg-muted/80 rounded-lg transition-colors">
                          <div className="bg-violet-500/10 text-violet-500 p-2.5 rounded-full shadow-sm border border-violet-500/20"><FileText className="h-5 w-5" /></div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">Documento</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => document.getElementById(`media-upload-photo-${conversation.id}`)?.click()} className="cursor-pointer gap-3 p-3 hover:bg-muted/80 focus:bg-muted/80 rounded-lg transition-colors mt-1">
                          <div className="bg-blue-500/10 text-blue-500 p-2.5 rounded-full shadow-sm border border-blue-500/20"><ImageIcon className="h-5 w-5" /></div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">Fotos e Vídeos</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                <SendTemplateDialog templates={templates} connectionId={conversation.connectionId!} contact={contact}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 focus:bg-muted"
                    disabled={isArchived}
                  >
                    <FileText className="h-5 w-5" />
                  </Button>
                </SendTemplateDialog>
              </div>
           }
        />
      </div>



      {/* Modal de Preview de Mídia */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Enviar Arquivo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {previewUrl && previewFile?.type.startsWith('image/') && (
              <div className="w-full flex justify-center bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden max-h-[300px]">
                <img src={previewUrl} alt="Preview" className="object-contain" />
              </div>
            )}
            {previewUrl && previewFile?.type.startsWith('video/') && (
              <div className="w-full flex justify-center bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden max-h-[300px]">
                <video src={previewUrl} controls className="object-contain w-full h-full" />
              </div>
            )}
            {previewFile && !previewFile.type.startsWith('image/') && !previewFile.type.startsWith('video/') && (
              <div className="w-full h-24 bg-black/5 dark:bg-white/5 rounded-lg flex flex-col items-center justify-center border border-border/50">
                <FileText className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <span className="text-sm font-medium truncate max-w-[80%]">{previewFile.name}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {(previewFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            )}
            <Input
              placeholder="Adicionar legenda (opcional)..."
              value={previewCaption}
              onChange={(e) => setPreviewCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && previewFile && onSendMedia) {
                  onSendMedia(previewFile, previewCaption);
                  setPreviewFile(null);
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewFile(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (previewFile && onSendMedia) {
                onSendMedia(previewFile, previewCaption);
                setPreviewFile(null);
              }
            }}>
              Enviar <Send className="w-4 h-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualTriggerModal
        isOpen={isManualTriggerOpen}
        onClose={() => setIsManualTriggerOpen(false)}
        contactId={contact.id}
        contactName={contact.name || 'Lead'}
      />
    </div>
  );
}
