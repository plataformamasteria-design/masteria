import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

interface PinnedChat {
    id: string;
    chat_id: string;
    position: number;
}

const MAX_PINS = 3;

export function usePinnedChats() {
    const [pinnedChats, setPinnedChats] = useState<PinnedChat[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const { currentOrganization } = useOrganization();

    // Resolve current user ID
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserId(session?.user?.id ?? null);
        });
    }, []);

    const fetchPins = useCallback(async () => {
        if (!userId || !currentOrganization?.id) return;
        const { data, error } = await (supabase as any)
            .from('pinned_chats')
            .select('id, chat_id, position')
            .eq('user_id', userId)
            .eq('organization_id', currentOrganization.id)
            .order('position');

        if (!error) {
            setPinnedChats(data || []);
        }
        setLoading(false);
    }, [userId, currentOrganization?.id]);

    useEffect(() => {
        fetchPins();
    }, [fetchPins]);

    // Realtime subscription
    useEffect(() => {
        if (!userId || !currentOrganization?.id) return;

        const channel = supabase
            .channel('pinned-chats-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'pinned_chats' },
                () => fetchPins()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, currentOrganization?.id, fetchPins]);

    const pinnedChatIds = pinnedChats.map((p) => p.chat_id);

    const isPinned = useCallback(
        (chatId: string) => pinnedChatIds.includes(chatId),
        [pinnedChatIds]
    );

    const pinChat = useCallback(
        async (chatId: string) => {
            if (!userId || !currentOrganization?.id) return;

            if (pinnedChats.length >= MAX_PINS) {
                toast.error(`Limite de ${MAX_PINS} conversas fixadas atingido`);
                return;
            }

            const nextPosition =
                pinnedChats.length > 0
                    ? Math.max(...pinnedChats.map((p) => p.position)) + 1
                    : 0;

            // Optimistic update
            const optimistic: PinnedChat = {
                id: `optimistic-${chatId}`,
                chat_id: chatId,
                position: nextPosition,
            };
            setPinnedChats((prev) => [...prev, optimistic]);

            const { error } = await (supabase as any).from('pinned_chats').insert({
                user_id: userId,
                chat_id: chatId,
                organization_id: currentOrganization.id,
                position: nextPosition,
            });

            if (error) {
                // Revert optimistic
                setPinnedChats((prev) => prev.filter((p) => p.chat_id !== chatId));
                if (error.message?.includes('Limite')) {
                    toast.error(`Limite de ${MAX_PINS} conversas fixadas atingido`);
                } else {
                    toast.error('Erro ao fixar conversa');
                    console.error(error);
                }
                return;
            }

            toast.success('Conversa fixada');
            fetchPins(); // Sync real IDs
        },
        [userId, currentOrganization?.id, pinnedChats, fetchPins]
    );

    const unpinChat = useCallback(
        async (chatId: string) => {
            if (!userId) return;

            // Optimistic: remove immediately
            const removed = pinnedChats.find((p) => p.chat_id === chatId);
            setPinnedChats((prev) => prev.filter((p) => p.chat_id !== chatId));

            const { error } = await (supabase as any)
                .from('pinned_chats')
                .delete()
                .eq('user_id', userId)
                .eq('chat_id', chatId);

            if (error) {
                // Revert
                if (removed) setPinnedChats((prev) => [...prev, removed]);
                toast.error('Erro ao desafixar conversa');
                console.error(error);
                return;
            }

            toast.success('Conversa desafixada');
        },
        [userId, pinnedChats]
    );

    const togglePin = useCallback(
        async (chatId: string) => {
            if (isPinned(chatId)) {
                await unpinChat(chatId);
            } else {
                await pinChat(chatId);
            }
        },
        [isPinned, pinChat, unpinChat]
    );

    return {
        pinnedChatIds,
        pinnedChats,
        isPinned,
        togglePin,
        pinChat,
        unpinChat,
        pinnedCount: pinnedChats.length,
        maxPins: MAX_PINS,
        loading,
    };
}
