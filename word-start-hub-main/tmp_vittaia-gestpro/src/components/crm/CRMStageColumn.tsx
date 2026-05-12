import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CRMLeadCard, type CRMChat } from "./CRMLeadCard";

interface Stage {
  id: string;
  name: string;
  color: string;
  order_position: number;
}

interface CRMStageColumnProps {
  stage: Stage;
  chats: CRMChat[];
  onCardClick: (chatId: string) => void;
}

export function CRMStageColumn({ stage, chats, onCardClick }: CRMStageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex-shrink-0 w-80 flex flex-col h-full overflow-hidden">
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 mb-2">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <span className="text-sm font-semibold truncate">{stage.name}</span>
        <span className="ml-auto text-xs text-muted-foreground font-medium bg-muted/60 px-1.5 py-0.5 rounded-md">
          {chats.length}
        </span>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 rounded-lg transition-colors ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : ""
        }`}
      >
        <ScrollArea className="h-full">
          <div className="px-1 pb-4 min-h-[60px]">
            <SortableContext
              items={chats.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {chats.length === 0 && (
                <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50 border border-dashed border-border/40 rounded-lg">
                  Sem leads
                </div>
              )}
              {chats.map((chat) => (
                <CRMLeadCard
                  key={chat.id}
                  chat={chat}
                  onClick={() => onCardClick(chat.id)}
                />
              ))}
            </SortableContext>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
