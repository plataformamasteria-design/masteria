"use client";

import useSWR from "swr";
import type { InteligenciaData } from "@/app/api/dashboard/inteligencia/route";

const fetcher = async (url: string): Promise<InteligenciaData> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erro ao buscar inteligência");
  return res.json();
};

export function useInteligencia(mes: string) {
  const { data, error, isLoading } = useSWR<InteligenciaData>(
    `/api/dashboard/inteligencia?mes=${mes}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,       // 1 min dedup
      refreshInterval: 900000,       // refresh every 15 min
      keepPreviousData: true,
    }
  );

  return {
    data: data ?? null,
    isLoading,
    error,
  };
}
