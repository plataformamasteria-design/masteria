import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import type { Message } from '@/types/message';

interface PinnedMessage {
    id: string;
    message_id: string;
    chat_id: string;
    pinned_by: string;
    created_at: string;
    message?: Message;
}

export function usePinnedMessages(chatId: string | null) {
    const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const { currentOrganization } = useOrganization();
    const maxPins = 3;
    // Cache of full message objects to avoid refetching
    const messagesCacheRef = useRef<Map<string, Message>>(new Map());

    const fetchPinned = useCallback(async () => {
        if (!chatId || !currentOrganization?.id) {
            setPinnedMessages([]);
            return;
        }

        setLoading(true);
        const { data, error } = await (supabase as any)
            .from('pinned_messages')
            .select('id, message_id, chat_id, pinned_by, created_at')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            const messageIds = (data as any[]).map((p: any) => p.message_id);
            if (messageIds.length > 0) {
                // Only fetch messages we don't already have cached
                const uncached = messageIds.filter((id: string) => !messagesCacheRef.current.has(id));
                if (uncached.length > 0) {
                    const { data: messages } = await (supabase as any)
                        .from('messages')
                        .select('*')
                        .in('id', uncached);
                    (messages || []).forEach((m: any) => messagesCacheRef.current.set(m.id, m));
                }

                setPinnedMessages(
                    (data as any[]).map((p: any) => ({
                        ...p,
                        message: messagesCacheRef.current.get(p.message_id) || null,
                    }))
                );
            } else {
                setPinnedMessages([]);
            }
        }
        setLoading(false);
    }, [chatId, currentOrganization?.id]);

    // Reset cache when chat changes
    useEffect(() => {
        messagesCacheRef.current = new Map();
        fetchPinned();
    }, [fetchPinned]);

    // Realtime subscription
    useEffect(() => {
        if (!chatId) return;

        const channel = supabase
            .channel(`pinned-messages:${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'pinned_messages',
                    filter: `chat_id=eq.${chatId}`,
                },
                () => fetchPinned()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatId, fetchPinned]);

    const pinMessage = useCallback(
        async (messageId: string) => {
            if (!chatId || !currentOrganization?.id) return;

            if (pinnedMessages.length >= maxPins) {
                toast.error(`Limite de ${maxPins} mensagens fixadas por conversa atingido`);
                return;
            }

            if (pinnedMessages.some((p) => p.message_id === messageId)) {
                toast.info('Esta mensagem já está fixada');
                return;
            }

            const { data: session } = await supabase.auth.getSession();
            const userId = session?.session?.user?.id;
            if (!userId) {
                toast.error('O sistema não conseguiu verificar a identidade do usuário logado.');
                console.error('[pinMessage] userId was empty from getSession');
                return;
            }

            // Optimistic: fetch the message and add immediately
            let msgData = messagesCacheRef.current.get(messageId);
            if (!msgData) {
                const { data: fetchedMsg } = await (supabase as any)
                    .from('messages')
                    .select('*')
                    .eq('id', messageId)
                    .maybeSingle();
                if (fetchedMsg) {
                    msgData = fetchedMsg as Message;
                    messagesCacheRef.current.set(messageId, msgData);
                }
            }

            const optimisticEntry: PinnedMessage = {
                id: `optimistic-${messageId}`,
                message_id: messageId,
                chat_id: chatId,
                pinned_by: userId,
                created_at: new Date().toISOString(),
                message: msgData,
            };

            // Add optimistically
            setPinnedMessages((prev) => [optimisticEntry, ...prev]);

            const { error } = await (supabase as any).from('pinned_messages').insert({
                message_id: messageId,
                chat_id: chatId,
                organization_id: currentOrganization.id,
                pinned_by: userId,
            });

            if (error) {
                // Revert optimistic update
                setPinnedMessages((prev) => prev.filter((p) => p.message_id !== messageId));
                if (error.message?.includes('Limite')) {
                    toast.error(`Limite de ${maxPins} mensagens fixadas por conversa`);
                } else {
                    console.error('Erro ao fixar mensagem:', error);
                    toast.error(`Erro ao fixar: ${error.message || JSON.stringify(error)}`);
                }
            } else {
                toast.success('Mensagem fixada');
                // Refetch to get real IDs
                fetchPinned();
            }
        },
        [chatId, currentOrganization?.id, pinnedMessages, maxPins, fetchPinned]
    );

    const unpinMessage = useCallback(
        async (messageId: string) => {
            if (!chatId) return;

            // Optimistic: remove immediately
            const removed = pinnedMessages.find((p) => p.message_id === messageId);
            setPinnedMessages((prev) => prev.filter((p) => p.message_id !== messageId));

            const { error } = await (supabase as any)
                .from('pinned_messages')
                .delete()
                .eq('message_id', messageId)
                .eq('chat_id', chatId);

            if (error) {
                // Revert: add back
                if (removed) {
                    setPinnedMessages((prev) => [...prev, removed]);
                }
                console.error('Erro ao desafixar mensagem:', error);
                toast.error('Erro ao desafixar mensagem');
            } else {
                toast.success('Mensagem desafixada');
            }
        },
        [chatId, pinnedMessages]
    );

    const isMessagePinned = useCallback(
        (messageId: string) => pinnedMessages.some((p) => p.message_id === messageId),
        [pinnedMessages]
    );

    const togglePinMessage = useCallback(
        async (messageId: string) => {
            if (isMessagePinned(messageId)) {
                await unpinMessage(messageId);
            } else {
                await pinMessage(messageId);
            }
        },
        [isMessagePinned, pinMessage, unpinMessage]
    );

    return {
        pinnedMessages,
        loading,
        pinMessage,
        unpinMessage,
        isMessagePinned,
        togglePinMessage,
        pinnedCount: pinnedMessages.length,
        maxPins,
    };
}
