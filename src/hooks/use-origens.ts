"use client";

import useSWR from "swr";

export interface Origem {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  ordem: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Hook compartilhado — todas as páginas usam a mesma fonte de origens */
export function useOrigens() {
  const { data, error, mutate } = useSWR<Origem[]>("/api/origens", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  const nomes = (data || []).map((o) => o.nome);
  const corMap = Object.fromEntries((data || []).map((o) => [o.nome, o.cor]));

  return {
    origens: data || [],
    nomes,
    corMap,
    loading: !data && !error,
    error,
    mutate,
  };
}

/** Fallback hardcoded para SSR ou quando a tabela ainda não existe */
export const ORIGENS_FALLBACK = [
  "Tráfego Pago", "Orgânico", "Social Selling", "Indicação",
  "Workshop", "Instagram", "Sessão Estratégica", "Webinar", "WhatsApp direto",
];
