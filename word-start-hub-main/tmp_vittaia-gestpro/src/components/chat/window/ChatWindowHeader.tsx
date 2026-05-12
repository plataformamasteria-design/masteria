import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Facebook, Instagram, Clock, CheckCircle } from 'lucide-react';
import { GhlBadge } from '@/components/ui/ghl-badge';
import { LeadPhoneEditor } from '@/components/leads/LeadPhoneEditor';
import { ChatTagManager } from '../ChatTagManager';
import { ChatAssignment } from '../ChatAssignment';
import { ChatFunnelBadge } from './ChatFunnelBadge';
import { supabase } from '@/integrations/supabase/client';

export function ChatWindowHeader({
    localChat,
    onBack,
    ghlId,
    setDetailDialogOpen,
    setLocalChat,
    scheduledMessagesCount,
    showScheduledPanel,
    setShowScheduledPanel,
    openResolveDialog,
    setFunnelAssignOpen
}: any) {
    return (
        <div className="border-b border-border bg-card p-2 sm:p-3 md:p-4 overflow-hidden">
            <div
                className="flex items-center justify-between gap-1.5 sm:gap-2 md:gap-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg p-1.5 sm:p-2 -m-1.5 sm:-m-2 flex-nowrap"
                onClick={() => setDetailDialogOpen(true)}
            >
                {onBack && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            onBack();
                        }}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}

                <div className="relative">
                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <AvatarImage src={localChat.wa_photo_url || undefined} />
                        <AvatarFallback className="bg-primary/20">
                            <User className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        </AvatarFallback>
                    </Avatar>
                    {localChat.channel === 'facebook' && (
                        <Facebook className="h-3.5 w-3.5 text-blue-600 absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5" />
                    )}
                    {localChat.channel === 'instagram' && (
                        <Instagram className="h-3.5 w-3.5 text-pink-500 absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5" />
                    )}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5 max-w-full">
                        <h2 className="font-semibold text-slate-900 dark:text-white truncate text-sm md:text-base">
                            {localChat.custom_name || localChat.wa_name || localChat.phone}
                        </h2>
                    </div>
                    {localChat.custom_name && localChat.wa_name && localChat.custom_name !== localChat.wa_name && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{localChat.wa_name}</p>
                    )}
                    <div className="hidden sm:block" onClick={(e) => e.stopPropagation()}>
                        <LeadPhoneEditor
                            chatId={localChat.id}
                            phone={localChat.phone}
                            onPhoneUpdated={() => {
                                supabase
                                    .from('chats')
                                    .select('*')
                                    .eq('id', localChat.id)
                                    .single()
                                    .then(({ data }) => {
                                        if (data) setLocalChat({ ...localChat, ...data });
                                    });
                            }}
                            size="sm"
                            showIcon={false}
                        />
                    </div>
                </div>

                <div
                    className="flex flex-nowrap items-center justify-end gap-1.5 sm:gap-2 shrink-0 ml-auto overflow-x-auto no-scrollbar scroll-smooth"
                    onClick={(e) => e.stopPropagation()}
                >
                    {ghlId && <GhlBadge ghlId={ghlId} />}
                    <ChatFunnelBadge chatId={localChat.id} onClick={() => setFunnelAssignOpen(true)} />

                    {(localChat.campaign_name || localChat.ad_name) && (
                        <div title={`Campanha: ${localChat.campaign_name || 'N/A'}\nAd: ${localChat.ad_name || 'N/A'}`} className="cursor-help flex shrink-0">
                            <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs h-6 pl-1.5 pr-2 sm:pl-2 sm:pr-2 whitespace-nowrap" style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: '#ef444410' }}>
                                Anúncio
                            </Badge>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 shrink-0 px-2 border-l border-border/50">
                        <ChatTagManager
                            chatId={localChat.id}
                            currentTags={localChat.tags || []}
                            organizationId={localChat.organization_id}
                        />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-border/50">
                        <ChatAssignment
                            chatId={localChat.id}
                            assignedTo={localChat.assigned_to}
                            teamId={localChat.team_id}
                            isGroup={localChat.is_group}
                        />

                        {scheduledMessagesCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-amber-600 hover:bg-amber-50 hover:text-amber-700 border-amber-200 h-7 sm:h-8 px-2 sm:px-3 rounded-full"
                                onClick={() => setShowScheduledPanel(!showScheduledPanel)}
                            >
                                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-xs font-semibold">{scheduledMessagesCount}</span>
                            </Button>
                        )}

                        {(localChat.assigned_to || localChat.team_id) && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border-emerald-200 h-7 sm:h-8 px-2 sm:px-3 lg:px-4 rounded-full font-medium transition-all shadow-sm"
                                onClick={openResolveDialog}
                            >
                                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="hidden md:inline">Resolver</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
