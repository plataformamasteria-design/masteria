import { useMessageSender } from './hooks/useMessageSender';
import { AudioRecorderUI } from './input/AudioRecorderUI';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Lock, LockKeyhole, Mic, Square, X, Play, Loader2, Clock, WifiOff, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWebhooks } from "@/hooks/useWebhooks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { SlashCommandPicker } from "./SlashCommandPicker";
import { MentionPicker } from "./MentionPicker";
import { CommandExecutionProgress } from "./CommandExecutionProgress";
import { useSlashCommandExecution } from "@/hooks/useSlashCommandExecution";
import { AttachmentMenu } from "./AttachmentMenu";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";
import { EventDialog } from "@/components/agenda/EventDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Message } from "@/types/message";


interface MessageInputProps {
  chatId: string;
  onFilePick: () => void;
  assignedTo?: string;
  onAssignToMe: () => void;
  onMessageSent?: () => void;
  onOptimisticMessage?: (message: any) => void;
  onOptimisticUpdate?: (tempId: string, patch: Partial<any>) => void;
  onOptimisticResolve?: (tempId: string) => void;
  replyToMessage?: Message | null;
  onClearReply?: () => void;
  editingMessage?: Message | null;
  onClearEditing?: () => void;
  isWhatsAppConnected?: boolean;
  isGroupChat?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  chatId,
  onFilePick,
  assignedTo,
  onAssignToMe,
  onMessageSent,
  onOptimisticMessage,
  onOptimisticUpdate,
  onOptimisticResolve,
  replyToMessage,
  onClearReply,
  editingMessage,
  onClearEditing,
  isWhatsAppConnected = true,
  isGroupChat = false,
}) => {
  const [message, setMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [currentDate] = useState(() => new Date());
  const { toast } = useToast();
  const { webhooks } = useWebhooks('sent');
  const { user } = useCurrentUser();
  const { executionState, executeCommand, cancelExecution, isExecuting } = useSlashCommandExecution(chatId);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    isRecording,
    recordingTime,
    hasRecordedAudio,
    audioUrl,
    isSending: isSendingAudio,
    formatTime,
    startRecording,
    stopRecording,
    cancelRecording,
    sendAudio,
  } = useAudioRecorder({ chatId });

  // Auto-resize textarea up to maxRows (default: 3)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset first so shrink works
    el.style.height = 'auto';

    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight || '20') || 20;
    const paddingTop = Number.parseFloat(style.paddingTop || '0') || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom || '0') || 0;
    const maxRows = 3;
    const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom;

    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;

    // When exceeding maxRows, allow internal scroll; otherwise hide
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [message, isInternalNote, isRecording, hasRecordedAudio, isExecuting]);

  // Verificar se o chat está atribuído ao usuário atual
  const isAssignedToMe = assignedTo === user?.id;
  const isChatLocked = !isAssignedToMe;

  const { handleSend } = useMessageSender({
    chatId,
    message,
    setMessage,
    isInternalNote,
    setIsInternalNote,
    replyToMessage,
    editingMessage,
    onClearEditing,
    onClearReply,
    onMessageSent,
    onOptimisticMessage,
    onOptimisticUpdate,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommandPicker) return; // Let picker handle keyboard
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);

    // Show command picker when typing "/"
    if (value.startsWith('/') && !isInternalNote) {
      setShowCommandPicker(true);
      setShowMentionPicker(false);
    } else {
      setShowCommandPicker(false);
    }

    // Show mention picker when typing "@" in group chats
    if (isGroupChat && !isInternalNote) {
      // Find the last @ in the message to determine if we're in a mention context
      const lastAtIndex = value.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // Check if there's a space before the @, or if it's at the start
        const charBefore = lastAtIndex > 0 ? value[lastAtIndex - 1] : ' ';
        if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
          // Extract the filter text after @
          const afterAt = value.slice(lastAtIndex + 1);
          // Only show picker if we're still typing the mention (no space after)
          if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
            setShowMentionPicker(true);
            setMentionFilter(afterAt);
          } else {
            setShowMentionPicker(false);
          }
        } else {
          setShowMentionPicker(false);
        }
      } else {
        setShowMentionPicker(false);
      }
    } else {
      setShowMentionPicker(false);
    }
  };

  const handleSelectMention = (participant: { id: string; phone: string; jid: string; name: string | null; isAdmin: boolean }) => {
    setShowMentionPicker(false);

    // Find the last @ in the message and replace from there
    const lastAtIndex = message.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const beforeAt = message.slice(0, lastAtIndex);
      // Prioritize real phone number for better readability in the input
      // Phone numbers are easier to read than anonymous LID tokens
      // The backend will resolve the full JID from either format
      const mentionToken = participant.phone && participant.phone.length >= 10
        ? participant.phone  // Use real phone: more legible for the user
        : participant.jid.split('@')[0];  // Fallback to JID token if no phone
      const mentionText = `@${mentionToken} `;
      setMessage(beforeAt + mentionText);
    }
  };

  const handleSelectCommand = async (command: { id: string; name: string; shortcut: string; delay_seconds: number }) => {
    setShowCommandPicker(false);
    setMessage('');
    await executeCommand(command.id, command.name, command.shortcut, command.delay_seconds);
  };

  // Se WhatsApp desconectado, mostrar mensagem de bloqueio
  if (!isWhatsAppConnected) {
    return (
      <div className="border-t border-border bg-card p-3">
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg p-6 bg-destructive/5 border border-dashed border-destructive/30">
          <div className="flex items-center gap-2 text-destructive">
            <WifiOff className="h-5 w-5" />
            <p className="text-sm font-medium">WhatsApp desconectado</p>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Para enviar mensagens, conecte seu número do WhatsApp clicando no ícone de conexão no topo da página.
          </p>
        </div>
      </div>
    );
  }

  // Se chat travado, mostrar UI de atribuição
  if (isChatLocked) {
    return (
      <div className="border-t border-border bg-card px-3 py-2">
        <div className="flex items-center justify-center gap-2 sm:gap-3 rounded-lg px-3 py-2 sm:py-3 bg-muted/50 border border-dashed border-border">
          <LockKeyhole className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs sm:text-sm text-muted-foreground">Para responder este lead, atribua a conversa para você</p>
          <Button
            onClick={onAssignToMe}
            size="sm"
            className="bg-primary hover:bg-primary/90 shrink-0 h-8 text-xs sm:text-sm"
          >
            <LockKeyhole className="h-3.5 w-3.5 mr-1.5" />
            Atribuir para mim e responder
          </Button>
        </div>
      </div>
    );
  }

  // Determinar o que o botão de enviar deve fazer
  const handleUnifiedSend = () => {
    if (hasRecordedAudio) {
      sendAudio();
    } else if (message.trim()) {
      handleSend();
    }
  };

  const canSend = hasRecordedAudio || message.trim();
  const isAnySending = isSendingAudio;

  return (
    <div className="border-t border-border bg-card p-2 sm:p-3">
      {(replyToMessage || editingMessage) && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground">
              {editingMessage ? 'Editando mensagem' : 'Respondendo'}
            </div>
            {!editingMessage && replyToMessage && (
              <div className="text-xs text-muted-foreground truncate">
                {(replyToMessage.content && String(replyToMessage.content)) || replyToMessage.file_name || 'Mensagem citada'}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              if (editingMessage) {
                onClearEditing?.();
                setMessage('');
              }
              if (replyToMessage) onClearReply?.();
            }}
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className={cn(
        "flex items-center gap-1.5 sm:gap-2 rounded-lg p-1.5 sm:p-2 transition-colors",
        isInternalNote
          ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
          : "bg-muted"
      )}>
        {/* Botão de nota interna */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsInternalNote(!isInternalNote)}
          className={cn(
            "shrink-0 h-8 w-8",
            isInternalNote
              ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isInternalNote ? "Modo: Nota Interna" : "Modo: Mensagem Normal"}
        >
          <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        {/* Menu de anexos e agendar mensagem */}
        {!isInternalNote && !isRecording && !hasRecordedAudio && (
          <>
            <AttachmentMenu chatId={chatId} onDocumentPick={onFilePick} />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setMeetingDialogOpen(true)}
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-emerald-500"
                  >
                    <CalendarPlus className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Agendar Reunião (Agenda)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Botão de agendar mensagem */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setScheduleDialogOpen(true)}
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-amber-600"
                  >
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Agendar mensagem
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* Área central - Textarea ou Estado de Gravação */}
        <AudioRecorderUI
          isRecording={isRecording}
          hasRecordedAudio={hasRecordedAudio}
          recordingTime={recordingTime}
          formatTime={formatTime}
          audioUrl={audioUrl}
          cancelRecording={cancelRecording}
        />
        {!isRecording && !hasRecordedAudio && (
          // Estado: Normal - textarea
          <div className="flex-1 relative">
            <SlashCommandPicker
              filter={message}
              visible={showCommandPicker}
              onSelect={handleSelectCommand}
              onClose={() => setShowCommandPicker(false)}
            />
            {isGroupChat && (
              <MentionPicker
                filter={mentionFilter}
                chatId={chatId}
                visible={showMentionPicker}
                onSelect={handleSelectMention}
                onClose={() => setShowMentionPicker(false)}
              />
            )}
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isInternalNote ? "Adicionar nota interna..." : (isGroupChat ? "Digite @ para mencionar ou / para comandos" : "Digite / para comandos ou uma mensagem")}
              className={cn(
                "min-h-[36px] max-h-[84px] resize-none border-0 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground text-sm leading-5",
                isInternalNote ? "text-foreground" : "text-foreground"
              )}
              rows={1}
              disabled={isExecuting}
            />
          </div>
        )}

        {/* Botão de microfone (inicia gravação) ou para gravação */}
        {!isInternalNote && !hasRecordedAudio && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSendingAudio}
            className={cn(
              "shrink-0 h-8 w-8",
              isRecording
                ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            {isRecording ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>
        )}

        {/* Botão unificado de enviar (texto ou áudio) */}
        <Button
          type="button"
          size="icon"
          onClick={handleUnifiedSend}
          disabled={!canSend || isExecuting}
          className={cn(
            "shrink-0 h-8 w-8",
            isInternalNote
              ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {isAnySending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isInternalNote ? (
            <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>
      </div>

      {/* Dialog de agendar mensagem */}
      <ScheduleMessageDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        chatId={chatId}
      />

      {/* Dialog de agendar reunião nativa do CRM */}
      {meetingDialogOpen && (
        <EventDialog
          open={meetingDialogOpen}
          onOpenChange={setMeetingDialogOpen}
          selectedDate={currentDate}
          defaultChatId={chatId}
          defaultAssignedTo={assignedTo}
          onEventSaved={() => {
            setMeetingDialogOpen(false);
            toast({ title: "Sucesso!", description: "Reunião computada na Agenda e no Diagnóstico." });
          }}
        />
      )}
    </div>
  );
};
