"use client";
/**
 * AdAccountContext — Contexto global para conta de anúncios selecionada.
 * Adaptado para MasterIA multi-tenant: busca contas via /api/meta/ad-accounts.
 * Persiste seleção no localStorage.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import useSWR from "swr";

const STORAGE_KEY = "masteria_meta_selected_account";
const fetcher = async (url: string) => {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || `Error ${r.status}`);
  return data;
};

export interface AdAccount {
  id: string;          // "act_123456"
  name: string;        // "Empresa Ads"
  currency: string;    // "BRL"
  business_name: string | null;
  amount_spent: number | null;
  is_default: boolean;
}

interface AdAccountContextType {
  account: AdAccount | null;
  accounts: AdAccount[];
  setAccount: (a: AdAccount) => void;
  isLoading: boolean;
  error: string | null;
}

const AdAccountContext = createContext<AdAccountContextType>({
  account: null, accounts: [], setAccount: () => {}, isLoading: true, error: null,
});

export function AdAccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccountState] = useState<AdAccount | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Busca lista de contas disponíveis (multi-tenant — usa session server-side)
  const { data, isLoading, error } = useSWR<{ data: AdAccount[]; default_account: string }>(
    "/api/meta/ad-accounts",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 } // 5 min cache
  );

  const accounts = data?.data || [];

  // Hidrata do localStorage na primeira carga de dados
  useEffect(() => {
    if (hydrated || isLoading) return;
    setHydrated(true);

    if (!accounts.length) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AdAccount = JSON.parse(saved);
        // Verifica se ainda está na lista de contas disponíveis
        const found = accounts.find(a => a.id === parsed.id);
        if (found) { setAccountState(found); return; }
      }
    } catch { /* ignore parse errors */ }

    // Fallback: usa a conta padrão ou a primeira
    const defaultAcc = accounts.find(a => a.is_default) || accounts[0];
    if (defaultAcc) setAccountState(defaultAcc);
  }, [accounts, isLoading, hydrated]);

  const setAccount = useCallback((a: AdAccount) => {
    setAccountState(a);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch { /* ignore */ }
  }, []);

  return (
    <AdAccountContext.Provider value={{
      account,
      accounts,
      setAccount,
      isLoading: isLoading || !hydrated,
      error: error ? error.message : null,
    }}>
      {children}
    </AdAccountContext.Provider>
  );
}

export function useAdAccount() {
  return useContext(AdAccountContext);
}

/** Retorna o account_id formatado para uso como query param */
export function useAccountId(): string | null {
  const { account } = useContext(AdAccountContext);
  return account?.id ?? null;
}
