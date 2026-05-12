import { useState, useCallback, useEffect } from 'react';

export function useOptimisticMessages(messagesByDay: any) {
    const [pendingMessages, setPendingMessages] = useState<any[]>([]);

    const addPendingMessage = useCallback((pending: any) => {
        setPendingMessages((prev) => [...prev, pending]);
    }, []);

    const updatePendingMessage = useCallback((tempId: string, patch: Partial<any>) => {
        setPendingMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, ...patch } : m)));
    }, []);

    const removePendingMessage = useCallback((tempId: string) => {
        setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
    }, []);

    const flattenRealMessages = useCallback(() => {
        return messagesByDay.flatMap((g: any) => g.messages);
    }, [messagesByDay]);

    const hasEquivalentRealMessage = useCallback(
        (pending: any) => {
            const real = flattenRealMessages();
            const pendingCreatedAt = pending?.created_at ? new Date(pending.created_at).getTime() : 0;

            return real.some((m: any) => {
                if (m?.chat_id !== pending?.chat_id) return false;
                if (m?.message_type !== pending?.message_type) return false;
                if (m?.is_from_user !== true) return false;

                if (pending?.message_type === 'text') {
                    if ((m?.content || '') !== (pending?.content || '')) return false;
                } else {
                    if ((m?.file_name || '') !== (pending?.file_name || '')) return false;
                    if ((m?.file_size || null) !== (pending?.file_size || null)) return false;
                }

                const realCreatedAt = m?.created_at ? new Date(m.created_at).getTime() : 0;
                if (!pendingCreatedAt || !realCreatedAt) return false;
                return Math.abs(realCreatedAt - pendingCreatedAt) < 2 * 60 * 1000;
            });
        },
        [flattenRealMessages]
    );

    useEffect(() => {
        if (!pendingMessages.length) return;
        const toRemove: string[] = [];
        for (const p of pendingMessages) {
            if (hasEquivalentRealMessage(p)) {
                toRemove.push(p.id);
            }
        }
        if (toRemove.length) {
            setPendingMessages((prev) => prev.filter((m) => !toRemove.includes(m.id)));
        }
    }, [pendingMessages, hasEquivalentRealMessage]);

    return {
        pendingMessages,
        setPendingMessages,
        addPendingMessage,
        updatePendingMessage,
        removePendingMessage,
        hasEquivalentRealMessage
    };
}
