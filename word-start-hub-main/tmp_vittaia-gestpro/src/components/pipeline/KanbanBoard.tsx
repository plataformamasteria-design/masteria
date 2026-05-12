import { useState, useEffect } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckSquare, MessageSquare, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Chat {
  id: string;
  phone: string;
  wa_name: string | null;
  wa_photo_url: string | null;
  assigned_to: string | null;
  team_id: string | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  tasks?: Array<{ id: string }>;
  campaign_name?: string | null;
  ad_name?: string | null;
}

interface KanbanBoardProps {
  tagOrder: string[];
  tags: Tag[];
}

interface LeadCardProps {
  chat: Chat;
  onClick: () => void;
}

const LeadCard = ({ chat, onClick }: LeadCardProps) => {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chat.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const eventsCount = chat.calendar_events?.length || 0;
  const tasksCount = chat.tasks?.length || 0;

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className="mb-2 cursor-pointer glass border-white/10 hover:border-primary/30 hover:shadow-lg transition-all hover:scale-[1.02]"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        {...attributes}
        {...listeners}
      >
        <CardContent className="p-3">
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9 border-2 border-primary/20">
                <AvatarImage src={chat.wa_photo_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--gradient-primary))] to-[hsl(var(--gradient-primary-end))] text-white text-xs">
                  {chat.wa_name?.[0]?.toUpperCase() || chat.phone[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {(chat.wa_name || "Sem nome").substring(0, 25)}
                </p>
                <p className="text-xs text-muted-foreground truncate">{chat.phone}</p>
              </div>
            </div>

            {/* Assigned User and Team */}
            {(chat.profiles || chat.teams) && (
              <div className="flex flex-col gap-1 text-xs">
                {chat.profiles && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3 w-3" />
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={chat.profiles.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {chat.profiles.full_name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{chat.profiles.full_name || 'Usuário'}</span>
                  </div>
                )}
                {chat.teams && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span className="truncate">{chat.teams.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Origem Ad Tracking */}
            {(chat.campaign_name || chat.ad_name) && (
              <div className="flex flex-wrap gap-1 mt-1 pb-1">
                {chat.campaign_name && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-primary/5 border-primary/20 text-primary truncate max-w-[140px]" title={chat.campaign_name}>
                    C: {chat.campaign_name}
                  </Badge>
                )}
                {chat.ad_name && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 truncate max-w-[140px]" title={chat.ad_name}>
                    A: {chat.ad_name}
                  </Badge>
                )}
              </div>
            )}

            {/* Counters */}
            {(eventsCount > 0 || tasksCount > 0) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {eventsCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{eventsCount}</span>
                  </div>
                )}
                {tasksCount > 0 && (
                  <div className="flex items-center gap-1">
                    <CheckSquare className="h-3 w-3" />
                    <span>{tasksCount}</span>
                  </div>
                )}
              </div>
            )}

            {/* Chat Button */}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-full text-xs"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/chat?id=${chat.id}`);
              }}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Chat
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const KanbanBoard = ({ tagOrder, tags }: KanbanBoardProps) => {
  const [chatsByTag, setChatsByTag] = useState<Record<string, Chat[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [clientValueDialog, setClientValueDialog] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    chatId: string;
    newTagId: string;
  } | null>(null);
  const [clientValue, setClientValue] = useState("");
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchKanbanData();
  }, [tagOrder]);

  const fetchKanbanData = async () => {
    const data: Record<string, Chat[]> = {};

    // Inicializar arrays vazios para cada tag
    for (const tagId of tagOrder) {
      data[tagId] = [];
    }

    if (!currentOrganization?.id) {
      setChatsByTag(data);
      return;
    }

    // Buscar todos os chats com suas tags (filtrado por org)
    const { data: allChatsWithTags, error } = await supabase
      .from('chats')
      .select(`
        id,
        phone,
        wa_name,
        wa_photo_url,
        assigned_to,
        team_id,
        campaign_name,
        ad_name,
        profiles:assigned_to (
          full_name,
          avatar_url
        ),
        teams:team_id (
          name
        ),
        calendar_events(id),
        tasks(id),
        chat_tags!inner (
          tag_id,
          tags (
            id,
            order_position
          )
        )
      `)
      .eq('organization_id', currentOrganization.id);

    if (error) {
      console.error('Error fetching kanban data:', error);
      setChatsByTag(data);
      return;
    }

    // Para cada chat, determinar a tag de maior order_position
    allChatsWithTags?.forEach((chat: any) => {
      const chatTags = chat.chat_tags || [];

      // Filtrar apenas tags que estão no tagOrder atual
      const validTags = chatTags
        .filter((ct: any) => tagOrder.includes(ct.tag_id))
        .map((ct: any) => ({
          tag_id: ct.tag_id,
          order_position: ct.tags?.order_position || 0
        }));

      if (validTags.length === 0) return;

      // Encontrar a tag com maior order_position
      const highestTag = validTags.reduce((prev: any, current: any) =>
        current.order_position > prev.order_position ? current : prev
      );

      // Adicionar chat apenas na coluna da tag de maior posição
      if (data[highestTag.tag_id]) {
        data[highestTag.tag_id].push({
          id: chat.id,
          phone: chat.phone,
          wa_name: chat.wa_name,
          wa_photo_url: chat.wa_photo_url,
          assigned_to: chat.assigned_to,
          team_id: chat.team_id,
          profiles: chat.profiles,
          teams: chat.teams,
          calendar_events: chat.calendar_events,
          tasks: chat.tasks,
          campaign_name: chat.campaign_name,
          ad_name: chat.ad_name,
        });
      }
    });

    setChatsByTag(data);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const chatId = active.id as string;
    const overId = over.id as string;

    // Resolve drop target: over.id might be a card id instead of a tag column id.
    // If it's not a known tag, find which column contains that card.
    let newTagId: string | null = null;
    if (tagOrder.includes(overId)) {
      newTagId = overId;
    } else {
      // overId is a card – find which column it belongs to
      for (const [tagId, chats] of Object.entries(chatsByTag)) {
        if (chats.some((c) => c.id === overId)) {
          newTagId = tagId;
          break;
        }
      }
    }

    if (!newTagId) return;

    // Find current tag
    let currentTagId: string | null = null;
    for (const [tagId, chats] of Object.entries(chatsByTag)) {
      if (chats.some((c) => c.id === chatId)) {
        currentTagId = tagId;
        break;
      }
    }

    if (currentTagId === newTagId) return;

    // Check if moving to "Cliente" tag
    const clientTag = tags.find((t) => t.name.toLowerCase().includes("cliente"));
    if (clientTag && newTagId === clientTag.id) {
      setPendingMove({ chatId, newTagId });
      setClientValueDialog(true);
      return;
    }

    await moveChat(chatId, currentTagId, newTagId);
  };

  const moveChat = async (
    chatId: string,
    oldTagId: string | null,
    newTagId: string,
    value?: number
  ) => {
    // Remove old tag
    if (oldTagId) {
      await supabase.from("chat_tags").delete().eq("chat_id", chatId).eq("tag_id", oldTagId);

      // Follow-up tag removal is handled by DB triggers
    }

    // Add new tag
    if (!currentOrganization?.id) return;

    const { error } = await supabase.from("chat_tags").insert({
      chat_id: chatId,
      tag_id: newTagId,
      organization_id: currentOrganization.id,
    });

    if (error) {
      toast({
        title: "Erro ao mover lead",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Follow-up trigger is handled by DB trigger on chat_tags insert

    // If moving to "Cliente", create client record
    const clientTag = tags.find((t) => t.name.toLowerCase().includes("cliente"));
    if (clientTag && newTagId === clientTag.id && value !== undefined) {
      await supabase.from("clients").insert({
        chat_id: chatId,
        client_value: value,
        organization_id: currentOrganization.id,
      });
    }

    toast({
      title: "Lead movido com sucesso",
    });

    fetchKanbanData();
  };

  const handleClientValueSubmit = async () => {
    if (!pendingMove) return;

    const value = parseFloat(clientValue);
    if (isNaN(value) || value < 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor numérico válido",
        variant: "destructive",
      });
      return;
    }

    let currentTagId: string | null = null;
    for (const [tagId, chats] of Object.entries(chatsByTag)) {
      if (chats.some((c) => c.id === pendingMove.chatId)) {
        currentTagId = tagId;
        break;
      }
    }

    await moveChat(pendingMove.chatId, currentTagId, pendingMove.newTagId, value);

    setClientValueDialog(false);
    setPendingMove(null);
    setClientValue("");
  };

  const activeChat = activeId
    ? Object.values(chatsByTag)
      .flat()
      .find((c) => c.id === activeId)
    : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full overflow-x-auto">
          <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
            {tagOrder.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (!tag) return null;

              const chats = chatsByTag[tagId] || [];

              return (
                <div key={tagId} className="flex-shrink-0 w-80">
                  <Card className="glass border-white/10">
                    <CardContent className="p-4">
                      <div
                        className="flex items-center gap-2 mb-4 pb-3"
                        style={{
                          borderBottom: `2px solid ${tag.color}`,
                        }}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <h3 className="font-semibold text-sm">{tag.name}</h3>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {chats.length}
                        </span>
                      </div>

                      <ScrollArea className="h-[280px]">
                        <SortableContext
                          items={chats.map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {chats.map((chat) => (
                            <LeadCard
                              key={chat.id}
                              chat={chat}
                              onClick={() => setSelectedChatId(chat.id)}
                            />
                          ))}
                        </SortableContext>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeChat ? <LeadCard chat={activeChat} onClick={() => { }} /> : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={clientValueDialog} onOpenChange={setClientValueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valor do Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="client-value">Qual o valor deste cliente?</Label>
              <Input
                id="client-value"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={clientValue}
                onChange={(e) => setClientValue(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setClientValueDialog(false);
                setPendingMove(null);
                setClientValue("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleClientValueSubmit}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadDetailDialog
        open={!!selectedChatId}
        onOpenChange={(open) => !open && setSelectedChatId(null)}
        chatId={selectedChatId}
      />
    </>
  );
};

export default KanbanBoard;
