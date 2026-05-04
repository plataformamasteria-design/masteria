import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronDown, Copy, Download, ExternalLink, Eye, 
  FileText, Forward, Pencil, Reply, SmilePlus, 
  Trash2, User, Clock, Check, CheckCheck, AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

interface MessageBubbleProps {
  message: Message;
  previousMessage?: Message;
  onReply?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  onCopy?: (text: string) => void;
  messages: Message[]; // para checar quotes
}

export function MessageBubble({
  message,
  previousMessage,
  onReply,
  onForward,
  onReact,
  onCopy,
  messages,
}: MessageBubbleProps) {
  const isAgent = message.senderType === 'AGENT' || message.senderType === 'SYSTEM';
  const isFromAI = message.isAiGenerated;
  const time = format(new Date(message.sentAt), 'HH:mm');
  const fullDate = format(new Date(message.sentAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  const isSystem = message.senderType === 'SYSTEM';

  let displayContent = (message.content || '');
  let tokenCount = '';

  // Usa RegExp flexível para pegar tanto ___TOKENS quanto __TOKENS (caso a IA tenha alucinado a sintaxe no histórico)
  const tokenMatch = displayContent.match(/_+TOKENS:(\d+)/g);
  if (tokenMatch && tokenMatch.length > 0) {
    // Pega o último número inserido e limpa todos os do display
    const lastTokenStr = tokenMatch[tokenMatch.length - 1];
    tokenCount = lastTokenStr.split(':')[1];
    displayContent = displayContent.replace(/_+TOKENS:\d+/g, '').trim();
  }

  const canReply = !isSystem;
  const canCopy = !isSystem && displayContent;

  // Encontra a mensagem de reply se existir e se tiver sido passada a prop messages
  const quotedMessage = useMemo(() => {
    if (!message.repliedToMessageId || !messages) return null;
    return messages.find(m => m.providerMessageId === message.repliedToMessageId || m.id === message.repliedToMessageId);
  }, [message.repliedToMessageId, messages]);

  const handleScrollToQuoted = () => {
    if (!message.repliedToMessageId) return;
    const el = document.getElementById(`msg-${message.repliedToMessageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-primary', 'rounded-lg');
    setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'rounded-lg'), 2000);
  };

  const copyToClipboard = () => {
    if (displayContent && onCopy) onCopy(displayContent);
    else if (displayContent) navigator.clipboard.writeText(displayContent);
  };

  const renderStatus = () => {
    if (!isAgent || isSystem) return null;
    const normalizedStatus = message.status?.toUpperCase() || '';
    if (normalizedStatus === 'ERROR' || normalizedStatus === 'FAILED') {
      return (
         <AlertCircle className="h-[12px] w-[12px] text-destructive shrink-0" title={message.failureReason || "Falha no envio"} />
      );
    }
    if (message.readAt || normalizedStatus === 'READ') {
      return <CheckCheck className="h-[14px] w-[14px] text-blue-500 shrink-0" title="Lida" />;
    }
    if (normalizedStatus === 'DELIVERED') {
      return <CheckCheck className="h-[14px] w-[14px] text-muted-foreground shrink-0" title="Entregue" />;
    }
    if (normalizedStatus === 'SENT') {
      return <Check className="h-[14px] w-[14px] text-muted-foreground shrink-0" title="Enviada" />;
    }
    return <Clock className="h-[12px] w-[12px] text-muted-foreground shrink-0" title="Pendente" />;
  };

  if (isSystem) {
    return (
      <div className="flex justify-center mb-3 px-4">
        <div className="bg-muted px-4 py-2 rounded-[8px] text-xs font-medium text-muted-foreground border border-border/50 text-center flex flex-col items-center gap-1 shadow-sm">
          <span>{displayContent}</span>
          <span className="text-[10px] opacity-70 font-normal">{fullDate}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        'flex mb-1.5 px-4',
        isAgent ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'relative group max-w-[85%] md:max-w-[75%] lg:max-w-[65%] px-3 py-2 text-[14px] leading-relaxed break-words shadow-sm',
          isAgent
            ? 'agent-message-bubble bg-primary bubble-sent'
            : 'lead-message-bubble bg-white dark:bg-zinc-900 border border-border/50 bubble-received text-foreground'
        )}
      >
        {/* Menu de ações via Dropdown */}
        <div className={cn(
          'absolute top-0 z-10 hidden group-hover:flex items-center gap-0.5',
          isAgent ? '-left-8' : '-right-8'
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 w-7 rounded-full flex items-center justify-center bg-background/80 border border-border/40 backdrop-blur-sm shadow-sm text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Ações da mensagem"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isAgent ? 'start' : 'end'} className="w-48">
              {onReact && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <SmilePlus className="h-4 w-4 mr-2" />
                    Reagir
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent sideOffset={8}>
                      <div className="flex gap-1 p-1 items-center justify-center">
                        {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            className="h-8 w-8 hover:bg-muted rounded-md flex items-center justify-center text-lg transition-transform hover:scale-110"
                            onClick={(e) => { e.stopPropagation(); onReact(message, emoji); }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              )}
              {canReply && (
                <DropdownMenuItem onClick={() => onReply && onReply(message)}>
                  <Reply className="h-4 w-4 mr-2" />
                  Responder
                </DropdownMenuItem>
              )}
              {canCopy && (
                <DropdownMenuItem onClick={copyToClipboard}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Texto
                </DropdownMenuItem>
              )}
              {/* Ocultado Forward e outros pois não mapearemos agora na v2 para agilizar */}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quote Preview */}
        {quotedMessage && (
          <button
            type="button"
            onClick={handleScrollToQuoted}
            className={cn(
              'w-full text-left mb-1.5 px-2.5 py-1.5 rounded-md border flex flex-col',
              isAgent ? 'border-primary-foreground/20 bg-background/15' : 'border-border/60 bg-muted/50 hover:bg-muted/80'
            )}
          >
            <div className="text-[10px] opacity-80 flex items-center gap-1 font-semibold mb-0.5">
              <Reply className="h-3 w-3" />
              {quotedMessage.senderType === 'AGENT' ? 'Atendente' : 'Cliente'}
            </div>
            <div className={cn("text-xs line-clamp-2", isAgent ? "opacity-90" : "opacity-80")}>
              {quotedMessage.contentType === 'MEDIA' ? '📷 Mídia' : (quotedMessage.content?.replace(/_+TOKENS:\d+/g, '').trim() || '')}
            </div>
          </button>
        )}

        {/* Mídia: Imagem */}
        {(message.contentType === 'IMAGE' || message.contentType === 'MEDIA') && message.mediaUrl && (
          <div className="mb-2">
            <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="block relative group/img cursor-zoom-in">
              <img 
                src={message.mediaUrl} 
                alt={displayContent || 'Imagem recebida'} 
                className="max-w-full rounded-md object-contain max-h-[300px] border border-border/20"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors rounded-md flex items-center justify-center">
                <Eye className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </a>
          </div>
        )}

        {/* Mídia: Vídeo */}
        {message.contentType === 'VIDEO' && message.mediaUrl && (
          <div className="mb-2">
            <video
              src={message.mediaUrl}
              controls
              preload="metadata"
              className="max-w-full rounded-md max-h-[300px] border border-border/20"
              playsInline
            >
              Seu navegador não suporta vídeos.
            </video>
          </div>
        )}

        {/* Mídia: Sticker */}
        {message.contentType === 'STICKER' && message.mediaUrl && (
          <div className="mb-1">
            <img 
              src={message.mediaUrl} 
              alt="Sticker" 
              className="max-w-[150px] max-h-[150px] object-contain"
              loading="lazy"
            />
          </div>
        )}

        {/* Placeholder: Mídia sem URL (ainda processando upload S3) */}
        {(message.contentType === 'IMAGE' || message.contentType === 'VIDEO' || message.contentType === 'STICKER') && !message.mediaUrl && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/30 text-muted-foreground text-xs">
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 border-t-primary animate-spin" />
            <span>{message.contentType === 'VIDEO' ? '📹 Processando vídeo...' : message.contentType === 'STICKER' ? '🎨 Carregando sticker...' : '📷 Processando imagem...'}</span>
          </div>
        )}

        {/* Conteúdo Texto */}
        {message.contentType === 'TEMPLATE' && displayContent.startsWith('Template:') ? (
           <div className="space-y-1">
             <div className="text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1 border-b border-current/20 pb-1">
               Mensagem de Template
             </div>
             <p className="whitespace-pre-wrap">{displayContent.replace('Template: ', '')}</p>
           </div>
        ) : (
          <p className="whitespace-pre-wrap">{displayContent}</p>
        )}

        {/* Metadados Rodapé */}
        <div className="flex items-center justify-end gap-1 mt-1 shrink-0">
          {isFromAI && (
            <span className={cn(
              "text-[9px] font-semibold tracking-wider flex items-center shadow-sm px-1.5 py-0.5 rounded-[4px] border truncate gap-1",
              isAgent ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground" : "border-violet-500/30 bg-violet-500/10 text-violet-500"
            )}>
              <span>Gerado por IA</span>
              {tokenCount && <span className="opacity-80">({tokenCount} tokens)</span>}
            </span>
          )}
          <span className={cn(
            "text-[10px] select-none",
            isAgent ? "opacity-70" : "text-muted-foreground"
          )}>
            {time}
          </span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}
