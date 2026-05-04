import React, { useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Send, X, LockKeyhole, Loader2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

interface MessageInputProps {
  messageText: string;
  setMessageText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSending: boolean;
  disabled: boolean;
  replyToMessage?: Message | null;
  onClearReply?: () => void;
  isAssignedToMe?: boolean;
  isConversationAssigned?: boolean;
  assignedUserName?: string | null;
  isAssigning?: boolean;
  onAssignToMe?: () => void;
  actionMenuSlot?: React.ReactNode; 
  placeholder?: string;
}

export function MessageInput({
  messageText,
  setMessageText,
  onSubmit,
  isSending,
  disabled,
  replyToMessage,
  onClearReply,
  isAssignedToMe = true,
  isConversationAssigned = false,
  assignedUserName,
  isAssigning = false,
  onAssignToMe,
  actionMenuSlot,
  placeholder = "Digite sua mensagem..."
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight || '20') || 20;
    const maxRows = 4;
    const maxHeight = lineHeight * maxRows + 16;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [messageText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && !disabled && messageText.trim()) {
        onSubmit(e as any);
      }
    }
  };

  if (!isConversationAssigned && onAssignToMe) {
    return (
      <div className="flex w-full items-center">
        <Button
          type="button"
          disabled={isAssigning}
          onClick={onAssignToMe}
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-3 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 transition-all duration-200"
        >
          {isAssigning ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <LockKeyhole className="h-5 w-5" />
              <span className="font-semibold text-sm">Atribuir a mim para responder</span>
            </>
          )}
        </Button>
      </div>
    );
  }

  if (isConversationAssigned && !isAssignedToMe) {
    return (
      <div className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 bg-amber-500/5 border border-amber-500/15 text-amber-500">
        <LockKeyhole className="h-5 w-5 shrink-0 text-amber-500/60" />
        <span className="font-medium text-sm">Conversa atribuída a {assignedUserName || 'outro agente'}</span>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center pb-2">
      <div className="w-full max-w-4xl relative">
        {replyToMessage && (
          <div className="mb-2 mx-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 shadow-sm backdrop-blur-sm">
            <div className="w-1 self-stretch rounded-full bg-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-0.5 flex justify-between items-center">
                <span>Respondendo a {replyToMessage.senderType === 'USER' ? 'Cliente' : 'Agente'}</span>
              </div>
              <div className="text-xs text-muted-foreground/80 truncate opacity-90">
                {replyToMessage.contentType === 'MEDIA' ? '📎 Arquivo de Mídia' : replyToMessage.content || 'Mensagem'}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full bg-background/50 hover:bg-background/80 shrink-0 text-muted-foreground transition-colors"
              onClick={onClearReply}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-end gap-2 px-1 relative">
          <div className="flex gap-1 shrink-0 pb-1">
            {actionMenuSlot}
          </div>
          
          <div className="relative flex-1 bg-white dark:bg-zinc-900 border border-border/80 shadow-sm rounded-3xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all duration-200">
            <textarea
              ref={textareaRef}
              placeholder={placeholder}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || disabled}
              className="w-full min-h-[46px] max-h-[120px] resize-none border-0 bg-transparent py-3 pl-4 pr-12 text-[14px] leading-relaxed placeholder:text-muted-foreground/50 focus:ring-0 focus-visible:ring-0"
              rows={1}
            />
          </div>

          <Button
            type="submit"
            size="icon"
            className={cn(
              "shrink-0 h-11 w-11 rounded-full transition-all duration-300 pb-0.5 ml-1 flex items-center justify-center shadow-md",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              !messageText.trim() && !isSending && "opacity-50 scale-95"
            )}
            disabled={disabled || (!messageText.trim() && !isSending)}
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
