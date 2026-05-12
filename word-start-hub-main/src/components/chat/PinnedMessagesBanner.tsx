import React, { useState } from 'react';
import { Pin, X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/message';

interface PinnedMessageEntry {
    id: string;
    message_id: string;
    message?: Message;
}

interface PinnedMessagesBannerProps {
    pinnedMessages: PinnedMessageEntry[];
    onScrollToMessage?: (messageId: string) => void;
    onUnpin?: (messageId: string) => void;
}

export function PinnedMessagesBanner({
    pinnedMessages,
    onScrollToMessage,
    onUnpin,
}: PinnedMessagesBannerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!pinnedMessages.length) return null;

    const total = pinnedMessages.length;
    const safeIndex = Math.min(currentIndex, total - 1);
    const current = pinnedMessages[safeIndex];
    const message = current?.message;

    const getPreview = (msg: Message | undefined): string => {
        if (!msg) return 'Mensagem fixada';
        switch (msg.message_type) {
            case 'text':
                return msg.content?.slice(0, 120) || 'Mensagem de texto';
            case 'image':
                return '📷 Foto';
            case 'audio':
                return '🎤 Mensagem de voz';
            case 'video':
                return '🎥 Vídeo';
            case 'document':
            case 'pdf':
                return `📄 ${msg.file_name || 'Documento'}`;
            case 'contact':
                return '👤 Contato';
            case 'location':
                return '📍 Localização';
            default:
                return msg.content?.slice(0, 120) || 'Mensagem fixada';
        }
    };

    const handleCycle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((i) => (i < total - 1 ? i + 1 : 0));
    };

    return (
        <div
            className="flex items-stretch bg-card/95 backdrop-blur-sm border-b border-border cursor-pointer hover:bg-muted/40 transition-colors duration-200 group/pin"
            onClick={() => current?.message_id && onScrollToMessage?.(current.message_id)}
        >
            {/* Barra lateral verde estilo WhatsApp */}
            <div className="w-1 bg-emerald-500 shrink-0" />

            {/* Indicador de posição (barrinhas verticais - estilo WhatsApp) */}
            {total > 1 && (
                <div className="flex flex-col justify-center gap-[2px] pl-2.5 py-2">
                    {Array.from({ length: total }).map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                'w-[3px] rounded-full transition-all duration-300',
                                total <= 2 ? 'h-[10px]' : 'h-[7px]',
                                i === safeIndex
                                    ? 'bg-emerald-500'
                                    : 'bg-muted-foreground/20'
                            )}
                        />
                    ))}
                </div>
            )}

            {/* Conteúdo */}
            <div className="flex-1 min-w-0 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <Pin className="h-3 w-3 text-emerald-500 shrink-0 rotate-45" />
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {total > 1
                            ? `Mensagem fixada #${safeIndex + 1}`
                            : 'Mensagem fixada'}
                    </span>
                </div>
                <p className="text-[13px] text-foreground/70 truncate leading-tight">
                    {getPreview(message)}
                </p>
            </div>

            {/* Botão navegar (quando múltiplas) */}
            {total > 1 && (
                <button
                    onClick={handleCycle}
                    className="px-2 flex items-center justify-center hover:bg-muted/50 transition-colors shrink-0"
                    title="Próxima mensagem fixada"
                >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
            )}

            {/* Botão desafixar */}
            {onUnpin && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        current?.message_id && onUnpin(current.message_id);
                    }}
                    className="px-3 flex items-center justify-center opacity-0 group-hover/pin:opacity-100 transition-opacity duration-200 hover:bg-destructive/10 shrink-0"
                    title="Desafixar mensagem"
                >
                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                </button>
            )}
        </div>
    );
}
