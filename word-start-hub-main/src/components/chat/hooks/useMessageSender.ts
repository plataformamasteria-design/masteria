import { useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserRole } from '@/hooks/useUserRole';
import type { Message } from '@/types/message';

interface UseMessageSenderProps {
    chatId: string;
    message: string;
    setMessage: (val: string) => void;
    isInternalNote: boolean;
    setIsInternalNote: (val: boolean) => void;
    replyToMessage?: Message | null;
    editingMessage?: Message | null;
    onClearEditing?: () => void;
    onClearReply?: () => void;
    onMessageSent?: () => void;
    onOptimisticMessage?: (message: any) => void;
    onOptimisticUpdate?: (tempId: string, patch: Partial<any>) => void;
}

export function useMessageSender({
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
}: UseMessageSenderProps) {
    const { toast } = useToast();
    const { user } = useCurrentUser();
    const { isHiden } = useUserRole();

    const stripSignature = useCallback((content: string) => {
        const normalized = content ?? '';
        const m = normalized.match(/^\*[^*]+\*\n([\s\S]*)$/);
        return (m?.[1] ?? normalized).trimStart();
    }, []);

    const editDraft = useMemo(() => {
        if (!editingMessage?.content) return '';
        return stripSignature(editingMessage.content);
    }, [editingMessage?.content, stripSignature]);

    useEffect(() => {
        if (editingMessage) {
            setIsInternalNote(false);
            setMessage(editDraft);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingMessage?.id]);

    const resolveQuotedExternalId = async (): Promise<string | null> => {
        if (!replyToMessage) return null;
        if ((replyToMessage as any).external_message_id) return (replyToMessage as any).external_message_id as string;

        const { data, error } = await supabase
            .from('messages')
            .select('external_message_id')
            .eq('id', replyToMessage.id)
            .single();

        if (error) {
            console.error('[MessageInput] Error resolving quoted external_message_id:', error);
            return null;
        }
        return (data?.external_message_id ?? null) as string | null;
    };

    const createTempId = () => {
        try {
            return `temp-${crypto.randomUUID()}`;
        } catch {
            return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
    };

    const handleSend = async (rawText?: string) => {
        const text = (rawText ?? message).trim();
        if (!text) return;

        if (!rawText) setMessage("");

        let tempId: string | null = null;

        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (!authUser) {
                console.error('[MessageInput] Usuário não autenticado');
                toast({
                    title: "Erro",
                    description: "Você precisa estar logado para enviar mensagens",
                    variant: "destructive",
                });
                return;
            }

            console.log('[MessageInput] Usuário logado:', authUser.id, authUser.email);

            const { data: chatData } = await supabase
                .from('chats')
                .select('organization_id')
                .eq('id', chatId)
                .single();

            const organizationId = chatData?.organization_id;
            if (!organizationId) {
                console.error('[MessageInput] Chat não encontrado ou sem organization_id');
                toast({
                    title: "Erro",
                    description: "Não foi possível identificar a organização do chat",
                    variant: "destructive",
                });
                return;
            }

            const agentNameFinal =
                (user?.full_name && String(user.full_name).trim())
                    ? String(user.full_name).trim()
                    : ((authUser as any)?.user_metadata?.full_name || 'Agente');

            // ==================== EDIT MODE ====================
            if (editingMessage) {
                console.log('[MessageInput] Editing message:', editingMessage.id);
                const { data: editData, error: editError } = await supabase.functions.invoke('message-actions', {
                    body: {
                        action: 'editMessage',
                        messageId: editingMessage.id,
                        newText: text,
                    },
                });

                const apiError = (editData as any)?.error as string | undefined;
                if (editError || apiError) {
                    console.error('[MessageInput] Error editing message:', editError);
                    const errText = apiError || (editError as any)?.message || 'unknown_error';
                    if (String(errText).includes('missing_external_message_id')) {
                        toast({
                            title: 'Aguarde confirmar',
                            description:
                                'Esta mensagem ainda não foi confirmada no WhatsApp. Aguarde alguns segundos e tente editar novamente.',
                            variant: 'destructive',
                        });
                        return;
                    }
                    toast({
                        title: 'Erro',
                        description: 'Não foi possível editar a mensagem',
                        variant: 'destructive',
                    });
                    return;
                }

                setMessage('');
                onClearEditing?.();
                onMessageSent?.();
                return;
            }

            const signatureEnabled = user?.message_signature_enabled ?? true;
            const formattedMessage = (!isInternalNote && signatureEnabled)
                ? `*${agentNameFinal}*\n${text}`
                : text;

            console.log('[MessageInput] Mensagem formatada:', formattedMessage);
            console.log('[MessageInput] Modo nota interna:', isInternalNote);

            tempId = !isInternalNote ? createTempId() : null;
            if (!isInternalNote && tempId) {
                onOptimisticMessage?.({
                    id: tempId,
                    chat_id: chatId,
                    content: formattedMessage,
                    message_type: "text",
                    file_url: null,
                    file_name: null,
                    file_size: null,
                    is_from_user: true,
                    created_at: new Date().toISOString(),
                    delivered_at: null,
                    read_at: null,
                    private: false,
                    sent_by: authUser.id,
                    sender_name: null,
                    optimistic_status: "sending",
                    is_hidden_from_agents: isHiden,
                });
            }

            if (!isInternalNote) {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                const { data: recentMessages } = await supabase
                    .from('messages')
                    .select('id, content')
                    .eq('chat_id', chatId)
                    .eq('is_from_user', true)
                    .gte('created_at', fiveMinutesAgo)
                    .limit(20);

                const isDuplicate = (recentMessages || []).some((m: any) => {
                    const existingRaw = stripSignature(m.content || '');
                    return existingRaw === text;
                });

                if (isDuplicate) {
                    console.log('[MessageInput] ⚠️ Mensagem duplicada detectada, ignorando envio');
                    toast({
                        title: "Mensagem duplicada",
                        description: "Esta mensagem já foi enviada recentemente",
                        variant: "destructive",
                    });
                    if (tempId) onOptimisticUpdate?.(tempId, { optimistic_status: "error" });
                    return;
                }
            }

            const quotedExternalId = replyToMessage ? await resolveQuotedExternalId() : null;
            if (replyToMessage && !quotedExternalId) {
                toast({
                    title: 'Aguarde confirmar',
                    description: 'A mensagem citada ainda não foi confirmada no WhatsApp. Tente novamente em alguns segundos.',
                    variant: 'destructive',
                });
                return;
            }

            const { data: insertedMessage, error: dbError } = await supabase
                .from("messages")
                .insert([{
                    chat_id: chatId,
                    organization_id: organizationId,
                    content: formattedMessage,
                    message_type: "text",
                    is_from_user: true,
                    sent_by: authUser.id,
                    private: isInternalNote,
                    sent_from_platform: true,
                    is_hidden_from_agents: isHiden,
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

            if (dbError) {
                console.error('[MessageInput] Erro ao inserir mensagem:', dbError);
                throw dbError;
            }

            console.log('[MessageInput] Mensagem inserida no banco:', insertedMessage.id);

            if (tempId) {
                onOptimisticUpdate?.(tempId, { optimistic_status: undefined });
            }

            if (!isInternalNote) {
                const chatUpdates: any = { last_read_at: new Date().toISOString() };
                if (isHiden) {
                    chatUpdates.last_message = "🔒 Mensagem Oculta";
                    chatUpdates.last_message_at = new Date().toISOString();
                }

                const { error: updateReadError } = await supabase
                    .from('chats')
                    .update(chatUpdates)
                    .eq('id', chatId);

                if (updateReadError) {
                    console.error('[MessageInput] Erro ao atualizar chat:', updateReadError);
                } else {
                    console.log('[MessageInput] Chat atualizado');
                }
            }

            if (isInternalNote) {
                console.log('[MessageInput] ✅ Nota interna salva, não enviando para webhooks');
                setIsInternalNote(false);
                return;
            }

            onClearReply?.();

            const { data: chat, error: chatError } = await supabase.from("chats").select("phone").eq("id", chatId).single();

            if (chatError) {
                console.error('[MessageInput] Erro ao buscar chat:', chatError);
                throw chatError;
            }

            console.log('[MessageInput] Chat encontrado:', chat.phone);

            try {
                await supabase.functions.invoke('follow-up-message-received', {
                    body: {
                        phone: chat.phone,
                        message: formattedMessage
                    }
                });
            } catch (followUpError) {
                console.error('Error checking follow-up:', followUpError);
            }

            console.log('[MessageInput] Triggering sent webhooks for message:', insertedMessage.id);
            const { error: webhookError } = await supabase.functions.invoke('trigger-sent-webhooks', {
                body: { messageId: insertedMessage.id }
            });

            if (webhookError) {
                console.error('[MessageInput] Error triggering webhooks:', webhookError);
            } else {
                console.log('[MessageInput] Webhooks triggered successfully');
            }

            onMessageSent?.();
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            toast({
                title: "Erro",
                description: "Não foi possível enviar a mensagem",
                variant: "destructive",
            });
            if (tempId) onOptimisticUpdate?.(tempId, { optimistic_status: "error" });
        }
    };

    return { handleSend };
}
