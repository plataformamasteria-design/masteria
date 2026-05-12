import React, { useEffect, useMemo, useState } from 'react';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LeadAvatar } from './LeadAvatar';
import { LeadInfo } from './LeadInfo';
import { LeadNameEditor } from './LeadNameEditor';
import { LeadPhoneEditor } from './LeadPhoneEditor';
import Toggle from '@/components/Toggle';
import TagPicker from '@/components/pipeline/TagPicker';
import { supabase } from '@/integrations/supabase/client';
import {
  Clock, Calendar, CheckSquare, MessageSquare,
  User, Users, DollarSign, X, Trash2, LayoutGrid, List
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  getParticipantDisplayName,
  getParticipantInitial,
} from '@/lib/group-participants';

type GroupParticipantPreview = {
  id: string;
  participant_phone: string;
  display_name: string | null;
  is_admin: boolean;
};

interface ChatTag {
  tag_id: string;
  tags: {
    id: string;
    name: string;
    color: string;
    order_position?: number | null;
  };
}

interface LeadCardProps {
  chat: {
    id: string;
    phone: string;
    wa_name: string | null;
    wa_photo_url: string | null;
    custom_name?: string | null;
    name_locked?: boolean;
    is_group?: boolean;
    group_name?: string | null;
    group_photo_url?: string | null;
    group_description?: string | null;
    participant_count?: number | null;
    agent_off: boolean;
    last_message_at?: string | null;
    updated_at: string;
    chat_tags?: ChatTag[];
    profiles?: {
      full_name: string | null;
      avatar_url: string | null;
    } | null;
    teams?: {
      name: string;
    } | null;
    calendar_events?: any[];
    tasks?: any[];
    transactions?: any[];
  };
  onToggleBot: (chatId: string, currentState: boolean) => void;
  onRemoveTag: (chatId: string, tagId: string) => void;
  onRefresh: () => void;
  onClick: () => void;
  onNavigateToChat: () => void;
  onDelete?: (chatId: string) => void;
  layout?: 'grid' | 'list';
}

export const LeadCard: React.FC<LeadCardProps> = ({
  chat,
  onToggleBot,
  onRemoveTag,
  onRefresh,
  onClick,
  onNavigateToChat,
  onDelete,
  layout = 'grid',
}) => {
  const isGroup = chat.is_group || false;
  const { canUseAIAutomation } = useModuleAccess();

  const [groupMembers, setGroupMembers] = useState<GroupParticipantPreview[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isGroup) return;
      // Best-effort preview: up to 5 members (admins first)
      const { data, error } = await (supabase as any)
        .from('group_participants')
        .select('id, participant_phone, display_name, is_admin')
        .eq('group_chat_id', chat.id)
        .order('is_admin', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(5);
      if (!mounted) return;
      if (error) return;
      setGroupMembers((data || []) as any);
    };

    run();
    return () => {
      mounted = false;
    };
  }, [chat.id, isGroup]);

  const memberInitials = useMemo(() => {
    return groupMembers.map((m) => getParticipantInitial(m));
  }, [groupMembers]);

  // Get primary funnel tag
  const primaryTag = chat.chat_tags
    ?.filter(ct => ct.tags && ct.tags.order_position !== null)
    .sort((a, b) => (b.tags?.order_position || 0) - (a.tags?.order_position || 0))[0];

  const eventsCount = chat.calendar_events?.length || 0;
  const tasksCount = chat.tasks?.length || 0;
  const transactionsTotal = chat.transactions?.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) || 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden cursor-pointer w-full flex flex-col",
        "bg-gradient-to-br from-card to-card/80",
        "border-border/50 hover:border-primary/50",
        "hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
        "transition-all duration-300",
        "animate-scale-in group",
        isGroup && "border-l-4 border-l-accent",
        layout === 'grid' ? "hover:-translate-y-1 h-full" : "hover:translate-x-1"
      )}
      onClick={onClick}
    >
      {/* Hover glow effect */}
      <div className={cn(
        "absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        isGroup
          ? "bg-gradient-to-br from-accent/20 to-transparent"
          : "bg-gradient-to-br from-primary/15 to-transparent"
      )} />

      <CardContent className={cn("relative z-10 flex flex-col flex-1", layout === 'grid' ? "p-4" : "p-3")}>
        <div className={cn(
          "flex flex-1",
          layout === 'grid' ? "flex-col space-y-3" : "flex-col md:flex-row md:items-center gap-3 md:gap-4"
        )}>
          {/* Header with Avatar and Name */}
          <div className={cn("flex gap-3", layout === 'grid' ? "items-start" : "items-center min-w-[250px] max-w-[320px]")}>
            <LeadAvatar
              isGroup={isGroup}
              photoUrl={isGroup ? chat.group_photo_url : chat.wa_photo_url}
              name={isGroup ? chat.group_name : chat.wa_name}
              participantCount={chat.participant_count}
              size={layout === 'grid' ? "lg" : "md"}
            />

            <div className="flex-1 min-w-0">
              {!isGroup ? (
                <LeadNameEditor
                  chatId={chat.id}
                  customName={chat.custom_name || null}
                  waName={chat.wa_name}
                  phone={chat.phone}
                  nameLocked={chat.name_locked || false}
                  onNameUpdated={onRefresh}
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" /> Grupo
                    </Badge>
                    {typeof chat.participant_count === 'number' && (
                      <span className="text-xs text-muted-foreground">{chat.participant_count} participantes</span>
                    )}
                  </div>

                  {/* WhatsApp-like title line */}
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {chat.group_name || chat.phone}
                    </h3>
                    {chat.group_description && (
                      <p className="text-xs text-muted-foreground truncate">{chat.group_description}</p>
                    )}
                  </div>

                  {/* Participants preview */}
                  {groupMembers.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/20 p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 shrink-0">
                          {groupMembers.map((m, idx) => (
                            <Avatar
                              key={m.id}
                              className={cn(
                                "h-6 w-6 ring-2 ring-background",
                                m.is_admin && "ring-2 ring-primary"
                              )}
                            >
                              <AvatarFallback className="text-[10px]">
                                {memberInitials[idx]}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground truncate">
                            <span className="font-medium">Participantes:</span>{' '}
                            {groupMembers
                              .slice(0, 5)
                              .map((m) => getParticipantDisplayName(m))
                              .filter(Boolean)
                              .join(', ')}
                            {typeof chat.participant_count === 'number' && chat.participant_count > groupMembers.length
                              ? ` +${chat.participant_count - groupMembers.length}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Keep existing LeadInfo for consistency elsewhere (hidden but preserves layout logic) */}
                  <div className="sr-only">
                    <LeadInfo
                      isGroup={isGroup}
                      name={chat.wa_name}
                      phone={chat.phone}
                      groupName={chat.group_name}
                      participantCount={chat.participant_count}
                      customName={chat.custom_name}
                    />
                  </div>
                </div>
              )}

              {!isGroup && (
                <div onClick={(e) => e.stopPropagation()}>
                  <LeadPhoneEditor
                    chatId={chat.id}
                    phone={chat.phone}
                    onPhoneUpdated={onRefresh}
                    size="sm"
                    showIcon={false}
                  />
                </div>
              )}

              {/* Primary Funnel Stage */}
              {primaryTag && (
                <Badge
                  variant="secondary"
                  className="mt-1.5 text-xs shadow-md"
                  style={{
                    backgroundColor: primaryTag.tags.color + "20",
                    borderColor: primaryTag.tags.color + "60",
                    color: primaryTag.tags.color,
                  }}
                >
                  📌 {primaryTag.tags.name}
                </Badge>
              )}
            </div>

            {!isGroup && canUseAIAutomation && layout === 'grid' && (
              <div onClick={(e) => e.stopPropagation()}>
                <Toggle
                  checked={!chat.agent_off}
                  onChange={() => onToggleBot(chat.id, chat.agent_off)}
                />
              </div>
            )}
          </div>

          <div className={cn(
            "flex flex-1 min-w-0",
            layout === 'grid' ? "flex-col gap-3" : "flex-row items-center justify-between gap-4"
          )}>
            <div className={cn(
              "flex",
              layout === 'grid' ? "flex-col gap-3" : "flex-row items-center gap-4 flex-wrap flex-1"
            )}>
              {/* Assigned User and Team */}
              {(chat.profiles || chat.teams) && (
                <div className="flex flex-col gap-1.5 text-sm">
                  {chat.profiles && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={chat.profiles.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {chat.profiles.full_name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">
                        {chat.profiles.full_name || 'Usuário'}
                      </span>
                    </div>
                  )}
                  {chat.teams && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-xs">{chat.teams.name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Counters */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {transactionsTotal > 0 && (
                  <div className="flex items-center gap-1 text-green-600 font-medium">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>R$ {transactionsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {eventsCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{eventsCount}</span>
                  </div>
                )}
                {tasksCount > 0 && (
                  <div className="flex items-center gap-1">
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>{tasksCount}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {chat.chat_tags && chat.chat_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chat.chat_tags.filter(ct => ct.tags).map((ct) => (
                    <Badge
                      key={ct.tag_id}
                      variant="secondary"
                      className="gap-1 text-xs shadow-sm"
                      style={{
                        backgroundColor: ct.tags.color + "15",
                        borderColor: ct.tags.color + "50",
                        color: ct.tags.color,
                      }}
                    >
                      {ct.tags.name}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTag(chat.id, ct.tag_id);
                        }}
                        className="ml-1 hover:bg-background/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

            </div>

            {/* List Mode Toggle */}
            {layout === 'list' && !isGroup && canUseAIAutomation && (
              <div onClick={(e) => e.stopPropagation()} className="shrink-0 mr-2 border-l border-border/50 pl-4 hidden md:block">
                <Toggle
                  checked={!chat.agent_off}
                  onChange={() => onToggleBot(chat.id, chat.agent_off)}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            "flex items-center justify-between",
            layout === 'grid' ? "pt-2 border-t border-border/50 mt-auto" : "shrink-0 gap-3 ml-auto"
          )}>
            {layout === 'grid' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(chat.last_message_at || chat.updated_at), {
                  locale: ptBR,
                  addSuffix: true
                })}
              </p>
            )}
            <div className="flex items-center gap-2 shrink-0">
              {layout === 'list' && (
                <p className="text-[10px] text-muted-foreground flex items-center mr-2 hidden lg:flex shrink-0">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDistanceToNow(new Date(chat.last_message_at || chat.updated_at), { locale: ptBR })}
                </p>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToChat();
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                Chat
              </Button>
              <div onClick={(e) => e.stopPropagation()}>
                <TagPicker
                  chatId={chat.id}
                  assignedTags={chat.chat_tags?.map((ct) => ct.tag_id) || []}
                  onTagsChange={onRefresh}
                />
              </div>
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(chat.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};