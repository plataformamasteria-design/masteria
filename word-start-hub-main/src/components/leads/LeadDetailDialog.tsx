import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Phone, MessageSquare, DollarSign, X, Edit2, Trash2,
  Calendar, CheckSquare, Users, User, ExternalLink, Clock,
  Sparkles, Tag, CheckCircle, History, Repeat, ImageIcon, FolderOpen, Target, Loader2, GitBranch
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import TagPicker from "@/components/pipeline/TagPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadAvatar } from "./LeadAvatar";
import { LeadDetailHeader } from "./detail/LeadDetailHeader";
import { LeadAssignmentCard } from "./detail/LeadAssignmentCard";
import { LeadPurchasesCard } from "./detail/LeadPurchasesCard";
import { LeadTimelineCard } from "./detail/LeadTimelineCard";
import { LeadDetailSkeleton } from "./LeadDetailSkeleton";
import { LeadNameEditor } from "./LeadNameEditor";
import { LeadPhoneEditor } from "./LeadPhoneEditor";
import { DeleteLeadDialog } from "./DeleteLeadDialog";
import { ClearHistoryDialog } from "@/components/chat/ClearHistoryDialog";
import { ResolveDialog, ResolutionOutcome } from "@/components/chat/ResolveDialog";
import { cn } from "@/lib/utils";
import { FollowUpHistory } from "./FollowUpHistory";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatAssignment } from "@/hooks/useChatAssignment";
import { GroupAdminPanel } from "@/components/chat/GroupAdminPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { GroupParticipantsList } from "@/components/chat/GroupParticipantsList";
import { FunnelStageAssignDialog } from "@/components/crm/FunnelStageAssignDialog";
import { LeadMediaGallery } from "./LeadMediaGallery";
import { LeadFolder } from "./LeadFolder";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import AttendanceScoreCard from "@/components/chat/AttendanceScoreCard";
import { LeadQualityBadge } from "./LeadQualityBadge";
import LeadFinancialMetrics from "./LeadFinancialMetrics";

import { Tag as TypeTag, AssignedProfile, AssignedTeam, CalendarEvent, Task, Chat, Transaction, LeadDetailDialogProps } from "./detail/types";

export default function LeadDetailDialog({ open, onOpenChange, chatId }: LeadDetailDialogProps) {
  const navigate = useNavigate();
  const [chat, setChat] = useState<Chat | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [primaryFunnelTag, setPrimaryFunnelTag] = useState<Tag | null>(null);
  const [funnelStages, setFunnelStages] = useState<Array<{ funnel_name: string; stage_name: string; stage_color: string; funnel_id: string; stage_id: string }>>([]);
  const [funnelAssignOpen, setFunnelAssignOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followUpStatus, setFollowUpStatus] = useState<any>(null);
  const [deleteLeadDialogOpen, setDeleteLeadDialogOpen] = useState(false);
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const { toast } = useToast();
  const { resolveChat } = useChatAssignment();
  const { isAdmin } = useUserRole();
  const { canUseAIAutomation } = useModuleAccess();



  const handleResolveChat = async (outcome: ResolutionOutcome, notes?: string, lossReason?: string) => {
    if (!chatId) return;
    await resolveChat(chatId, outcome, notes, lossReason);
    fetchChatDetails();
    fetchPrimaryFunnelTag();
  };

  useEffect(() => {
    if (open && chatId) {
      fetchChatDetails();
      fetchFollowUpStatus();
      fetchCalendarEvents();
      fetchTasks();
      fetchPrimaryFunnelTag();
    }
  }, [open, chatId]);

  const fetchChatDetails = async () => {
    if (!chatId) return;

    try {
      setLoading(true);

      const { data: chatData, error: chatError } = await (supabase as any)
        .from('chats')
        .select(`
          *,
          assigned_profile:profiles!chats_assigned_to_fkey(id, full_name, avatar_url),
          assigned_team:teams!chats_team_id_fkey(id, name),
          chat_tags(
            tag_id,
            tags(id, name, color, order_position)
          )
        `)
        .eq('id', chatId)
        .single();

      if (chatError) throw chatError;

      const transformedChat = {
        ...chatData,
        tags: chatData.chat_tags?.map((ct: any) => ct.tags).filter(Boolean) || []
      };

      setChat(transformedChat);


    } catch (error) {
      console.error('Error fetching chat details:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar detalhes do lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarEvents = async () => {
    if (!chatId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('calendar_events')
        .select(`
          *,
          assigned_profile:profiles!calendar_events_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('chat_id', chatId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setCalendarEvents(data || []);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    }
  };

  const fetchTasks = async () => {
    if (!chatId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('tasks')
        .select(`
          *,
          assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('chat_id', chatId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchPrimaryFunnelTag = async () => {
    if (!chatId) return;

    try {
      // Fetch from chat_funnel_stage with joins
      const { data, error } = await (supabase as any)
        .from("chat_funnel_stage")
        .select(`
          funnel_id,
          stage_id,
          funnels:funnel_id (name),
          funnel_stages:stage_id (name, color)
        `)
        .eq("chat_id", chatId);

      if (error) throw error;

      const mapped = (data || []).map((entry: any) => ({
        funnel_name: entry.funnels?.name || "",
        stage_name: entry.funnel_stages?.name || "",
        stage_color: entry.funnel_stages?.color || "#3B82F6",
        funnel_id: entry.funnel_id,
        stage_id: entry.stage_id,
      }));

      setFunnelStages(mapped);

      // Keep backward compat for the header badge
      if (mapped.length > 0) {
        setPrimaryFunnelTag({
          id: mapped[0].stage_id,
          name: mapped[0].stage_name,
          color: mapped[0].stage_color,
        });
      } else {
        setPrimaryFunnelTag(null);
      }
    } catch (error) {
      console.error("Error fetching funnel stages:", error);
    }
  };

  const fetchFollowUpStatus = async () => {
    if (!chatId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('lead_follow_up_tracking')
        .select(`
          *,
          follow_up_sequences(name)
        `)
        .eq('chat_id', chatId)
        .eq('completed', false)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const { data: stepData } = await (supabase as any)
          .from('follow_up_steps')
          .select('step_number, tags(name)')
          .eq('sequence_id', data.sequence_id)
          .eq('step_number', data.current_step)
          .maybeSingle();

        setFollowUpStatus({
          ...data,
          current_step_info: stepData
        });
      } else {
        setFollowUpStatus(null);
      }
    } catch (error) {
      console.error('Error fetching follow up status:', error);
    }
  };

  const handleToggleBot = async (checked: boolean) => {
    if (!chatId) return;

    try {
      const { error } = await (supabase as any)
        .from('chats')
        .update({ agent_off: !checked })
        .eq('id', chatId);

      if (error) throw error;

      toast({
        title: checked ? "Robô ativado" : "Robô desativado",
        description: `O robô foi ${checked ? 'ativado' : 'desativado'} para este lead`,
      });

      fetchChatDetails();
    } catch (error) {
      console.error('Error toggling bot:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do robô",
        variant: "destructive",
      });
    }
  };







  const handleRemoveTag = async (tagId: string) => {
    if (!chatId) return;

    try {
      const { error } = await (supabase as any)
        .from('chat_tags')
        .delete()
        .eq('chat_id', chatId)
        .eq('tag_id', tagId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Etiqueta removida com sucesso",
      });

      fetchChatDetails();
    } catch (error) {
      console.error('Error removing tag:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover etiqueta",
        variant: "destructive",
      });
    }
  };

  const handleTagsChange = () => {
    fetchChatDetails();
    fetchFollowUpStatus();
    fetchPrimaryFunnelTag();
  };

  const handleGoToChat = () => {
    onOpenChange(false);
    navigate(`/chat?id=${chatId}`);
  };

  if (!chatId) return null;

  const hasClienteTag = chat?.tags.some(tag =>
    tag.name.toLowerCase().includes('cliente')
  ) || false;

  const isGroup = chat?.is_group || false;
  const displayName = isGroup
    ? (chat?.group_name || chat?.phone)
    : (chat?.custom_name || chat?.wa_name || 'Sem nome');
  const photoUrl = isGroup ? chat?.group_photo_url : chat?.wa_photo_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] overflow-hidden flex flex-col p-0">
        {loading ? (
          <div className="p-6">
            <LeadDetailSkeleton />
          </div>
        ) : chat ? (
          <>
            <LeadDetailHeader
              chat={chat}
              chatId={chatId}
              isGroup={isGroup}
              displayName={displayName}
              photoUrl={photoUrl}
              primaryFunnelTag={primaryFunnelTag}
              onGoToChat={handleGoToChat}
              onClearHistory={() => setClearHistoryDialogOpen(true)}
              onDeleteLead={() => setDeleteLeadDialogOpen(true)}
              onChatDetailsRefresh={fetchChatDetails}
            />
            {/* Scrollable Content Area */}
            <ScrollArea className="flex-1 overflow-auto">
              <div className="space-y-6 px-6 py-4 pb-8">
                <LeadAssignmentCard
                  chat={chat}
                  isGroup={isGroup}
                  canUseAIAutomation={canUseAIAutomation}
                  isAdmin={isAdmin}
                  handleToggleBot={handleToggleBot}
                  setResolveDialogOpen={setResolveDialogOpen}
                />
                {/* Funnel Stages Section */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 flex flex-col space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold flex items-center gap-2 text-violet-600">
                      <GitBranch className="h-5 w-5" />
                      Funis
                    </h3>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-[10px] font-bold tracking-wide uppercase px-3 shadow-sm bg-white/70 dark:bg-black/40 text-violet-700 hover:bg-white dark:hover:bg-black/60 dark:text-violet-400"
                      onClick={() => setFunnelAssignOpen(true)}
                    >
                      {funnelStages.length > 0 ? "Alterar" : "Atribuir"}
                    </Button>
                  </div>
                  {funnelStages.length > 0 ? (
                    <div className="space-y-2 flex-1">
                      {funnelStages.map((fs, idx) => (
                        <div key={idx} className="flex flex-col items-start gap-1 p-3 bg-white/60 dark:bg-black/40 border border-violet-500/10 shadow-sm rounded-lg">
                          <div className="flex items-center gap-2 mb-1 w-full">
                            <GitBranch className="w-3.5 h-3.5 text-violet-500" />
                            <p className="text-xs font-bold truncate text-violet-800 dark:text-violet-300">{fs.funnel_name}</p>
                          </div>
                          <div className="flex items-center gap-2 w-full">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white dark:ring-black" style={{ backgroundColor: fs.stage_color }} />
                            <p className="text-xs font-semibold text-foreground truncate">{fs.stage_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <GitBranch className="w-8 h-8 text-violet-500/20 mb-2" />
                      <p className="text-xs font-medium text-muted-foreground">Nenhum status<br />de funil comercial.</p>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary" />
                    Etiquetas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {chat.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        style={{ backgroundColor: tag.color + '20', borderColor: tag.color + '50', color: tag.color }}
                        className="gap-1.5 py-1.5 px-3"
                      >
                        {tag.name}
                        <button
                          className="hover:bg-background/30 rounded-full p-0.5 transition-colors"
                          onClick={() => handleRemoveTag(tag.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <TagPicker
                      chatId={chatId}
                      assignedTags={chat.tags.map(t => t.id)}
                      onTagsChange={handleTagsChange}
                    />
                  </div>
                </div>

                {/* Follow Up Status */}
                {followUpStatus && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-amber-600">
                      <Sparkles className="h-5 w-5" />
                      Follow Up Ativo
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sequência</p>
                        <p className="font-medium">{followUpStatus.follow_up_sequences?.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Etapa Atual</p>
                        <p className="font-medium">{followUpStatus.current_step}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Próximo Envio</p>
                        <p className="font-medium">{new Date(followUpStatus.next_trigger_at).toLocaleString('pt-BR')}</p>
                      </div>
                      {followUpStatus.responded && (
                        <div>
                          <p className="text-muted-foreground">Respondeu na Etapa</p>
                          <p className="font-medium text-green-600">{followUpStatus.responded_at_step}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Media Gallery */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Mídias
                  </h3>
                  <LeadMediaGallery chatId={chatId!} />
                </div>

                {/* Lead Folder */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-orange-600">
                    <FolderOpen className="h-5 w-5" />
                    Pasta do Lead
                  </h3>
                  <LeadFolder chatId={chatId!} />
                </div>

                {/* Follow-Up History */}
                <FollowUpHistory chatId={chatId} />

                {/* Análise IA do Atendimento */}
                <AttendanceScoreCard chatId={chatId!} isResolved={true} />

                {/* Métricas Financeiras do Lead */}
                <LeadFinancialMetrics chatId={chatId!} organizationId={(chat as any)?.organization_id || ""} />

                {/* Calendar Events */}
                <LeadTimelineCard calendarEvents={calendarEvents} tasks={tasks} />


                {/* Tasks */}


                {/* Financial Registration */}
                {hasClienteTag && <LeadPurchasesCard chatId={chatId} onRefresh={fetchChatDetails} />}

              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            Lead não encontrado
          </div>
        )}
      </DialogContent>



      {/* Delete Lead Dialog */}
      <DeleteLeadDialog
        open={deleteLeadDialogOpen}
        onOpenChange={setDeleteLeadDialogOpen}
        chatId={chatId || ""}
        chatName={displayName}
        onDeleted={() => {
          setDeleteLeadDialogOpen(false);
          onOpenChange(false);
          navigate('/leads');
        }}
      />

      {/* Clear History Dialog */}
      <ClearHistoryDialog
        open={clearHistoryDialogOpen}
        onOpenChange={setClearHistoryDialogOpen}
        chatId={chatId || ""}
        chatName={displayName}
        showRemoveOption
        onCleared={(result) => {
          setClearHistoryDialogOpen(false);
          toast({
            title: "Histórico limpo",
            description:
              result?.action === 'remove'
                ? "A conversa foi limpa e movida para Resolvidas."
                : "O histórico de mensagens foi limpo com sucesso",
          });
          if (result?.action === 'remove') {
            // fecha o detalhe para evitar o usuário ficar preso numa conversa que saiu da lista principal
            onOpenChange(false);
          }
        }}
      />

      {/* Dialog de resolução com desfecho + funil */}
      <ResolveDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        onConfirm={handleResolveChat}
        chatName={chat?.custom_name || chat?.wa_name || chat?.phone}
        chatId={chatId || undefined}
      />

      {/* Funnel Stage Assignment Dialog */}
      {chatId && (
        <FunnelStageAssignDialog
          open={funnelAssignOpen}
          onOpenChange={setFunnelAssignOpen}
          chatId={chatId}
          currentFunnelId={funnelStages.length > 0 ? funnelStages[0].funnel_id : null}
          currentStageId={funnelStages.length > 0 ? funnelStages[0].stage_id : null}
          onAssigned={() => {
            fetchPrimaryFunnelTag();
          }}
        />
      )}
    </Dialog>
  );
}