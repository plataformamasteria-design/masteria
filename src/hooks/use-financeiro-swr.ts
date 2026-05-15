import useSWR from "swr";
import { getCurrentMonth } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Resumo global Financeiro (Asaas + Fluxo + KPIs)
export function useFinanceiroResumoSWR(mes: string) {
    const { data, error, mutate, isLoading } = useSWR(
        mes ? `/api/financeiro/resumo?mes=${mes}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 120000 }
    );
    return { data, isLoading, isError: error, mutate };
}

// Entradas (Recebimentos)
export function useEntradasSWR(mes: string) {
    const { data, error, mutate, isLoading } = useSWR(
        mes ? `/api/financeiro/entradas?mes=${mes}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 120000 }
    );
    return {
        clientes: data?.clientes || [],
        resumo: data?.resumo || null,
        comissoesPendentes: data?.comissoes_pendentes || [],
        isLoading,
        isError: error,
        mutate
    };
}

// DRE Gerencial
export function useDreSWR(mes: string, impostosPct: number, ytd: boolean) {
    const { data, error, mutate, isLoading } = useSWR(
        mes ? `/api/financeiro/dre?mes=${mes}&impostos_pct=${impostosPct}${ytd ? "&ytd=1" : ""}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 300000 }
    );
    return { data: data?.error ? null : data, isLoading, isError: error, mutate };
}

// Evolução DRE (12 meses)
export function useDreEvolucaoSWR(mes: string, impostosPct: number) {
    const { data, error, isLoading } = useSWR(
        mes ? `/api/financeiro/dre?mes=${mes}&impostos_pct=${impostosPct}&serie=1` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 600000 }
    );
    return { evolucao: data?.meses || [], isLoading, isError: error };
}
