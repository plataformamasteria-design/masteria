"use client";
/**
 * useAccountSpend — FONTE ÚNICA de investimento total para todas as telas de tráfego.
 * Adaptado para MasterIA multi-tenant.
 */
import useSWR from "swr";
import { useAccountId } from "@/contexts/ad-account-context";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export interface AccountSpendResult {
  totalSpend: number;
  totalLeads: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  totalInlineLinkClicks: number;
  isLoading: boolean;
}

export function useAccountSpend(since: string, until: string): AccountSpendResult {
  const accountId = useAccountId();
  const acct = accountId ? `&account_id=${accountId}` : "";

  const key = accountId
    ? `/api/meta/insights?since=${since}&until=${until}&level=campaign&breakdown=none${acct}`
    : null;

  const { data, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    keepPreviousData: true,
  });

  const totals = data?.totals;
  const actuallyLoading = isLoading || !accountId;

  return {
    totalSpend: totals?.spend ?? 0,
    totalLeads: totals?.leads ?? 0,
    totalImpressions: totals?.impressions ?? 0,
    totalClicks: totals?.clicks ?? 0,
    totalReach: totals?.reach ?? 0,
    totalInlineLinkClicks: totals?.inline_link_clicks ?? 0,
    isLoading: actuallyLoading,
  };
}
