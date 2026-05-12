import React, { useMemo, useState } from 'react';
import { Message, ContactData, LocationData, PixData } from '@/types/message';
import { format } from 'date-fns';
import { ChevronDown, Copy, Download, ExternalLink, Eye, FileText, FolderOpen, Forward, MapPin, Pencil, Phone, Pin, PinOff, QrCode, Reply, SmilePlus, Trash2, User, ZoomIn } from 'lucide-react';
import { cn, formatMarkdownText } from '@/lib/utils';
import { GroupMessageBubble } from './GroupMessageBubble';
import { AudioPlayer } from './AudioPlayer';
import { ImageLightbox } from './ImageLightbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageStatus } from './MessageStatus';
import { ParticipantInfo } from '@/lib/mention-utils';
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
  isGroupChat?: boolean;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDeleteForEveryone?: (message: Message) => void;
  onDeleteForPlatform?: (message: Message) => void;
  onOpenGroupSenderLead?: (message: Message) => void;
  onSendToFolder?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onPinMessage?: (message: Message) => void;
  isMessagePinned?: (messageId: string) => boolean;
  onMentionClick?: (phone: string) => void;
  participantsMap?: Map<string, ParticipantInfo>;
  onReact?: (message: Message, emoji: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isGroupChat = false,
  onReply,
  onEdit,
  onDeleteForEveryone,
  onDeleteForPlatform,
  onOpenGroupSenderLead,
  onSendToFolder,
  onForward,
  onPinMessage,
  isMessagePinned,
  onMentionClick,
  participantsMap,
  onReact,
}) => {
  const { toast } = useToast();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // is_from_user=true significa mensagem enviada pelo atendente/plataforma (DIREITA)
  // is_from_user=false significa mensagem recebida do lead (ESQUERDA)
  const isFromAgent = message.is_from_user;
  const time = format(new Date(message.created_at), 'HH:mm');

  const isDeletedForUI = !!(message.deleted_at || message.platform_deleted_at);
  const isFromAI = message.sender_name === 'I.A ✨';
  const isFromDevice = isFromAgent && message.sent_from_platform === false && !isFromAI;

  const withinMinutes = useMemo(() => {
    const created = new Date(message.created_at).getTime();
    const diffMs = Date.now() - created;
    return diffMs / 60000;
  }, [message.created_at]);

  const canReply = !message.private && message.message_type !== 'system';
  const canEdit =
    !!onEdit &&
    !isDeletedForUI &&
    !message.private &&
    message.is_from_user &&
    message.message_type === 'text' &&
    withinMinutes <= 15;
  const canDeleteForEveryone =
    !!onDeleteForEveryone &&
    !isDeletedForUI &&
    !message.private &&
    message.is_from_user &&
    withinMinutes <= 2880; // 48 horas
  const canDeleteForPlatform = !!onDeleteForPlatform && !isDeletedForUI && !message.private;
  const canSendToFolder = !!onSendToFolder && !isDeletedForUI && !!message.file_url && ['image', 'audio', 'video', 'pdf', 'document'].includes(message.message_type);
  const canForward = !!onForward && !isDeletedForUI && !message.private && message.message_type !== 'system';
  const canPin = !!onPinMessage && !isDeletedForUI && !message.private && message.message_type !== 'system';
  const messageIsPinned = isMessagePinned ? isMessagePinned(message.id) : false;

  const quoteLabel = useMemo(() => {
    if (!message.quoted_message_id && !message.quoted_external_message_id) return null;
    const preview = (message.quoted_preview as any) || null;
    if (typeof preview?.text === 'string' && preview.text.trim()) return preview.text;
    if (typeof preview?.label === 'string' && preview.label.trim()) return preview.label;
    return 'Mensagem citada';
  }, [message.quoted_message_id, message.quoted_external_message_id, message.quoted_preview]);

  // IMPORTANTE: não fazer return antecipado antes de todos os hooks.
  // Se alternar entre chat de grupo e chat normal, isso causava "Rendered fewer hooks than expected".
  if (isGroupChat) {
    return (
      <GroupMessageBubble
        message={message}
        onReply={onReply}
        onEdit={onEdit}
        onDeleteForEveryone={onDeleteForEveryone}
        onDeleteForPlatform={onDeleteForPlatform}
        onOpenSenderLead={onOpenGroupSenderLead}
        onForward={onForward}
        onPinMessage={onPinMessage}
        isMessagePinned={isMessagePinned}
        onMentionClick={onMentionClick}
        participantsMap={participantsMap}
      />
    );
  }

  const handleScrollToQuoted = () => {
    if (!message.quoted_message_id) return;
    const el = document.getElementById(`msg-${message.quoted_message_id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      window.open(url, '_blank');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência`,
    });
  };

  const parseContactData = (): ContactData | null => {
    try {
      if (message.content) {
        const raw = JSON.parse(message.content);
        // Handle both camelCase (from evolution webhook) and snake_case (from platform)
        const displayName = raw.display_name || raw.displayName || '';
        let phone = raw.phone || '';

        // Extract phone from vCard if not explicitly provided
        if (!phone && raw.vcard) {
          const telMatch = String(raw.vcard).match(/TEL[^:]*:([+\d\s()-]+)/i);
          if (telMatch) {
            phone = telMatch[1].replace(/[\s()-]/g, '').trim();
          }
        }

        if (!displayName && !phone) return null;
        return { display_name: displayName, phone, vcard: raw.vcard };
      }
    } catch {
      return null;
    }
    return null;
  };

  const parseLocationData = (): LocationData | null => {
    try {
      if (message.content) {
        return JSON.parse(message.content);
      }
    } catch {
      return null;
    }
    return null;
  };

  const parsePixData = (): PixData | null => {
    try {
      if (message.content) {
        return JSON.parse(message.content);
      }
    } catch {
      return null;
    }
    return null;
  };

  const renderContent = () => {
    // Mensagem apagada
    if (isDeletedForUI) {
      return (
        <p className="text-sm italic text-muted-foreground">
          🚫 Esta mensagem foi apagada
        </p>
      );
    }

    switch (message.message_type) {
      case 'text':
        return (
          <div className="space-y-0.5">
            <p className="text-sm whitespace-pre-wrap break-words">
              {formatMarkdownText(message.content || '')}
            </p>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-2">
            {/* Thumbnail clicável */}
            <div
              className="relative w-48 h-48 cursor-pointer group rounded-lg overflow-hidden"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={message.file_url || ''}
                alt={message.file_name || 'Imagem'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Overlay com ícone de zoom */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <ZoomIn className="h-8 w-8 text-white" />
              </div>
            </div>
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {formatMarkdownText(message.content)}
              </p>
            )}
            {/* Lightbox */}
            <ImageLightbox
              src={message.file_url || ''}
              alt={message.file_name || 'Imagem'}
              isOpen={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
            />
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <AudioPlayer src={message.file_url || ''} isFromUser={isFromAgent} />
              <a
                href={message.file_url || ''}
                download={message.file_name || 'audio'}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                  isFromAgent
                    ? "text-white/70 hover:text-white hover:bg-white/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="Baixar áudio"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {formatMarkdownText(message.content)}
              </p>
            )}
          </div>
        );

      case 'pdf':
      case 'document':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
              <FileText className="h-10 w-10 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">
                  {message.file_name || 'Documento.pdf'}
                </p>
                {message.file_size && (
                  <p className="text-xs text-muted-foreground">
                    {(message.file_size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => window.open(message.file_url || '', '_blank')}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Abrir em nova aba"
                >
                  <Eye className="h-4 w-4 text-foreground" />
                </button>
                <button
                  onClick={() => handleDownload(message.file_url || '', message.file_name || 'documento.pdf')}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Baixar arquivo"
                >
                  <Download className="h-4 w-4 text-foreground" />
                </button>
              </div>
            </div>
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {formatMarkdownText(message.content)}
              </p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <video controls className="w-full max-w-md rounded-lg">
              <source src={message.file_url || ''} />
              Seu navegador não suporta vídeo.
            </video>
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {formatMarkdownText(message.content)}
              </p>
            )}
          </div>
        );

      case 'contact': {
        const contactData = parseContactData();
        if (!contactData) {
          return <p className="text-sm text-muted-foreground">Cartão de contato</p>;
        }
        return (
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border min-w-[200px]">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{contactData.display_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {contactData.phone}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => copyToClipboard(contactData.phone, 'Telefone')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        );
      }

      case 'location': {
        const locationData = parseLocationData();
        if (!locationData) {
          return <p className="text-sm text-muted-foreground">Localização</p>;
        }
        const mapsUrl = `https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`;
        return (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-muted/30 rounded-lg border border-border hover:border-primary transition-colors min-w-[200px]"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Localização</p>
                <p className="text-xs text-muted-foreground">
                  {locationData.latitude.toFixed(4)}, {locationData.longitude.toFixed(4)}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </a>
        );
      }

      case 'pix': {
        const pixData = parsePixData();
        if (!pixData) {
          return <p className="text-sm text-muted-foreground">Pagamento PIX</p>;
        }
        return (
          <div className="p-3 bg-gradient-to-r from-teal-500/10 to-green-500/10 rounded-lg border border-teal-500/30 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <QrCode className="h-5 w-5 text-teal-600" />
              <span className="font-medium text-sm text-teal-700 dark:text-teal-400">Pagamento PIX</span>
            </div>
            <div className="space-y-1 text-xs">
              <p><span className="text-muted-foreground">Chave:</span> {pixData.key}</p>
              <p><span className="text-muted-foreground">Tipo:</span> {pixData.key_type}</p>
              {pixData.merchant_name && (
                <p><span className="text-muted-foreground">Nome:</span> {pixData.merchant_name}</p>
              )}
            </div>
            <Button
              size="sm"
              className="mt-2 w-full h-7 text-xs"
              variant="outline"
              onClick={() => copyToClipboard(pixData.key, 'Chave PIX')}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar Chave PIX
            </Button>
          </div>
        );
      }

      default:
        return <p className="text-sm">Tipo de mensagem não suportado</p>;
    }
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        'flex mb-1 px-2',
        isFromAgent ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[65%] rounded-lg px-3 py-2 relative group',
          isFromAgent
            ? 'bg-primary rounded-tr-sm shadow-sm agent-message-bubble'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-sm shadow-sm lead-message-bubble'
        )}
        style={isFromAgent ? {
          // Agent bubble: All text white in light mode, chat background color in dark mode
          color: 'var(--agent-text-color)',
        } as React.CSSProperties : undefined}
      >
        {/* Menu de ações */}
        {(canReply || canForward || canPin || canEdit || canDeleteForEveryone || canDeleteForPlatform || canSendToFolder || !!onReact) && (
          <div className={cn('absolute top-1.5 z-10 flex gap-0.5 items-center transition-opacity opacity-0 group-hover:opacity-100', isFromAgent ? 'left-1.5' : 'right-1.5')}>

            {/* Chevron Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-6 w-6 rounded-md flex items-center justify-center transition-opacity hover:bg-background/80 bg-background/40 border border-border/40 backdrop-blur-sm"
                  aria-label="Ações da mensagem"
                >
                  <ChevronDown className="h-4 w-4 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isFromAgent ? 'start' : 'end'} className="w-48">
                {onReact && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <SmilePlus className="h-4 w-4 mr-2" />
                      Reagir
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <div className="flex gap-1 p-1">
                          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              className="h-8 w-8 hover:bg-muted rounded-md flex items-center justify-center text-lg transition-transform hover:scale-110"
                              onClick={(e) => { e.stopPropagation(); onReact(message, emoji); }}
                              title={`Reagir com ${emoji}`}
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
                  <DropdownMenuItem onClick={() => onReply?.(message)}>
                    <Reply className="h-4 w-4 mr-2" />
                    Responder
                  </DropdownMenuItem>
                )}
                {canForward && (
                  <DropdownMenuItem onClick={() => onForward?.(message)}>
                    <Forward className="h-4 w-4 mr-2" />
                    Encaminhar
                  </DropdownMenuItem>
                )}
                {canPin && (
                  <DropdownMenuItem onClick={() => onPinMessage?.(message)}>
                    {messageIsPinned ? (
                      <><PinOff className="h-4 w-4 mr-2" /> Desafixar mensagem</>
                    ) : (
                      <><Pin className="h-4 w-4 mr-2" /> Fixar mensagem</>
                    )}
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem onClick={() => onEdit?.(message)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                )}
                {canDeleteForEveryone && (
                  <DropdownMenuItem
                    className="text-red-500 hover:text-red-600 focus:text-red-600 focus:bg-red-500/10"
                    onClick={() => onDeleteForEveryone?.(message)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir para todos
                  </DropdownMenuItem>
                )}
                {canDeleteForPlatform && (
                  <DropdownMenuItem
                    className="text-red-500 hover:text-red-600 focus:text-red-600 focus:bg-red-500/10"
                    onClick={() => onDeleteForPlatform?.(message)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir para mim
                  </DropdownMenuItem>
                )}
                {canSendToFolder && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onSendToFolder?.(message)}>
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Enviar para Pasta
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Link color styling moved to index.css to avoid per-bubble inline <style> */}

        {/* Link color styling moved to index.css to avoid per-bubble inline <style> */}

        {/* Quote preview */}
        {quoteLabel && !isDeletedForUI && (
          <button
            type="button"
            onClick={handleScrollToQuoted}
            className={cn(
              'w-full text-left mb-1 px-2 py-1 rounded-md border',
              isFromAgent ? 'border-border/40 bg-background/15' : 'border-border bg-muted/30'
            )}
            title="Ver mensagem citada"
          >
            <div className="text-[11px] opacity-80 flex items-center gap-1">
              <Reply className="h-3 w-3" />
              Respondendo
            </div>
            <div className="text-xs line-clamp-2 opacity-90">{quoteLabel}</div>
          </button>
        )}

        {renderContent()}
        <div className="flex items-center justify-end gap-1 mt-1">
          {isFromAI && (
            <span className={cn(
              "text-[10px] flex items-center gap-0.5",
              isFromAgent ? "text-white/80" : "text-violet-500"
            )} title="Gerado por Inteligência Artificial">
              I.A
            </span>
          )}
          {isFromDevice && (
            <span className={cn(
              "text-[10px] flex items-center gap-0.5",
              isFromAgent ? "text-white/80" : "text-muted-foreground"
            )} title="Enviado pelo WhatsApp App">
              Celular
            </span>
          )}
          {messageIsPinned && (
            <Pin className={cn(
              "h-3 w-3 rotate-45 ml-0.5",
              isFromAgent ? "" : "text-muted-foreground"
            )} style={isFromAgent ? { opacity: 0.7 } : undefined} />
          )}
          {message.edited_at && (
            <span className={cn(
              "text-[10px] ml-0.5",
              isFromAgent ? "text-white/80" : "text-muted-foreground"
            )} title="Mensagem editada">
              (editado)
            </span>
          )}
          <span className={cn(
            "text-[11px] ml-0.5",
            isFromAgent ? "" : "text-muted-foreground"
          )} style={isFromAgent ? { opacity: 0.7 } : undefined}>
            {time}
          </span>
          {isFromAgent && !message.private && message.message_type !== 'system' && (
            <MessageStatus
              className="opacity-70"
              optimisticStatus={(message as any).optimistic_status}
              deliveredAt={message.delivered_at}
              readAt={message.read_at}
              failedAt={message.failed_at}
              errorMessage={message.error_message}
            />
          )}
        </div>

        {/* Reactions */}
        {message.reactions && Array.isArray(message.reactions) && message.reactions.length > 0 && (
          <div className={cn(
            "absolute -bottom-2.5 px-1.5 py-0.5 rounded-full text-[11px] shadow-sm flex items-center gap-0.5 border z-10",
            isFromAgent ? "-left-1 bg-background border-border text-foreground" : "-right-1 bg-background border-border text-foreground"
          )}>
            {Array.from(new Set(message.reactions.map((r: any) => r.emoji || r))).map((emoji: any, i) => (
              <span key={i} className="leading-none">{emoji}</span>
            ))}
            {message.reactions.length > 1 && (
              <span className="text-[9px] font-medium opacity-80 leading-none">{message.reactions.length}</span>
            )}
          </div>
        )}
      </div>
    </div >
  );
};
