import React, { useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/types/message";

interface FileUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  onOptimisticMessage?: (message: any) => void;
  onOptimisticUpdate?: (tempId: string, patch: Partial<any>) => void;
  onOptimisticResolve?: (tempId: string) => void;
  replyToMessage?: Message | null;
  onClearReply?: () => void;
  isWhatsAppConnected?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  open,
  onOpenChange,
  chatId,
  onOptimisticMessage,
  onOptimisticUpdate,
  onOptimisticResolve,
  replyToMessage,
  onClearReply,
  isWhatsAppConnected = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const createTempId = () => {
    try {
      return `temp-${crypto.randomUUID()}`;
    } catch {
      return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  };

  // Quando open muda para true, abre o seletor de arquivos (se WhatsApp conectado)
  useEffect(() => {
    if (open && fileInputRef.current) {
      if (!isWhatsAppConnected) {
        toast({
          title: "WhatsApp desconectado",
          description: "Para enviar arquivos, conecte seu número do WhatsApp.",
          variant: "destructive",
        });
        onOpenChange(false);
        return;
      }
      fileInputRef.current.click();
    }
  }, [open, isWhatsAppConnected, toast, onOpenChange]);

  const getMessageType = (fileType: string): string => {
    if (fileType.startsWith("image/")) return "image";
    if (fileType.startsWith("audio/")) return "audio";
    if (fileType === "application/pdf") return "pdf";
    if (fileType.startsWith("video/")) return "video";
    return "document";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      onOpenChange(false);
      return;
    }

    const tempId = createTempId();
    const messageType = getMessageType(file.type);
    const localPreviewUrl = URL.createObjectURL(file);

    onOptimisticMessage?.({
      id: tempId,
      chat_id: chatId,
      content: null,
      message_type: messageType,
      file_url: localPreviewUrl,
      file_name: file.name,
      file_size: file.size,
      is_from_user: true,
      created_at: new Date().toISOString(),
      delivered_at: null,
      read_at: null,
      private: false,
      optimistic_status: "sending",
    });

    try {
      // Upload do arquivo
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${chatId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("chat-files").upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const {
        data: { publicUrl },
      } = supabase.storage.from("chat-files").getPublicUrl(filePath);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar organization_id do CHAT
      const { data: chatData, error: chatOrgError } = await supabase
        .from('chats')
        .select('organization_id, phone')
        .eq('id', chatId)
        .single();

      if (chatOrgError || !chatData?.organization_id) {
        throw new Error('Não foi possível buscar dados do chat');
      }

      const organizationId = chatData.organization_id;

      // Resolve quoted external id (if replying)
      let quotedExternalId: string | null = null;
      if (replyToMessage) {
        quotedExternalId = (replyToMessage as any).external_message_id ?? null;
        if (!quotedExternalId) {
          const { data: qData, error: qErr } = await supabase
            .from('messages')
            .select('external_message_id')
            .eq('id', replyToMessage.id)
            .single();
          if (qErr) {
            console.error('[FileUploader] Error resolving quoted external_message_id:', qErr);
          }
          quotedExternalId = (qData?.external_message_id ?? null) as string | null;
        }

        if (!quotedExternalId) {
          toast({
            title: 'Aguarde confirmar',
            description: 'A mensagem citada ainda não foi confirmada no WhatsApp. Tente novamente em alguns segundos.',
            variant: 'destructive',
          });
          onOptimisticUpdate?.(tempId, { optimistic_status: 'error' });
          return;
        }
      }
      
      // Criar mensagem
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert([{
          chat_id: chatId,
          organization_id: organizationId,
          content: null,
          message_type: messageType,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          sent_by: user.id,
          is_from_user: true,
          sent_from_platform: true, // Mark as platform message to trigger webhooks
          ...(replyToMessage
            ? {
                quoted_message_id: replyToMessage.id,
                quoted_external_message_id: quotedExternalId,
                quoted_preview: {
                  text:
                    (replyToMessage.content && String(replyToMessage.content).slice(0, 200)) ||
                    replyToMessage.file_name ||
                    'Mensagem citada',
                },
              }
            : {}),
        }])
        .select()
        .single();

      if (messageError) throw messageError;

      // Mark optimistic as "sent" and swap preview URL to the final public URL.
      // ChatWindow will reconcile once the realtime message appears.
      onOptimisticUpdate?.(tempId, {
        optimistic_status: undefined,
        file_url: publicUrl,
      });

      // Chamar edge function para disparar webhooks
      console.log('[FileUploader] Triggering sent webhooks for message:', messageData.id);
      const { error: webhookError } = await supabase.functions.invoke('trigger-sent-webhooks', {
        body: { messageId: messageData.id }
      });

      if (webhookError) {
        console.error('[FileUploader] Error triggering webhooks:', webhookError);
        // Não bloquear o fluxo, a mensagem já foi salva
      }

      onClearReply?.();

    } catch (error) {
      console.error("Erro ao enviar arquivo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o arquivo",
        variant: "destructive",
      });

      onOptimisticUpdate?.(tempId, { optimistic_status: "error" });
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
      // Reset input e fechar
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
    }
  };

  return (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
      onChange={handleFileChange}
      className="hidden"
    />
  );
};
