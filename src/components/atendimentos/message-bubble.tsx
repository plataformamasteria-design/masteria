
// src/components/atendimentos/message-bubble.tsx
'use client';

import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";
import { Check, CheckCheck, Clock, AlertTriangle, FileText, ImageIcon, Mic, Video, Smile, Calendar as CalendarIcon, StickyNote } from 'lucide-react';
import React, { useState, useEffect } from 'react';
// import Image from "next/image";
import { AudioPlayer } from "./audio-player";

type MessageReaction = {
    emoji: string;
    reactorPhone: string;
    reactorName?: string | null;
};

type MessageWithReactions = Message & {
    reactions?: MessageReaction[];
};

const StatusIcon = ({ status }: { status: Message['status'] }) => {
    if (!status) return null;
    const lowerCaseStatus = status.toLowerCase();

    switch (lowerCaseStatus) {
        case 'sent': return <Check className="h-3.5 w-3.5" />;
        case 'delivered': return <CheckCheck className="h-3.5 w-3.5" />;
        case 'read': return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
        case 'failed': return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
        case 'received': return null;
        case 'pending': return <Clock className="h-3.5 w-3.5 opacity-60" />;
        default: return null;
    }
}

const MediaError = () => (
    <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] border-dashed text-muted-foreground w-full h-full min-h-[120px] max-w-[280px]">
        <AlertTriangle className="h-5 w-5 text-amber-500/60" />
        <p className="text-xs text-center font-medium">Mídia não disponível</p>
        <p className="text-[10px] text-center opacity-50 leading-tight">
            Este arquivo foi perdido durante atualização do servidor.
            Novas mídias serão salvas de forma persistente.
        </p>
    </div>
);

const ChatImage = ({ src, alt, className, width, height }: any) => {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(src);
    const [retryCount, setRetryCount] = useState(0);
    const MAX_RETRIES = 1;

    // React to src prop changes (e.g. when S3 background upload finishes and polling updates the message)
    useEffect(() => {
        setCurrentSrc(src);
        setHasError(false);
        setIsLoading(true);
        setRetryCount(0);
    }, [src]);

    const handleError = async () => {
        // Se já tentou refresh ou não tem URL, mostra erro
        if (retryCount >= MAX_RETRIES || !currentSrc) {
            setIsLoading(false);
            setHasError(true);
            return;
        }

        // Tentar refresh da URL
        setIsRefreshing(true);
        setRetryCount(prev => prev + 1);

        try {
            const response = await fetch('/api/v1/media/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaUrl: currentSrc })
            });

            const data = await response.json();

            if (data.success && data.url) {
                console.log('[ChatImage] URL refreshed successfully');
                setCurrentSrc(data.url);
                setIsRefreshing(false);
                // A nova URL vai disparar onLoad ou onError
            } else {
                console.warn('[ChatImage] Refresh failed:', data.error);
                setIsLoading(false);
                setIsRefreshing(false);
                setHasError(true);
            }
        } catch (error) {
            console.error('[ChatImage] Refresh error:', error);
            setIsLoading(false);
            setIsRefreshing(false);
            setHasError(true);
        }
    };

    if (hasError) return <MediaError />;

    return (
        <div className="relative" style={{ width: width || 'auto', height: height || 'auto' }}>
            {(isLoading || isRefreshing) && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse rounded-lg">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                    {isRefreshing && (
                        <span className="absolute bottom-2 text-[10px] text-muted-foreground">
                            Recarregando...
                        </span>
                    )}
                </div>
            )}
            <img
                key={currentSrc} // Force re-render when src changes
                src={currentSrc}
                alt={alt}
                className={cn(className, (isLoading || isRefreshing) ? 'opacity-0' : 'opacity-100 transition-opacity duration-300')}
                style={{
                    maxWidth: '100%',
                    height: 'auto',
                    objectFit: 'cover',
                    display: 'block'
                }}
                onLoad={() => {
                    setIsLoading(false);
                    setIsRefreshing(false);
                }}
                onError={handleError}
            />
        </div>
    );
};



const RepliedMessagePreview = ({ message, contactName }: { message: MessageWithReactions | undefined, contactName?: string | null }) => {
    if (!message) return null;

    const isUser = message.senderType === 'USER';
    const author = isUser ? contactName || 'Cliente' : 'Você';

    let content: React.ReactNode = message.content;
    if (message.contentType === 'IMAGE') content = <div className="flex items-center gap-1.5"><ImageIcon className="h-4 w-4" /> Imagem</div>;
    else if (message.contentType === 'VIDEO') content = <div className="flex items-center gap-1.5"><Video className="h-4 w-4" /> Vídeo</div>;
    else if (message.contentType === 'DOCUMENT') content = <div className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> {message.content}</div>;
    else if (message.contentType === 'AUDIO') content = <div className="flex items-center gap-1.5"><Mic className="h-4 w-4" /> Mensagem de voz</div>;
    else if (message.contentType === 'STICKER') content = <div className="flex items-center gap-1.5"><Smile className="h-4 w-4" /> Sticker</div>;

    if (typeof content === 'string' && content.length > 70) {
        content = `${content.substring(0, 70)}...`;
    }

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const targetId = e.currentTarget.hash.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Add a visual cue
            targetElement.classList.add('bg-primary/20', 'transition-colors', 'duration-1000');
            setTimeout(() => {
                targetElement.classList.remove('bg-primary/20');
            }, 1500);
        }
    };

    return (
        <a
            href={`#message-${message.id}`}
            onClick={handleClick}
            className={cn(
                "block p-2 rounded-md mb-2 text-xs cursor-pointer hover:bg-black/10 dark:hover:bg-white/10",
                !isUser ? 'bg-primary/20' : 'bg-muted'
            )}
        >
            <p className="font-semibold">{author}</p>
            <div className="opacity-80">{content}</div>
        </a>
    )
}

const ReactionsBadge = ({ reactions }: { reactions?: MessageReaction[] }) => {
    if (!reactions || reactions.length === 0) return null;

    const groupedReactions = reactions.reduce((acc, reaction) => {
        if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = [];
        }
        acc[reaction.emoji]!.push(reaction);
        return acc;
    }, {} as Record<string, MessageReaction[]>);

    return (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(groupedReactions).map(([emoji, reactors]) => (
                <div
                    key={emoji}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-card/80 backdrop-blur-sm border border-white/[0.08] text-xs shadow-sm"
                    title={reactors.map(r => r.reactorName || r.reactorPhone).join(', ')}
                >
                    <span>{emoji}</span>
                    {reactors.length > 1 && <span className="font-semibold text-[10px]">{reactors.length}</span>}
                </div>
            ))}
        </div>
    );
};

const FormatWhatsAppText = ({ text }: { text: string }) => {
    if (!text) return null;

    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);

    return (
        <span className="text-sm whitespace-pre-wrap break-words [word-break:break-word]">
            {parts.map((part, index) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    return (
                        <code key={index} className="block bg-black/10 dark:bg-white/10 p-2 rounded text-xs font-mono my-1">
                            {part.slice(3, -3)}
                        </code>
                    );
                }

                // Process Bold (*text*)
                const boldParts = part.split(/(\*[^*\n]+\*)/g);
                return boldParts.map((boldPart, bIndex) => {
                    if (boldPart.startsWith('*') && boldPart.endsWith('*') && boldPart.length > 2) {
                        return <strong key={`${index}-${bIndex}`}>{boldPart.slice(1, -1)}</strong>;
                    }

                    // Process Italic (_text_)
                    const italicParts = boldPart.split(/(_[^_\n]+_)/g);
                    return italicParts.map((italicPart, iIndex) => {
                        if (italicPart.startsWith('_') && italicPart.endsWith('_') && italicPart.length > 2) {
                            return <em key={`${index}-${bIndex}-${iIndex}`}>{italicPart.slice(1, -1)}</em>;
                        }

                        // Process Strike (~text~)
                        const strikeParts = italicPart.split(/(~[^~\n]+~)/g);
                        return strikeParts.map((strikePart, sIndex) => {
                            if (strikePart.startsWith('~') && strikePart.endsWith('~') && strikePart.length > 2) {
                                return <del key={`${index}-${bIndex}-${iIndex}-${sIndex}`}>{strikePart.slice(1, -1)}</del>;
                            }
                            
                            // Process URLs
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const urlParts = strikePart.split(urlRegex);
                            return urlParts.map((uPart, uIndex) => {
                                if (urlRegex.test(uPart)) {
                                    return (
                                        <a 
                                            key={`url-${index}-${bIndex}-${iIndex}-${sIndex}-${uIndex}`} 
                                            href={uPart} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-blue-500 hover:text-blue-600 hover:underline cursor-pointer break-all"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {uPart}
                                        </a>
                                    );
                                }
                                return uPart;
                            });
                        });
                    });
                });
            })}
        </span>
    );
};

const MeetingIndicator = ({ text }: { text: string }) => {
    if (!text) return null;
    const meetLinkMatch = text.match(/https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i);
    const hasSchedulingKeyword = /reuni[aã]o\s+agendad[ao]/i.test(text) || /meeting\s+scheduled/i.test(text);
    if (!meetLinkMatch && !hasSchedulingKeyword) return null;

    return (
        <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-xs">
            <CalendarIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-300 font-semibold">Reunião agendada</span>
            {meetLinkMatch && (
                <a
                    href={meetLinkMatch[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                    <Video className="h-3 w-3" />
                    Meet
                </a>
            )}
        </div>
    );
};

export function MessageBubble({ message, allMessages, contactName, templates, connections }: { message: MessageWithReactions, allMessages: MessageWithReactions[], contactName?: string | null, templates?: any[], connections?: any[] }) {
    if (message.senderType === 'SYSTEM') {
        return (
            <div id={`message-${message.id}`} className="flex w-full justify-center my-3">
                <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-muted-foreground text-[11px] px-4 py-1.5 rounded-full flex items-center gap-1.5 max-w-[85%] text-center italic">
                    <span>{message.content}</span>
                </div>
            </div>
        );
    }

    if (message.contentType === 'INTERNAL_NOTE') {
        let text = message.content;
        let authorName = 'Agente';
        try {
            const parsed = JSON.parse(message.content || '{}');
            if (parsed.text) text = parsed.text;
            if (parsed.authorName) authorName = parsed.authorName;
        } catch (e) {
            // Retrocompatibilidade se já existir notas em texto simples
        }

        return (
            <div id={`message-${message.id}`} className="flex w-full justify-center my-4">
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200 text-sm px-4 py-3 rounded-2xl flex flex-col w-full max-w-[85%] shadow-sm">
                    <div className="flex items-center gap-1.5 mb-2 opacity-80 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        <StickyNote className="h-3.5 w-3.5" />
                        <span>Nota Interna • {authorName}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed"><FormatWhatsAppText text={text || ''} /></div>
                    <div className="flex items-center justify-end mt-1.5 opacity-60 text-[10px] text-amber-700 dark:text-amber-400">
                        <span>
                            {message.sentAt && !isNaN(new Date(message.sentAt).getTime())
                                ? new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '--:--'}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    const isMe = message.senderType === 'AGENT' || message.senderType === 'AI';
    const repliedMessage = message.repliedToMessageId ? allMessages.find(m => m.id === message.repliedToMessageId) : undefined;
    const _isAudio = message.contentType === 'AUDIO';

    const renderContent = () => {
        switch (message.contentType) {
            case 'IMAGE':
                return message.mediaUrl ? (
                    <ChatImage
                        src={message.mediaUrl}
                        alt="Imagem enviada"
                        className="rounded-lg"
                        width={300}
                    />
                ) : <MediaError />;
            case 'VIDEO':
                return message.mediaUrl ? (
                    <video src={message.mediaUrl} controls className="rounded-lg w-full max-w-xs">
                        Seu navegador não suporta a tag de vídeo.
                    </video>
                ) : <MediaError />;
            case 'AUDIO':
                return (
                    <div className="w-full space-y-2">
                        {message.mediaUrl ? (
                            <AudioPlayer key={message.id} src={message.mediaUrl} />
                        ) : message.content ? (
                            <div className="flex items-center gap-2 p-2 rounded bg-black/5 dark:bg-white/5 italic text-sm">
                                <Mic className="h-4 w-4 shrink-0 opacity-70" />
                                <span>{message.content}</span>
                            </div>
                        ) : <MediaError />}
                        
                        {message.mediaUrl && (message as any).aiTranscription && (
                            <p className="text-xs italic opacity-70 border-t border-black/5 dark:border-white/5 pt-1 mt-1">
                                {(message as any).aiTranscription}
                            </p>
                        )}
                    </div>
                );
            case 'DOCUMENT':
                return message.mediaUrl ? (
                    <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20">
                        <FileText className="h-6 w-6" />
                        <span className="truncate">{message.content}</span>
                    </a>
                ) : <MediaError />;
            case 'STICKER':
                return message.mediaUrl ? (
                    <ChatImage
                        src={message.mediaUrl}
                        alt="Sticker"
                        width={150}
                        className="object-contain bg-transparent"
                    />
                ) : <MediaError />;
            case 'TEXT':
            case 'BUTTON':
            case 'INTERACTIVE':
            default: {
                // ✅ FIX: Renderizar card informativo para mensagens não suportadas (novas e legadas)
                const upperContent = (message.content || '').toUpperCase().trim();
                const isLegacyUnsupported = upperContent === 'UNSUPPORTED' || upperContent === 'MENSAGEM NÃO SUPORTADA';
                const isDecodedUnsupported = /^[🗑📊📢📅🛒🏷📋❓⚠️]/.test(message.content || '');

                if (isLegacyUnsupported) {
                    return (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 text-xs text-muted-foreground italic">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>Mensagem não suportada pela API do WhatsApp</span>
                        </div>
                    );
                }
                if (isDecodedUnsupported) {
                    return (
                        <div className="flex items-center gap-1.5 p-1.5 text-sm text-muted-foreground/80 italic">
                            <span>{message.content}</span>
                        </div>
                    );
                }

                if (message.content?.startsWith('Template:')) {
                    const tName = message.content.replace('Template:', '').trim();
                    const templateDef = templates?.find(t => t.name === tName);
                    
                    if (templateDef) {
                        const components = templateDef.components || [];
                        const header = components.find((c: any) => c.type === 'HEADER');
                        const body = components.find((c: any) => c.type === 'BODY');
                        const footer = components.find((c: any) => c.type === 'FOOTER');
                        const buttons = components.find((c: any) => c.type === 'BUTTONS');

                        return (
                            <div className="flex flex-col gap-1.5 w-full min-w-[200px]">
                                {header && header.format === 'IMAGE' && (
                                    <div className="w-full h-32 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center mb-1 border border-white/10">
                                        <ImageIcon className="h-8 w-8 opacity-40" />
                                    </div>
                                )}
                                {header && header.format === 'VIDEO' && (
                                    <div className="w-full h-32 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center mb-1 border border-white/10">
                                        <Video className="h-8 w-8 opacity-40" />
                                    </div>
                                )}
                                {header && header.format === 'DOCUMENT' && (
                                    <div className="w-full h-16 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center mb-1 border border-white/10">
                                        <FileText className="h-6 w-6 opacity-40" />
                                    </div>
                                )}
                                {header && header.format === 'TEXT' && (
                                    <div className="font-bold text-[14px] leading-tight pb-1"><FormatWhatsAppText text={header.text} /></div>
                                )}
                                {body && (
                                    <div className="text-[13px] leading-relaxed whitespace-pre-wrap"><FormatWhatsAppText text={body.text} /></div>
                                )}
                                {footer && (
                                    <div className="text-[11px] opacity-60 mt-1">{footer.text}</div>
                                )}
                                {buttons && buttons.buttons?.length > 0 && (
                                    <div className="flex flex-col gap-0 mt-2 border-t border-white/10">
                                        {buttons.buttons.map((btn: any, i: number) => (
                                            <div key={i} className="text-center text-[#00a884] dark:text-[#33c2a6] font-semibold text-[13px] py-2 border-b border-white/10 last:border-0 hover:bg-white/5 transition-colors cursor-pointer rounded-sm">
                                                {btn.text}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const formatted = tName.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/_/g, ' ');
                    return (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 text-sm">
                            <FileText className="h-5 w-5 opacity-70 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Template Enviado</span>
                                <span className="capitalize font-medium">{formatted}</span>
                            </div>
                        </div>
                    );
                }

                return (
                    <>
                        <FormatWhatsAppText text={message.content || ''} />
                        {isMe && <MeetingIndicator text={message.content || ''} />}
                    </>
                );
            }
        }
    }

    return (
        <div id={`message-${message.id}`} className={cn("flex flex-col gap-1 w-full", !isMe ? 'items-start' : 'items-end')}>
            <div className={cn(
                "relative px-3.5 py-2.5 text-sm group max-w-[min(85%,78ch)]",
                isMe
                    ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white bubble-sent shadow-md shadow-emerald-900/20'
                    : 'bg-card text-foreground bubble-received border border-white/[0.06] shadow-sm shadow-black/5'
            )}>
                {/* AI indicator */}
                {message.senderType === 'AI' && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                        IA
                    </div>
                )}

                {repliedMessage && (
                    <div className="mb-2 opacity-80 text-xs border-l-2 border-white/20 pl-2 py-1">
                        <RepliedMessagePreview message={repliedMessage} contactName={contactName} />
                    </div>
                )}

                <div className="flex flex-col relative min-w-[80px]">
                    <div className={cn("mr-0", isMe ? "pb-[6px]" : "pb-0")}>
                        {renderContent()}
                    </div>

                    <div className={cn(
                        "flex items-center gap-1.5 self-end float-right mt-1 ml-2",
                        "text-[10px] leading-none shrink-0",
                        isMe ? "text-white/60" : "text-muted-foreground/50"
                    )}>
                        {message.connectionId && connections && (
                            <span className="truncate max-w-[60px] opacity-70" title={connections.find(c => c.id === message.connectionId)?.config_name || 'Conexão'}>
                                {connections.find(c => c.id === message.connectionId)?.config_name || ''}
                            </span>
                        )}
                        <span className="font-medium">
                            {message.sentAt && !isNaN(new Date(message.sentAt).getTime())
                                ? new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '--:--'}
                        </span>
                        <div className={cn("flex items-center ml-0.5", isMe ? "text-white/70" : "text-muted-foreground/60")}>
                            <StatusIcon status={message.status} />
                        </div>
                    </div>
                </div>

                <ReactionsBadge reactions={message.reactions} />
            </div>
        </div>
    );
}
