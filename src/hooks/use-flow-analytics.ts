import useSWR from 'swr';

export interface NodeStats {
  nodeId: string;
  totalReached: number;
  totalResponded: number;
  responses: Record<string, number>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useFlowAnalytics(flowId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<NodeStats[]>(
    flowId && flowId !== 'new' ? `/api/v1/automations/${flowId}/stats` : null,
    fetcher,
    {
      refreshInterval: 10000, // Poll every 10 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    stats: Array.isArray(data) ? data : [],
    isLoading,
    isError: error,
    mutate,
  };
}
