import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useChatSubscriptions({ localChat, setLocalChat, currentOrganization }: any) {
    useEffect(() => {
        if (!localChat?.id) return;

        const channel = supabase
            .channel(`chat-window-updates:${localChat.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chats',
                    filter: `id=eq.${localChat.id}`,
                },
                (payload) => {
                    if (payload.new) {
                        setLocalChat((prev: any) => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                agent_off: payload.new.agent_off,
                                assigned_to: payload.new.assigned_to,
                                team_id: payload.new.team_id,
                                assigned_at: payload.new.assigned_at,
                            };
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [localChat?.id, setLocalChat]);
}
