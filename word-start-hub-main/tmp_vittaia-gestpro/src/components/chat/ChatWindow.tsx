import { MessageListRenderer } from './window/MessageListRenderer';
import { ChatWindowHeader } from './window/ChatWindowHeader';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useChatMessageActions } from "./hooks/useChatMessageActions";
import { useChatScroll } from "./hooks/useChatScroll";
import { useOptimisticMessages } from "./hooks/useOptimisticMessages";
import { useChatSubscriptions } from "./hooks/useChatSubscriptions";

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GhlBadge } from '@/components/ui/ghl-badge';
import { useGhlMappings } from '@/hooks/use-ghl-mappings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Loader2, CheckCircle, ArrowLeft, Clock, History, Facebook, Instagram } from 'lucide-react';
import { ChatWithTags } from '@/hooks/useChatListPaginated';
import { useMessagesPaginated } from '@/hooks/useMessagesPaginated';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChatMeetingsBanner } from './ChatMeetingsBanner';
import { MessageDaySeparator } from './MessageDaySeparator';
import { FileUploader } from './FileUploader';
import { ChatTagManager } from './ChatTagManager';
import { ChatAssignment } from './ChatAssignment';
import { GroupChatHeader } from './GroupChatHeader';
import LeadDetailDialog from '@/components/leads/LeadDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { InternalMessageBubble } from './InternalMessageBubble';
import { SystemMessageBubble } from './SystemMessageBubble';
import { useChatAssignment, ResolutionOutcome } from '@/hooks/useChatAssignment';
import { CommandExecutionProgress } from './CommandExecutionProgress';
import { useSlashCommandExecution } from '@/hooks/useSlashCommandExecution';
import { LeadPhoneEditor } from '@/components/leads/LeadPhoneEditor';
import { DeleteLeadDialog } from '@/components/leads/DeleteLeadDialog';
import { ClearHistoryDialog } from './ClearHistoryDialog';
import { ScheduledMessagesPanel } from './ScheduledMessagesPanel';
import { ResolveDialog } from './ResolveDialog';
import AttendanceScoreCard from './AttendanceScoreCard';
import { FunnelStageAssignDialog } from '@/components/crm/FunnelStageAssignDialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useNavigate } from 'react-router-dom';
import type { Message } from '@/types/message';
import { useToast } from '@/hooks/use-toast';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { parseEdgeFunctionError } from '@/lib/edge-function-error';
import { buildParticipantsMap, ParticipantInfo } from '@/lib/mention-utils';
import { ForwardMessageDialog } from './ForwardMessageDialog';
import { usePinnedMessages } from '@/hooks/usePinnedMessages';
import { PinnedMessagesBanner } from './PinnedMessagesBanner';

interface ChatWindowProps {
  chat: ChatWithTags | null;
  onBack?: () => void;
  onMessageSent?: () => void;
  onChatDeleted?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ chat, onBack, onMessageSent, onChatDeleted }) => {
  const [localChat, setLocalChat] = useState(chat);
  const { currentOrganization } = useOrganization();
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailDialogChatId, setDetailDialogChatId] = useState<string | null>(null);

  const openLeadDetail = useCallback((chatId: string) => {
    setDetailDialogChatId(chatId);
    setDetailDialogOpen(true);
  }, []);

  const {
    messagesByDay,
    loading,
    loadingMore,
    hasMore,
    loadMoreMessages,
  } = useMessagesPaginated(chat?.id || null);

  const { handleOpenGroupSenderLead, handleDeleteForEveryone, handleDeleteForPlatform, handleSendToFolder } = useChatMessageActions({ localChat, currentOrganization, openLeadDetail });
  const { scrollRef, handleScroll, isInitialScroll } = useChatScroll({ messagesByDay, loading, loadingMore, hasMore, loadMoreMessages });
  const { pendingMessages, addPendingMessage, updatePendingMessage, removePendingMessage, hasEquivalentRealMessage, setPendingMessages } = useOptimisticMessages(messagesByDay);

  useChatSubscriptions({ localChat, setLocalChat, currentOrganization });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [funnelAssignOpen, setFunnelAssignOpen] = useState(false);
  const [showScheduledPanel, setShowScheduledPanel] = useState(false);
  const [scheduledMessagesCount, setScheduledMessagesCount] = useState(0);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [groupParticipantsMap, setGroupParticipantsMap] = useState<Map<string, ParticipantInfo>>(new Map());
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const { pinnedMessages, togglePinMessage, isMessagePinned, unpinMessage } = usePinnedMessages(chat?.id || null);
  const { assignToMe, resolveChat } = useChatAssignment();
  const { executionState, cancelExecution } = useSlashCommandExecution(chat?.id || '');
  const { status: whatsAppStatus, checkStatusSilent } = useWhatsAppConnection();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load group participants for mention resolution
  useEffect(() => {
    if (!localChat?.id || !localChat?.is_group) {
      setGroupParticipantsMap(new Map());
      return;
    }

    const loadParticipants = async () => {
      const { data, error } = await supabase
        .from('group_participants')
        .select('participant_jid, participant_phone, display_name')
        .eq('group_chat_id', localChat.id);

      if (error) {
        console.error('[ChatWindow] Error loading group participants:', error);
        return;
      }

      if (data) {
        const map = buildParticipantsMap(data);
        setGroupParticipantsMap(map);
      }
    };

    loadParticipants();

    // Subscribe to changes in group_participants
    const channel = supabase
      .channel(`group-participants:${localChat.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_participants',
          filter: `group_chat_id=eq.${localChat.id}`,
        },
        () => loadParticipants()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [localChat?.id, localChat?.is_group]);

  // Check WhatsApp connection status on mount and periodically
  useEffect(() => {
    if (!currentOrganization?.id) return;

    // Initial check
    checkStatusSilent();

    // Poll every 30 seconds
    const interval = setInterval(() => {
      checkStatusSilent();
    }, 30000);

    return () => clearInterval(interval);
  }, [currentOrganization?.id, checkStatusSilent]);

  // Fetch scheduled messages count
  useEffect(() => {
    if (!chat?.id || !currentOrganization?.id) {
      setScheduledMessagesCount(0);
      return;
    }

    const fetchCount = async () => {
      const { count } = await supabase
        .from('scheduled_messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .eq('organization_id', currentOrganization.id)
        .is('sent_at', null)
        .is('cancelled_at', null);

      setScheduledMessagesCount(count || 0);
    };

    fetchCount();

    // Subscribe to changes
    const channel = supabase
      .channel(`scheduled-messages:${chat.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_messages',
          filter: `chat_id=eq.${chat.id}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat?.id, currentOrganization?.id]);

  const { getGhlId } = useGhlMappings();
  const ghlId = localChat?.id ? getGhlId(localChat.id, "contact") : undefined;

  // Sincroniza o chat atual sem resetar a interação
  useEffect(() => {
    setLocalChat(chat);
  }, [chat]);

  // Limpa estados apenas ao TROCAR de chat efetivamente
  useEffect(() => {
    isInitialScroll.current = true;
    // Reset pendings when switching chat
    setPendingMessages([]);
    setReplyToMessage(null);
    setEditingMessage(null);
    // Default detail dialog to current chat when switching
    setDetailDialogChatId(chat?.id ?? null);
  }, [chat?.id]);





  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
    setEditingMessage(null);
  }, []);

  const handleForward = useCallback((message: Message) => {
    setForwardMessage(message);
  }, []);

  const handlePinMessage = useCallback((message: Message) => {
    togglePinMessage(message.id);
  }, [togglePinMessage]);

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight briefly
      el.classList.add('ring-2', 'ring-primary/50', 'rounded-lg');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/50', 'rounded-lg'), 2000);
    }
  }, []);

  const handleEdit = useCallback((message: Message) => {
    setEditingMessage(message);
    setReplyToMessage(null);
  }, []);

  const handleReact = useCallback(async (message: Message, emoji: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('message-actions', {
        body: {
          action: 'reactMessage',
          messageId: message.id,
          newText: emoji,
        },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);
    } catch (err) {
      console.error('Error sending reaction:', err);
      const apiErrorStr = err?.message || (err as any)?.error?.message || (err as any)?.error;
      toast({
        title: "Erro na Reação",
        description: apiErrorStr || "Não foi possível enviar a reação para o Evolution.",
        variant: "destructive"
      });
    }
  }, [toast]);





















  // Handle scroll to load more messages


  // Listener para atualizações de tags em tempo real
  useEffect(() => {
    if (!chat?.id) return;

    const handleTagsUpdate = (event: any) => {
      const { chatId, tags } = event.detail;
      if (chatId === chat.id) {
        setLocalChat(prev => prev ? { ...prev, tags } : prev);
      }
    };

    window.addEventListener('chat-tags-updated', handleTagsUpdate);

    return () => {
      window.removeEventListener('chat-tags-updated', handleTagsUpdate);
    };
  }, [chat?.id]);



  const handleResolveChat = async (outcome: ResolutionOutcome, notes?: string, lossReason?: string) => {
    if (!localChat?.id) return;
    await resolveChat(localChat.id, outcome, notes, lossReason);
  };

  const openResolveDialog = () => {
    setResolveDialogOpen(true);
  };

  const handleDeleteComplete = () => {
    setDeleteDialogOpen(false);
    if (onChatDeleted) {
      onChatDeleted();
    } else if (onBack) {
      onBack();
    } else {
      navigate('/chat');
    }
  };

  const handleClearHistoryComplete = (result?: { action: 'keep' | 'remove' }) => {
    setClearHistoryDialogOpen(false);
    if (result?.action === 'remove') {
      // Remove from current list (goes to "Resolvidas")
      if (onBack) onBack();
      else navigate('/chat');
      return;
    }
    // For "keep", the realtime subscription will pick up the changes automatically
    // No need to reload the entire page
  };

  if (!localChat) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center p-4">
          {onBack && (
            <Button variant="ghost" onClick={onBack} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}
          <p className="text-muted-foreground">
            Selecione uma conversa para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header - Diferenciado para grupos */}
      {localChat.is_group ? (
        <GroupChatHeader
          chat={localChat}
          onOpenDetail={() => openLeadDetail(localChat.id)}
          onClearHistory={() => setClearHistoryDialogOpen(true)}
        />
      ) : (
        <ChatWindowHeader
          localChat={localChat}
          onBack={onBack}
          ghlId={ghlId}
          setDetailDialogOpen={setDetailDialogOpen}
          setLocalChat={setLocalChat}
          scheduledMessagesCount={scheduledMessagesCount}
          showScheduledPanel={showScheduledPanel}
          setShowScheduledPanel={setShowScheduledPanel}
          openResolveDialog={openResolveDialog}
        />
      )}

      {/* Dialog do Lead */}
      <LeadDetailDialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) setDetailDialogChatId(localChat.id);
        }}
        chatId={detailDialogChatId || localChat.id}
      />

      {/* Painel de mensagens agendadas */}
      {showScheduledPanel && (
        <ScheduledMessagesPanel
          chatId={localChat.id}
          onClose={() => setShowScheduledPanel(false)}
        />
      )}

      {/* Banner de mensagens fixadas */}
      <PinnedMessagesBanner
        pinnedMessages={pinnedMessages}
        onScrollToMessage={handleScrollToMessage}
        onUnpin={unpinMessage}
      />

      <div className="relative flex-1 min-h-0 flex flex-col">
        {/* Absolute wrapper for banners to float over the messages container */}
        <div className="absolute top-2 left-0 right-0 z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <ChatMeetingsBanner
              chatId={localChat.id}
              organizationId={(localChat as any).organization_id || currentOrganization?.id || ''}
            />
          </div>
        </div>

        {/* Área de mensagens */}
        <MessageListRenderer
          scrollRef={scrollRef}
          handleScroll={handleScroll}
          loading={loading}
          messagesByDay={messagesByDay}
          loadingMore={loadingMore}
          hasMore={hasMore}
          loadMoreMessages={loadMoreMessages}
          localChat={localChat}
          handleReply={handleReply}
          handleEdit={handleEdit}
          handleDeleteForEveryone={handleDeleteForEveryone}
          handleDeleteForPlatform={handleDeleteForPlatform}
          handleOpenGroupSenderLead={handleOpenGroupSenderLead}
          handleSendToFolder={handleSendToFolder}
          handleForward={handleForward}
          handlePinMessage={handlePinMessage}
          isMessagePinned={isMessagePinned}
          groupParticipantsMap={localChat?.is_group ? groupParticipantsMap : undefined}
          pendingMessages={pendingMessages}
          hasEquivalentRealMessage={hasEquivalentRealMessage}
          handleReact={handleReact}
        />
      </div>



      {/* Barra de progresso de execução de comando */}
      {executionState && (
        <div className="px-4 py-2 border-t border-border bg-card">
          <CommandExecutionProgress
            commandName={executionState.commandName}
            currentStep={executionState.currentStep}
            totalSteps={executionState.totalSteps}
            onCancel={cancelExecution}
          />
        </div>
      )}

      {/* Input de mensagem com toggle */}
      <MessageInput
        chatId={localChat.id}
        onFilePick={() => setFileDialogOpen(true)}
        assignedTo={localChat.assigned_to}
        onAssignToMe={() => assignToMe(localChat.id)}
        onMessageSent={onMessageSent}
        onOptimisticMessage={addPendingMessage}
        onOptimisticUpdate={updatePendingMessage}
        onOptimisticResolve={removePendingMessage}
        replyToMessage={replyToMessage}
        onClearReply={() => setReplyToMessage(null)}
        editingMessage={editingMessage}
        onClearEditing={() => setEditingMessage(null)}
        isWhatsAppConnected={
          (localChat as any).channel === 'facebook' || (localChat as any).channel === 'instagram'
            ? true
            : whatsAppStatus.connected
        }
        isGroupChat={localChat.is_group}
      />

      {/* Dialog de upload */}
      <FileUploader
        open={fileDialogOpen}
        onOpenChange={setFileDialogOpen}
        chatId={localChat.id}
        onOptimisticMessage={addPendingMessage}
        onOptimisticUpdate={updatePendingMessage}
        onOptimisticResolve={removePendingMessage}
        replyToMessage={replyToMessage}
        onClearReply={() => setReplyToMessage(null)}
        isWhatsAppConnected={
          (localChat as any).channel === 'facebook' || (localChat as any).channel === 'instagram'
            ? true
            : whatsAppStatus.connected
        }
      />

      {/* Dialog de excluir lead */}
      <DeleteLeadDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        chatId={localChat.id}
        chatName={(localChat as any).custom_name || localChat.wa_name || localChat.phone}
        onDeleted={handleDeleteComplete}
      />

      {/* Dialog de limpar histórico */}
      <ClearHistoryDialog
        open={clearHistoryDialogOpen}
        onOpenChange={setClearHistoryDialogOpen}
        chatId={localChat.id}
        chatName={(localChat as any).custom_name || localChat.wa_name || localChat.phone}
        onCleared={handleClearHistoryComplete}
        showRemoveOption
      />

      {/* Análise IA do Atendimento — visível quando chat resolvido */}
      {localChat.resolved_at && (
        <div className="px-3 py-2 border-t border-border/50">
          <AttendanceScoreCard chatId={localChat.id} isResolved={true} />
        </div>
      )}

      {/* Dialog de resolução com desfecho + funil */}
      <ResolveDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        onConfirm={handleResolveChat}
        chatName={(localChat as any).custom_name || localChat.wa_name || localChat.phone}
        chatId={localChat.id}
      />

      {/* Dialog de Funil do Header */}
      <FunnelStageAssignDialog
        open={funnelAssignOpen}
        onOpenChange={setFunnelAssignOpen}
        chatId={localChat.id}
      />

      {/* Dialog de encaminhar mensagem */}
      <ForwardMessageDialog
        open={!!forwardMessage}
        onOpenChange={(open) => { if (!open) setForwardMessage(null); }}
        message={forwardMessage}
        currentChatId={localChat.id}
      />
    </div>
  );
};
