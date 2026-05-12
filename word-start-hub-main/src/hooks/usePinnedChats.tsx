import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

interface PinnedChat {
    id: string;
    chat_id: string;
    position: number;
    scope: 'user' | 'team' | 'all';
    filter_context: string;
    user_id: string;
    target_team_id: string | null;
}

export function usePinnedChats(activeFilter: string = 'all', userTeamIds: string[] = []) {
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
        
        let orQuery = `scope.eq.all,and(scope.eq.user,user_id.eq.${userId})`;
        if (userTeamIds && userTeamIds.length > 0) {
            const teamIdsStr = userTeamIds.map(id => `"${id}"`).join(',');
            orQuery += `,and(scope.eq.team,target_team_id.in.(${teamIdsStr}))`;
        }

        const { data, error } = await (supabase as any)
            .from('pinned_chats')
            .select('id, chat_id, position, scope, filter_context, user_id, target_team_id')
            .eq('organization_id', currentOrganization.id)
            .eq('filter_context', activeFilter)
            .or(orQuery)
            .order('position');

        if (!error) {
            setPinnedChats(data || []);
        }
        setLoading(false);
    }, [userId, currentOrganization?.id, activeFilter, userTeamIds]);

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
        async (chatId: string, scope: 'user' | 'team' | 'all' = 'user', targetTeamId?: string | null) => {
            if (!userId || !currentOrganization?.id) return;

            const nextPosition =
                pinnedChats.length > 0
                    ? Math.max(...pinnedChats.map((p) => p.position)) + 1
                    : 0;

            // Optimistic update
            const optimistic: PinnedChat = {
                id: `optimistic-${chatId}`,
                chat_id: chatId,
                position: nextPosition,
                scope,
                filter_context: activeFilter,
                user_id: userId,
                target_team_id: targetTeamId || null
            };
            setPinnedChats((prev) => [...prev, optimistic]);

            const { error } = await (supabase as any).from('pinned_chats').insert({
                user_id: userId,
                chat_id: chatId,
                organization_id: currentOrganization.id,
                position: nextPosition,
                scope,
                filter_context: activeFilter,
                target_team_id: targetTeamId || null
            });

            if (error) {
                // Revert optimistic
                setPinnedChats((prev) => prev.filter((p) => p.chat_id !== chatId));
                if (error.code === '23505') { // Unique violation
                    toast.error('Esta conversa já está fixada nesta aba.');
                } else {
                    toast.error('Erro ao fixar conversa');
                    console.error(error);
                }
                return;
            }

            toast.success('Conversa fixada');
            fetchPins(); // Sync real IDs
        },
        [userId, currentOrganization?.id, pinnedChats, fetchPins, activeFilter]
    );

    const unpinChat = useCallback(
        async (chatId: string) => {
            if (!userId) return;

            const chatToUnpin = pinnedChats.find((p) => p.chat_id === chatId);
            if (!chatToUnpin) return;

            // Only allow unpinning if it's my pin, or if I have rights (simplified: if I can see it, I can unpin it for now, 
            // but ideally we should delete by ID so we don't accidentally delete someone else's team pin if we don't have permission.
            // Let's delete by the specific pin ID we have in state).

            // Optimistic: remove immediately
            setPinnedChats((prev) => prev.filter((p) => p.chat_id !== chatId));

            // To avoid deleting another user's pin with the same chat_id in a different context,
            // we delete specifically by the pin's primary key ID.
            const { error } = await (supabase as any)
                .from('pinned_chats')
                .delete()
                .eq('id', chatToUnpin.id);

            if (error) {
                // Revert
                setPinnedChats((prev) => [...prev, chatToUnpin]);
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
        loading,
    };
}
