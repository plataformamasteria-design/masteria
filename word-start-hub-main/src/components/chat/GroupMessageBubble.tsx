import React, { useMemo, useState, useEffect } from 'react';
import { Message, ContactData, LocationData, PixData } from '@/types/message';
import { format } from 'date-fns';
import { ChevronDown, Copy, Download, ExternalLink, Eye, EyeOff, FileText, Forward, MapPin, Pencil, Phone, Pin, PinOff, QrCode, Reply, Trash2, User, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTextWithMentions, hasMentions, buildParticipantsMap, ParticipantInfo } from '@/lib/mention-utils';
import { formatBrPhoneFromDigits } from '@/lib/group-participants';
import { AudioPlayer } from './AudioPlayer';
import { ImageLightbox } from './ImageLightbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageStatus } from './MessageStatus';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface GroupMessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDeleteForEveryone?: (message: Message) => void;
  onDeleteForPlatform?: (message: Message) => void;
  onOpenSenderLead?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onPinMessage?: (message: Message) => void;
  isMessagePinned?: (messageId: string) => boolean;
  onMentionClick?: (phone: string) => void;
  participantsMap?: Map<string, ParticipantInfo>;
}

// Cores para nomes de remetentes em grupos (estilo WhatsApp Web)
const senderColors = [
  '#25D366', // WhatsApp Green
  '#34B7F1', // WhatsApp Blue
  '#9C27B0', // Purple
  '#FF5722', // Deep Orange
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FF9800', // Orange
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#F44336', // Red
  '#673AB7', // Deep Purple
  '#009688', // Teal
];

const getSenderColor = (senderName: string): string => {
  let hash = 0;
  for (let i = 0; i < senderName.length; i++) {
    hash = senderName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return senderColors[Math.abs(hash) % senderColors.length];
};

export const GroupMessageBubble: React.FC<GroupMessageBubbleProps> = ({
  message,
  onReply,
  onEdit,
  onDeleteForEveryone,
  onDeleteForPlatform,
  onOpenSenderLead,
  onForward,
  onPinMessage,
  isMessagePinned,
  onMentionClick,
  participantsMap,
}) => {
  const { toast } = useToast();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // is_from_user=true significa mensagem enviada pelo atendente/plataforma (DIREITA - outgoing)
  // is_from_user=false significa mensagem recebida do lead (ESQUERDA - incoming)
  const isOutgoing = message.is_from_user;
  const isFromUser = !message.is_from_user; // Para compatibilidade com lógica existente
  const time = format(new Date(message.created_at), 'HH:mm');
  const senderName = message.sender_name;
  const senderPhone = message.sender_phone;
  const senderColor = senderName ? getSenderColor(senderName) : (senderPhone ? getSenderColor(senderPhone) : undefined);

  const isFromAI = message.sender_name === 'I.A ✨';
  const isFromDevice = isOutgoing && message.sent_from_platform === false && !isFromAI;

  // Format display: "Nome · +55 11 99999-8888" or just name/phone
  // Skip LID-like numbers (they are internal WhatsApp IDs, not real phones)
  const senderDisplayLabel = useMemo(() => {
    // Detect if sender_phone is actually a LID (Linked ID) - internal WhatsApp identifier, not real phone
    const isLidNumber = (phone: string | null | undefined): boolean => {
      if (!phone) return true; // No phone = treat as LID (don't show)
      const digits = String(phone).replace(/\D/g, '');
      // LIDs are typically 14+ digits and don't start with valid country codes
      if (digits.length > 13) return true;
      // Brazilian phones are 10-13 digits (with or without country code)
      // If it doesn't start with 55 and is longer than 12 digits, it's likely a LID
      if (!digits.startsWith('55') && digits.length > 12) return true;
      // If it's too short to be a real phone, skip it
      if (digits.length < 8) return true;
      return false;
    };

    const phoneIsLid = isLidNumber(senderPhone);
    const formattedPhone = !phoneIsLid && senderPhone ? formatBrPhoneFromDigits(senderPhone) : null;

    if (senderName && formattedPhone) {
      return `${senderName} · ${formattedPhone}`;
    }
    if (senderName) {
      return senderName;
    }
    if (formattedPhone) {
      return formattedPhone;
    }
    // If we only have a LID (no name, no real phone), show "Participante"
    return 'Participante';
  }, [senderName, senderPhone]);

  // Helper to format text content with mentions
  const formatMessageContent = (content: string) => {
    if (hasMentions(content)) {
      // Pass participantsMap to resolve names for mentions
      return formatTextWithMentions(content, onMentionClick, `msg-${message.id}`, participantsMap);
    }
    // Fallback: process bold text only
    return processBoldText(content);
  };

  // Simple bold text processor (like original formatMarkdownText but without URLs)
  const processBoldText = (text: string): React.ReactNode => {
    const boldParts = text.split(/(\*[^*]+\*)/g);
    return boldParts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        const content = part.slice(1, -1);
        return React.createElement('strong', { key: `bold-${index}` }, content);
      }
      return part;
    }).filter(part => part !== '');
  };

  const isDeletedForUI = !!(message.deleted_at || message.platform_deleted_at);

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
    withinMinutes <= 2880;
  const canDeleteForPlatform = !!onDeleteForPlatform && !isDeletedForUI && !message.private;
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
        return JSON.parse(message.content);
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

  // isOutgoing já foi definido acima com a lógica correta

  const renderContent = () => {
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
              {formatMessageContent(message.content || '')}
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
                {formatMessageContent(message.content)}
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
            <AudioPlayer src={message.file_url || ''} isFromUser={isOutgoing} />
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {formatMessageContent(message.content)}
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
                {formatMessageContent(message.content)}
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
                {formatMessageContent(message.content)}
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
        'flex mb-2 px-2',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[65%] rounded-lg shadow-sm relative group',
          isOutgoing
            ? cn('bg-primary rounded-tr-sm group-agent-message-bubble', message.is_hidden_from_agents && 'border-2 border-dashed border-white/50 bg-primary/90')
            : cn('bg-card text-card-foreground border border-border rounded-tl-sm group-lead-message-bubble', message.is_hidden_from_agents && 'border-2 border-dashed border-amber-500/50')
        )}
        style={isOutgoing ? {
          color: 'var(--agent-text-color)',
        } as React.CSSProperties : undefined}
      >
        {/* Menu de ações (chevron) */}
        {(canReply || canForward || canPin || canEdit || canDeleteForEveryone || canDeleteForPlatform) && (
          <div className={cn('absolute top-1.5 z-10', isOutgoing ? 'left-1.5' : 'right-1.5')}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'h-6 w-6 rounded-md flex items-center justify-center transition-opacity',
                    'opacity-0 group-hover:opacity-100 focus:opacity-100',
                    'bg-background/40 hover:bg-background/70 border border-border/40 backdrop-blur-sm'
                  )}
                  aria-label="Ações da mensagem"
                >
                  <ChevronDown className="h-4 w-4 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOutgoing ? 'start' : 'end'} className="w-48">
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
                {(canDeleteForEveryone || canDeleteForPlatform) && (
                  <DropdownMenuSeparator />
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Apply link color styling based on sender */}
        <style>{`
          .group-agent-message-bubble {
            --agent-text-color: white;
          }
          .dark .group-agent-message-bubble {
            --agent-text-color: hsl(220 25% 8%);
          }
          .group-agent-message-bubble,
          .group-agent-message-bubble * {
            color: var(--agent-text-color);
          }
          .group-agent-message-bubble .message-link {
            color: var(--agent-text-color) !important;
          }
          .group-lead-message-bubble .message-link {
            color: hsl(156 72% 40%) !important;
          }
          .dark .group-lead-message-bubble .message-link {
            color: white !important;
          }
        `}</style>
        {/* Notch estilo WhatsApp */}
        <div
          className={cn(
            'absolute top-0 w-3 h-3',
            isOutgoing
              ? '-right-1.5 border-t-8 border-l-8 border-t-primary border-l-transparent'
              : '-left-1.5 border-t-8 border-r-8 border-t-card border-r-transparent'
          )}
        />

        <div className="px-3 py-2">
          {/* Nome do remetente com telefone formatado - apenas para mensagens recebidas no grupo */}
          {!isOutgoing && senderDisplayLabel && (
            <button
              type="button"
              className="text-[13px] font-semibold mb-0.5 cursor-pointer hover:underline text-left"
              style={{ color: senderColor }}
              onClick={() => onOpenSenderLead?.(message)}
              title="Abrir lead"
            >
              {senderDisplayLabel}
            </button>
          )}

          {/* Quote preview */}
          {quoteLabel && !isDeletedForUI && (
            <button
              type="button"
              onClick={handleScrollToQuoted}
              className={cn(
                'w-full text-left mb-1 px-2 py-1 rounded-md border',
                isOutgoing ? 'border-border/40 bg-background/15' : 'border-border bg-muted/30'
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
            {message.is_hidden_from_agents && (
              <span className={cn(
                "text-[10px] flex items-center gap-0.5 font-semibold",
                isOutgoing ? "text-white/90" : "text-amber-600 dark:text-amber-500"
              )} title="Mensagem Oculta: Visível apenas para a Gestão e o remetente">
                <EyeOff className="h-3 w-3" />
                Oculta
              </span>
            )}
            {isFromAI && (
              <span className={cn(
                "text-[10px] flex items-center gap-0.5",
                isOutgoing ? "text-white/80" : "text-violet-500"
              )} title="Gerado por Inteligência Artificial">
                I.A
              </span>
            )}
            {isFromDevice && (
              <span className={cn(
                "text-[10px] flex items-center gap-0.5",
                isOutgoing ? "text-white/80" : "text-muted-foreground"
              )} title="Enviado pelo WhatsApp App">
                Celular
              </span>
            )}
            {messageIsPinned && (
              <Pin className={cn(
                "h-3 w-3 rotate-45 ml-0.5",
                isOutgoing ? "" : "text-muted-foreground"
              )} style={isOutgoing ? { opacity: 0.7 } : undefined} />
            )}
            {message.edited_at && (
              <span className={cn(
                "text-[10px] ml-0.5",
                isOutgoing ? "text-white/80" : "text-muted-foreground"
              )} title="Mensagem editada">
                (editado)
              </span>
            )}
            <span className={cn(
              "text-[11px] ml-0.5",
              isOutgoing ? "" : "text-muted-foreground"
            )} style={isOutgoing ? { opacity: 0.7 } : undefined}>
              {time}
            </span>
            {isOutgoing && !message.private && message.message_type !== 'system' && (
              <MessageStatus
                className="opacity-70"
                optimisticStatus={(message as any).optimistic_status}
                deliveredAt={message.delivered_at}
                readAt={message.read_at}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
