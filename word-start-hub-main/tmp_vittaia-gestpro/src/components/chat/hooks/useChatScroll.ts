import { useEffect, useRef, useCallback } from 'react';

export function useChatScroll({
    messagesByDay,
    loading,
    loadingMore,
    hasMore,
    loadMoreMessages
}: any) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isInitialScroll = useRef(true);
    const prevScrollHeight = useRef(0);

    useEffect(() => {
        if (scrollRef.current && isInitialScroll.current && !loading && messagesByDay.length > 0) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            isInitialScroll.current = false;
        }
    }, [messagesByDay, loading]);

    useEffect(() => {
        if (scrollRef.current && prevScrollHeight.current > 0 && !loadingMore) {
            const newScrollHeight = scrollRef.current.scrollHeight;
            const scrollDiff = newScrollHeight - prevScrollHeight.current;
            scrollRef.current.scrollTop = scrollDiff;
            prevScrollHeight.current = 0;
        }
    }, [messagesByDay, loadingMore]);

    useEffect(() => {
        if (scrollRef.current && !isInitialScroll.current && !loadingMore) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

            if (isNearBottom) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }
    }, [messagesByDay, loadingMore]);

    const handleScroll = useCallback(() => {
        if (!scrollRef.current || loadingMore || !hasMore) return;

        const { scrollTop } = scrollRef.current;

        if (scrollTop < 100) {
            prevScrollHeight.current = scrollRef.current.scrollHeight;
            loadMoreMessages();
        }
    }, [loadingMore, hasMore, loadMoreMessages]);

    return { scrollRef, handleScroll, isInitialScroll };
}
