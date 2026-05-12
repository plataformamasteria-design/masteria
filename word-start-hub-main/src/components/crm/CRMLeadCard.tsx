import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, User, Calendar, CheckSquare, Workflow, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useGhlMappings } from "@/hooks/use-ghl-mappings";
import { GhlBadge } from "@/components/ui/ghl-badge";
import { usePhoneStore } from "@/store/usePhoneStore";

export interface CRMChat {
  id: string;
  phone: string;
  wa_name: string | null;
  wa_photo_url: string | null;
  assigned_to: string | null;
  team_id: string | null;
  custom_name: string | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  teams?: {
    name: string;
  } | null;
  calendar_events?: Array<{ id: string }>;
  tasks?: Array<{ id: string }>;
  has_automation?: boolean;
}

interface CRMLeadCardProps {
  chat: CRMChat;
  onClick: () => void;
  isDragOverlay?: boolean;
}

export function CRMLeadCard({ chat, onClick, isDragOverlay }: CRMLeadCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chat.id,
  });
  const { isMapped, getGhlId } = useGhlMappings();
  const ghlId = getGhlId(chat.id, "contact");
  const { openPhone } = usePhoneStore();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const displayName = chat.custom_name || chat.wa_name || chat.phone;
  const eventsCount = chat.calendar_events?.length || 0;
  const tasksCount = chat.tasks?.length || 0;

  const cardContent = (
    <div
      className={cn(
        "group rounded-lg border border-border/50 bg-card p-3 cursor-grab active:cursor-grabbing",
        "hover:border-primary/30 hover:shadow-sm transition-all duration-150",
        isDragOverlay && "shadow-lg border-primary/40 rotate-1 scale-105"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Lead Info */}
      <div className="flex items-start gap-2.5 mb-2 overflow-hidden">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={chat.wa_photo_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {displayName[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 mb-0.5 max-w-full">
            <p className="text-sm font-medium truncate leading-tight flex-1">{displayName}</p>
            {ghlId && <GhlBadge ghlId={ghlId} showText={false} className="shrink-0" />}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{chat.phone}</p>
        </div>
      </div>

      {/* Assigned User */}
      {chat.profiles?.full_name && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
          <User className="h-3 w-3" />
          <span className="truncate">{chat.profiles.full_name}</span>
        </div>
      )}

      {/* Footer: counts + chat button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {chat.has_automation && (
            <span className="flex items-center gap-0.5 text-primary" title="Passou por automação">
              <Workflow className="h-3 w-3" />
            </span>
          )}
          {eventsCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" /> {eventsCount}
            </span>
          )}
          {tasksCount > 0 && (
            <span className="flex items-center gap-0.5">
              <CheckSquare className="h-3 w-3" /> {tasksCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {chat.phone && (
            <button
              className="flex items-center gap-1 text-[11px] text-emerald-500 hover:text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                openPhone(chat.phone);
              }}
            >
              <Phone className="h-3 w-3" />
              Ligar
            </button>
          )}
          <button
            className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/chat?id=${chat.id}`);
            }}
          >
            <MessageSquare className="h-3 w-3" />
            Chat
          </button>
        </div>
      </div>
    </div>
  );

  if (isDragOverlay) return cardContent;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-2">
      {cardContent}
    </div>
  );
}
