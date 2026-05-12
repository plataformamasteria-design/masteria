import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Message } from '@/types/message';
import { parseEdgeFunctionError } from '@/lib/edge-function-error';

interface UseChatMessageActionsProps {
    localChat: any;
    currentOrganization: any;
    openLeadDetail: (chatId: string) => void;
}

export function useChatMessageActions({ localChat, currentOrganization, openLeadDetail }: UseChatMessageActionsProps) {
    const { toast } = useToast();

    const handleOpenGroupSenderLead = useCallback(async (message: Message) => {
        try {
            if (!localChat?.is_group) return;
            if (!currentOrganization?.id) return;

            const isLidNumber = (phone: string | null): boolean => {
                if (!phone) return true;
                const digits = String(phone).replace(/\D/g, '');
                if (digits.length > 13) return true;
                if (!digits.startsWith('55') && digits.length > 12) return true;
                if (digits.length < 8) return true;
                return false;
            };

            let phoneDigits = '';

            if (message.sender_phone && !isLidNumber(message.sender_phone)) {
                phoneDigits = String(message.sender_phone).replace(/\D/g, '');
            } else if (message.sender_jid) {
                const { data: participant } = await supabase
                    .from('group_participants')
                    .select('participant_phone')
                    .eq('group_chat_id', localChat.id)
                    .eq('participant_jid', message.sender_jid)
                    .maybeSingle();

                if (participant?.participant_phone && !isLidNumber(participant.participant_phone)) {
                    phoneDigits = String(participant.participant_phone).replace(/\D/g, '');
                } else {
                    const jidPart = String(message.sender_jid).split('@')[0];
                    if (!isLidNumber(jidPart)) {
                        phoneDigits = jidPart.replace(/\D/g, '');
                    }
                }
            }

            if (!phoneDigits || phoneDigits.length < 8) {
                toast({
                    title: 'Número não identificado',
                    description: 'Não foi possível identificar o número deste participante.',
                    variant: 'destructive',
                });
                return;
            }

            const { data, error } = await supabase.functions.invoke('evolution-api', {
                body: {
                    action: 'ensure-lead-from-phone',
                    organization_id: currentOrganization.id,
                    phone: phoneDigits,
                    pushName: message.sender_name || null,
                },
            });

            if (error || (data as any)?.error) {
                const parsed = parseEdgeFunctionError(error, data);
                const errorCode = parsed.code;
                const errorMessage = parsed.message;

                const errorText = `${errorMessage || ''} ${String(error || '')}`;
                const looksLikeNotOnWhatsApp =
                    errorCode === 'number_not_on_whatsapp' ||
                    (errorText.includes('number_not_on_whatsapp') ||
                        errorText.includes('não está registrado no WhatsApp') ||
                        errorText.includes('not registered on WhatsApp'));

                if (looksLikeNotOnWhatsApp) {
                    toast({
                        title: 'Número não encontrado',
                        description: errorMessage || 'Este número não está registrado no WhatsApp.',
                        variant: 'destructive',
                    });
                    return;
                }

                toast({
                    title: 'Erro',
                    description: errorMessage || errorCode || 'Não foi possível abrir o lead do participante.',
                    variant: 'destructive',
                });
                return;
            }

            const leadChatId = String((data as any)?.chatId || (data as any)?.data?.chatId || '');
            if (!leadChatId) return;

            openLeadDetail(leadChatId);
        } catch (e: any) {
            console.error('[ChatWindow] open group sender lead failed:', e);
            toast({
                title: 'Erro',
                description: e?.message || 'Não foi possível abrir o lead do participante.',
                variant: 'destructive',
            });
        }
    }, [currentOrganization?.id, localChat?.id, localChat?.is_group, openLeadDetail, toast]);

    const handleDeleteForEveryone = useCallback(async (message: Message) => {
        try {
            const { data, error } = await supabase.functions.invoke('message-actions', {
                body: { action: 'deleteForEveryone', messageId: message.id },
            });

            const apiError = (data as any)?.error as string | undefined;
            if (error || apiError) {
                const errText = apiError || (error as any)?.message || 'unknown_error';
                if (errText.includes('missing_external_message_id')) {
                    toast({
                        title: 'Aguarde confirmar',
                        description:
                            'Esta mensagem ainda não foi confirmada no WhatsApp. Aguarde alguns segundos e tente novamente (ou use "Excluir só na plataforma").',
                        variant: 'destructive',
                    });
                    return;
                }

                toast({
                    title: 'Erro',
                    description: 'Não foi possível excluir a mensagem para todos.',
                    variant: 'destructive',
                });
            }
        } catch (e) {
            console.error('[ChatWindow] deleteForEveryone failed:', e);
            toast({
                title: 'Erro',
                description: 'Não foi possível excluir a mensagem para todos.',
                variant: 'destructive',
            });
        }
    }, [toast]);

    const handleDeleteForPlatform = useCallback(async (message: Message) => {
        try {
            const { data, error } = await supabase.functions.invoke('message-actions', {
                body: { action: 'deleteForPlatform', messageId: message.id },
            });

            const apiError = (data as any)?.error as string | undefined;
            if (error || apiError) {
                toast({
                    title: 'Erro',
                    description: 'Não foi possível excluir a mensagem na plataforma.',
                    variant: 'destructive',
                });
            }
        } catch (e) {
            console.error('[ChatWindow] deleteForPlatform failed:', e);
            toast({
                title: 'Erro',
                description: 'Não foi possível excluir a mensagem na plataforma.',
                variant: 'destructive',
            });
        }
    }, [toast]);

    const handleSendToFolder = useCallback(async (message: Message) => {
        if (!message.file_url || !localChat) return;
        try {
            const { data: userData } = await supabase.auth.getUser();
            const { error } = await supabase.from("lead_files").insert({
                chat_id: localChat.id,
                organization_id: localChat.organization_id,
                file_name: message.file_name || "arquivo",
                file_url: message.file_url,
                file_size: message.file_size || null,
                file_type: message.message_type === "image" ? "image/jpeg" : message.message_type === "audio" ? "audio/ogg" : message.message_type === "video" ? "video/mp4" : "application/octet-stream",
                source: "chat",
                uploaded_by: userData.user?.id,
                message_id: message.id,
            });
            if (error) throw error;
            toast({ title: "Arquivo salvo na Pasta do Lead!" });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao salvar", description: e.message });
        }
    }, [localChat, toast]);

    return {
        handleOpenGroupSenderLead,
        handleDeleteForEveryone,
        handleDeleteForPlatform,
        handleSendToFolder
    };
}
