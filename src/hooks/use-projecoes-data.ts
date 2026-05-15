import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useProjecoesSWR() {
    const { data: alertas, mutate: mutateAlertas, isLoading: loadingAlertas } = useSWR("/api/projecoes/alertas", fetcher, { revalidateOnFocus: false, dedupingInterval: 300000 });
    const { data: breakEven, isLoading: loadingBreakEven } = useSWR("/api/projecoes/break-even", fetcher, { revalidateOnFocus: false, dedupingInterval: 300000 });
    const { data: ltv, isLoading: loadingLtv } = useSWR("/api/projecoes/ltv-carteira", fetcher, { revalidateOnFocus: false, dedupingInterval: 300000 });

    return {
        alertas: alertas?.alertas || [],
        mutateAlertas,
        breakEven: breakEven?.error ? null : breakEven,
        ltv: ltv?.error ? null : ltv,
        isLoading: loadingAlertas || loadingBreakEven || loadingLtv,
    };
}
