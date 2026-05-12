import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
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
import { CRMLeadCard, type CRMChat } from "./CRMLeadCard";
import { CRMStageColumn } from "./CRMStageColumn";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Stage {
  id: string;
  name: string;
  color: string;
  order_position: number;
}

interface CRMBoardProps {
  funnelId: string;
  stages: Stage[];
}

export function CRMBoard({ funnelId, stages }: CRMBoardProps) {
  const [chatsByStage, setChatsByStage] = useState<Record<string, CRMChat[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order_position - b.order_position),
    [stages]
  );

  const fetchData = useCallback(async () => {
    const data: Record<string, CRMChat[]> = {};
    for (const stage of sortedStages) data[stage.id] = [];

    if (!currentOrganization?.id || !funnelId) {
      setChatsByStage(data);
      setDataLoading(false);
      return;
    }

    const [entriesRes, automationRes] = await Promise.all([
      (supabase as any)
        .from("chat_funnel_stage")
        .select(`
          stage_id,
          chats:chat_id (
            id, phone, wa_name, wa_photo_url, assigned_to, team_id, custom_name,
            profiles:assigned_to (full_name, avatar_url),
            teams:team_id (name),
            calendar_events(id),
            tasks(id)
          )
        `)
        .eq("funnel_id", funnelId)
        .eq("organization_id", currentOrganization.id),
      (supabase as any)
        .from("automation_executions")
        .select("chat_id")
        .eq("organization_id", currentOrganization.id),
    ]);

    const { data: entries, error } = entriesRes;
    const automatedChatIds = new Set((automationRes.data || []).map((e: any) => e.chat_id));

    if (error) {
      console.error("CRMBoard fetch error:", error);
      setChatsByStage(data);
      setDataLoading(false);
      return;
    }

    entries?.forEach((entry: any) => {
      const chat = entry.chats;
      if (!chat || !data[entry.stage_id]) return;
      data[entry.stage_id].push({
        id: chat.id,
        phone: chat.phone,
        wa_name: chat.wa_name,
        wa_photo_url: chat.wa_photo_url,
        assigned_to: chat.assigned_to,
        team_id: chat.team_id,
        custom_name: chat.custom_name,
        profiles: chat.profiles,
        teams: chat.teams,
        calendar_events: chat.calendar_events,
        tasks: chat.tasks,
        has_automation: automatedChatIds.has(chat.id),
      });
    });

    setChatsByStage(data);
    setDataLoading(false);
  }, [funnelId, currentOrganization?.id, sortedStages]);

  useEffect(() => {
    setDataLoading(true);
    fetchData();
  }, [fetchData]);

  // Realtime with unique channel per funnel
  useEffect(() => {
    if (!currentOrganization?.id) return;
    const channelName = `crm-board-${funnelId}-${currentOrganization.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_funnel_stage", filter: `organization_id=eq.${currentOrganization.id}` },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats", filter: `organization_id=eq.${currentOrganization.id}` },
        () => fetchData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentOrganization?.id, funnelId, fetchData]);

  // Filter chats by search
  const filteredChatsByStage = useMemo(() => {
    if (!searchTerm.trim()) return chatsByStage;
    const term = searchTerm.toLowerCase();
    const filtered: Record<string, CRMChat[]> = {};
    for (const [stageId, chats] of Object.entries(chatsByStage)) {
      filtered[stageId] = chats.filter(c => {
        const name = (c.custom_name || c.wa_name || c.phone || "").toLowerCase();
        return name.includes(term) || c.phone.toLowerCase().includes(term);
      });
    }
    return filtered;
  }, [chatsByStage, searchTerm]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const chatId = active.id as string;
    const overId = over.id as string;

    const stageIds = sortedStages.map(s => s.id);
    let newStageId: string | null = stageIds.includes(overId) ? overId : null;
    if (!newStageId) {
      for (const [stageId, chats] of Object.entries(chatsByStage)) {
        if (chats.some((c) => c.id === overId)) { newStageId = stageId; break; }
      }
    }
    if (!newStageId) return;

    let currentStageId: string | null = null;
    for (const [stageId, chats] of Object.entries(chatsByStage)) {
      if (chats.some((c) => c.id === chatId)) { currentStageId = stageId; break; }
    }
    if (currentStageId === newStageId) return;

    // Optimistic update
    setChatsByStage(prev => {
      const next = { ...prev };
      const chat = next[currentStageId!]?.find(c => c.id === chatId);
      if (!chat) return prev;
      next[currentStageId!] = next[currentStageId!].filter(c => c.id !== chatId);
      next[newStageId!] = [...(next[newStageId!] || []), chat];
      return next;
    });

    await moveChat(chatId, newStageId);
  };

  const moveChat = async (chatId: string, newStageId: string) => {
    if (!currentOrganization?.id) return;

    const { error } = await (supabase as any)
      .from("chat_funnel_stage")
      .upsert(
        {
          chat_id: chatId,
          funnel_id: funnelId,
          stage_id: newStageId,
          organization_id: currentOrganization.id,
          moved_at: new Date().toISOString(),
        },
        { onConflict: "chat_id,funnel_id" }
      );

    if (error) {
      toast({ title: "Erro ao mover lead", description: error.message, variant: "destructive" });
      fetchData();
      return;
    }

    toast({ title: "Lead movido com sucesso" });

    // Disparar o fluxo de automação associado à nova etapa de destino
    try {
      await supabase.functions.invoke("automation-executor", {
        body: {
          trigger_type: "stage_entry",
          chat_id: chatId,
          stage_id: newStageId,
          funnel_id: funnelId,
          organization_id: currentOrganization.id,
        },
      });
    } catch (e) {
      console.error("Falha ao notificar automação sobre entrada na etapa:", e);
    }
  };

  const activeChat = activeId
    ? Object.values(chatsByStage).flat().find((c) => c.id === activeId)
    : null;

  // Total leads count
  const totalLeads = Object.values(chatsByStage).reduce((sum, chats) => sum + chats.length, 0);

  if (dataLoading) {
    return (
      <div className="flex gap-3 h-full">
        {sortedStages.map((stage) => (
          <div key={stage.id} className="w-80 shrink-0 space-y-3">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar lead..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {totalLeads} lead{totalLeads !== 1 ? "s" : ""}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 h-[calc(100%-3rem)] overflow-x-auto pb-4 px-1">
          {sortedStages.map((stage) => (
            <CRMStageColumn
              key={stage.id}
              stage={stage}
              chats={filteredChatsByStage[stage.id] || []}
              onCardClick={(id) => setSelectedChatId(id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeChat ? <CRMLeadCard chat={activeChat} onClick={() => { }} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {selectedChatId && (
        <LeadDetailDialog
          chatId={selectedChatId}
          open={!!selectedChatId}
          onOpenChange={(open) => !open && setSelectedChatId(null)}
        />
      )}
    </>
  );
}
