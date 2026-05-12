import { useCallback, useRef, useState } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  initialPage?: number;
  pageSize?: number;
}

export const useInfiniteScroll = ({
  threshold = 100,
  initialPage = 1,
  pageSize = 20,
}: UseInfiniteScrollOptions = {}) => {
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoadingMore) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
            setPage((prev) => prev + 1);
          }
        },
        {
          rootMargin: `${threshold}px`,
        }
      );

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoadingMore, hasMore, threshold]
  );

  const reset = useCallback(() => {
    setPage(initialPage);
    setHasMore(true);
    setIsLoadingMore(false);
  }, [initialPage]);

  return {
    page,
    setPage,
    hasMore,
    setHasMore,
    isLoadingMore,
    setIsLoadingMore,
    lastElementRef,
    reset,
    pageSize,
  };
};
