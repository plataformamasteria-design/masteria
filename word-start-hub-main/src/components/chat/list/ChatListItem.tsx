import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bot, ArrowRightLeft, CheckCircle2, BotOff, Pin, Users, Facebook, Instagram, PinOff, Smartphone } from 'lucide-react';
import { GhlBadge } from '@/components/ui/ghl-badge';
import { LeadAvatar } from '@/components/leads/LeadAvatar';
import { ScheduledMessageBadge } from '@/components/chat/ScheduledMessageBadge';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';

// Duplicated local version to avoid heavy prop-drilling or external dependency
const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return format(date, 'HH:mm');
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ontem';
    } else {
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
    }
};

const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

export function TagPill({ name, color, subtle }: { name: string; color?: string; subtle?: boolean }) {
    if (subtle) {
        return (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-border truncate max-w-[80px]">
                {name}
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 truncate max-w-[120px]" style={{ backgroundColor: color ? `${color}15` : undefined, borderColor: color ? `${color}30` : undefined, color: color || 'currentColor' }}>
            {name}
        </Badge>
    );
}

export function ChatListItem({
    chat,
    showPinIndicator,
    selectedChatId,
    onSelectChat,
    unreadCounts,
    getGhlId,
    isPinned,
    pinChat,
    unpinChat
}: any) {
    const { isManager } = useUserRole();
    const isGroup = chat.is_group || false;
    const customName = chat.custom_name;
    const originalName = isGroup ? (chat.group_name || chat.phone) : (chat.wa_name || chat.phone);
    const displayName = customName || originalName;
    const photoUrl = isGroup ? chat.group_photo_url : chat.wa_photo_url;
    const hasUnread = unreadCounts[chat.id] && unreadCounts[chat.id] > 0;
    const hasHumanRequest = !!chat.human_requested_at;
    const hasTransferRequest = !!chat.transfer_requested_at;
    const hasBotFinished = !!chat.bot_finished_at;
    const isBotPermanentlyStopped = !!chat.bot_permanently_stopped;
    const ghlId = getGhlId && getGhlId(chat.id, "contact");
    const chatIsPinned = isPinned ? isPinned(chat.id) : false;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <button
                    onClick={() => onSelectChat(chat.id)}
                    className={cn(
                        'w-full px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors duration-150 text-left relative',
                        selectedChatId === chat.id && 'bg-slate-100 dark:bg-slate-800/60',
                        isGroup && 'border-l-2 border-l-green-500/50'
                    )}
                >
                    <div className="flex items-start gap-2.5">
                        <div className="relative">
                            <LeadAvatar
                                isGroup={isGroup}
                                photoUrl={photoUrl}
                                name={displayName}
                                participantCount={chat.participant_count}
                                size="md"
                                showGroupIndicator={isGroup}
                            />
                            {hasHumanRequest && !hasTransferRequest && (
                                <div
                                    className="absolute -top-1 -left-1 h-4 w-4 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50 flex items-center justify-center"
                                    title="Atendimento humano solicitado pelo robô"
                                >
                                    <Bot className="h-2.5 w-2.5 text-yellow-800" />
                                </div>
                            )}
                            {hasTransferRequest && (
                                <div
                                    className="absolute -top-1 -left-1 h-4 w-4 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-400/50 flex items-center justify-center"
                                    title="Conversa transferida para você"
                                >
                                    <ArrowRightLeft className="h-2.5 w-2.5 text-white" />
                                </div>
                            )}
                            {hasBotFinished && !hasHumanRequest && !hasTransferRequest && (
                                <div
                                    className="absolute -top-1 -left-1 h-4 w-4 bg-emerald-500 rounded-full shadow-lg shadow-emerald-400/50 flex items-center justify-center"
                                    title={isBotPermanentlyStopped ? "Robô parado permanentemente" : "Robô finalizou o atendimento"}
                                >
                                    {isBotPermanentlyStopped
                                        ? <BotOff className="h-2.5 w-2.5 text-white" />
                                        : <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                                    }
                                </div>
                            )}
                            {hasUnread && (
                                <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
                                    <span className="text-[10px] font-bold text-white drop-shadow-sm">
                                        {unreadCounts[chat.id]}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                                <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                                    <div className="flex items-center gap-1.5">
                                        {showPinIndicator && (
                                            <Pin className="h-3 w-3 text-muted-foreground shrink-0 rotate-45" />
                                        )}
                                        {isGroup && (
                                            <Users className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                        )}
                                        {chat.channel === 'facebook' && (
                                            <Facebook className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                        )}
                                        {chat.channel === 'instagram' && (
                                            <Instagram className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                                        )}
                                        <h3 className={cn(
                                            "text-sm font-semibold truncate",
                                            hasUnread ? "text-foreground" : "text-foreground/80"
                                        )}>
                                            {displayName.length > 18
                                                ? displayName.substring(0, 18) + '...'
                                                : displayName}
                                        </h3>
                                        {ghlId && <GhlBadge ghlId={ghlId} showText={false} className="shrink-0" />}
                                    </div>
                                    {customName && originalName && customName !== originalName && (
                                        <span className="text-[10px] text-muted-foreground truncate">
                                            {originalName.length > 24
                                                ? originalName.substring(0, 24) + '...'
                                                : originalName}
                                        </span>
                                    )}
                                </div>
                                <span className={cn(
                                    "text-[11px] shrink-0 whitespace-nowrap ml-auto",
                                    hasUnread ? "text-primary font-semibold" : "text-muted-foreground"
                                )}>
                                    {formatTime(chat.last_message_at || chat.updated_at)}
                                </span>
                            </div>

                            {isGroup && (
                                <div className="mb-1 space-y-0.5">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {chat.participant_count || 0} participantes
                                    </p>
                                </div>
                            )}

                            {chat.assigned_profile && (
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Avatar className="h-4 w-4">
                                        <AvatarImage src={chat.assigned_profile.avatar_url || undefined} />
                                        <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                                            {getInitials(chat.assigned_profile.full_name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                        {chat.assigned_profile.full_name?.split(' ')[0] || 'Agente'}
                                    </span>
                                </div>
                            )}

                            {chat.last_message && (
                                <p className={cn(
                                    "text-xs truncate mb-2",
                                    hasUnread ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-500 dark:text-slate-400"
                                )}>
                                    {chat.last_message.length > 35
                                        ? chat.last_message.substring(0, 35) + '...'
                                        : chat.last_message}
                                </p>
                            )}

                            {(chat.campaign_name || chat.ad_name) && (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                    {chat.campaign_name && (
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-primary/5 border-primary/20 text-primary truncate max-w-[140px]" title={chat.campaign_name}>
                                            C: {chat.campaign_name}
                                        </Badge>
                                    )}
                                    {chat.ad_name && (
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 truncate max-w-[120px]" title={chat.ad_name}>
                                            A: {chat.ad_name}
                                        </Badge>
                                    )}
                                </div>
                            )}

                            {/* WhatsApp Connection Name Tag */}
                            {chat.connection_display_name && (
                                <div className="mb-1">
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 truncate max-w-[120px] gap-0.5" title={`Conexão: ${chat.connection_display_name}`}>
                                        <Smartphone className="h-2.5 w-2.5" />
                                        {chat.connection_display_name}
                                    </Badge>
                                </div>
                            )}

                            {chat.next_scheduled_message && (
                                <div className="mb-1">
                                    <ScheduledMessageBadge
                                        scheduledFor={chat.next_scheduled_message.scheduled_for}
                                        content={chat.next_scheduled_message.content}
                                        compact
                                    />
                                </div>
                            )}

                            {chat.tags && chat.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    <TagPill name={chat.tags[0].name} color={chat.tags[0].color} />
                                    {chat.tags.length > 1 && (
                                        <TagPill name={`+${chat.tags.length - 1}`} subtle />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
                {chatIsPinned ? (
                    <ContextMenuItem onClick={() => unpinChat?.(chat.id)}>
                        <PinOff className="h-4 w-4 mr-2" /> Desafixar conversa
                    </ContextMenuItem>
                ) : (
                    <ContextMenuSub>
                        <ContextMenuSubTrigger>
                            <Pin className="h-4 w-4 mr-2" /> Fixar conversa
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                            <ContextMenuItem onClick={() => pinChat?.(chat.id, 'user', null)}>
                                Somente para mim
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => pinChat?.(chat.id, 'team', chat.team_id)}>
                                Para a equipe
                            </ContextMenuItem>
                            {isManager && (
                                <ContextMenuItem onClick={() => pinChat?.(chat.id, 'all', null)}>
                                    Para todos
                                </ContextMenuItem>
                            )}
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
