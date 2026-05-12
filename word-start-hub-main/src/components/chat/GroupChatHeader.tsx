import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Info, History } from 'lucide-react';
import { ChatWithTags } from '@/hooks/useChatList';
import { ChatTagManager } from './ChatTagManager';
import { ChatAssignment } from './ChatAssignment';
import { cn } from '@/lib/utils';

interface GroupChatHeaderProps {
  chat: ChatWithTags;
  onOpenDetail: () => void;
  onClearHistory?: () => void;
}

export const GroupChatHeader: React.FC<GroupChatHeaderProps> = ({ chat, onOpenDetail, onClearHistory }) => {
  return (
    <div className="border-b border-border bg-gradient-to-r from-green-500/5 to-emerald-500/5 p-4">
      <div 
        className="flex items-center gap-4 cursor-pointer hover:bg-green-500/5 transition-all duration-300 rounded-xl p-3 -m-3"
        onClick={onOpenDetail}
      >
        {/* Avatar do Grupo */}
        <div className="relative">
          <Avatar className="h-14 w-14 ring-2 ring-green-500/30 shadow-lg">
            <AvatarImage src={chat.group_photo_url || undefined} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-green-500/30 to-emerald-500/30">
              <Users className="h-7 w-7 text-green-600" />
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center ring-2 ring-background">
            <Users className="h-3 w-3 text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Nome do Grupo */}
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold text-lg text-foreground truncate">
              {chat.group_name || chat.phone}
            </h2>
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30 shrink-0">
              <Users className="h-3 w-3 mr-1" />
              Grupo
            </Badge>
          </div>
          
          {/* Info de participantes e descrição */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span className="font-medium">{chat.participant_count || 0} participantes</span>
            </div>
            {chat.group_description && (
              <>
                <span className="text-border">•</span>
                <div className="flex items-center gap-1 truncate max-w-[250px]">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{chat.group_description}</span>
                </div>
              </>
            )}
          </div>

          {/* Tags Preview */}
          {chat.tags && chat.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {chat.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs py-0 px-2"
                  style={{
                    borderColor: tag.color + '50',
                    color: tag.color,
                    backgroundColor: tag.color + '10',
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
              {chat.tags.length > 3 && (
                <Badge variant="outline" className="text-xs py-0 px-2">
                  +{chat.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div 
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ChatAssignment
            chatId={chat.id}
            assignedTo={chat.assigned_to}
            teamId={chat.team_id}
            isGroup={true}
          />
          <ChatTagManager
            chatId={chat.id}
            currentTags={chat.tags || []}
          />
          {onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              title="Limpar conversa"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background",
                "hover:bg-accent hover:text-accent-foreground transition-colors"
              )}
            >
              <History className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};