import { Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScheduledMessageBadgeProps {
  scheduledFor: string;
  content: string;
  onClick?: () => void;
  compact?: boolean;
}

export function ScheduledMessageBadge({ 
  scheduledFor, 
  content, 
  onClick,
  compact = false 
}: ScheduledMessageBadgeProps) {
  const date = new Date(scheduledFor);
  const isToday = date.toDateString() === new Date().toDateString();
  
  const formattedTime = format(date, 'HH:mm');
  const formattedDate = isToday 
    ? `Hoje ${formattedTime}` 
    : format(date, "dd/MM 'às' HH:mm", { locale: ptBR });

  const truncatedContent = content.length > 50 
    ? content.substring(0, 50) + "..." 
    : content;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
              "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
              "hover:bg-amber-200 dark:hover:bg-amber-900/50",
              onClick && "cursor-pointer"
            )}
          >
            <Clock className="h-3 w-3" />
            {compact ? formattedTime : formattedDate}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px]">
          <div className="space-y-1">
            <p className="font-medium text-xs">Mensagem agendada</p>
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
            <p className="text-xs italic">"{truncatedContent}"</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
