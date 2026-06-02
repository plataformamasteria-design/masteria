'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { BarChart2, ArrowRight, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import type { Campaign } from '@/lib/types';
import type { DateRange } from 'react-day-picker';

interface TrafficKpi {
  id: string;
  label: string;
  valor: number | null;
  tipo: 'moeda' | 'inteiro' | 'percentual' | 'multiplicador';
  tendencia: { variacao_pct: number | null; direcao: 'up' | 'down' | 'flat' };
}

interface TrafficData {
  cards: TrafficKpi[];
}

interface CampaignActive extends Campaign {
  reach?: number;
  impressions?: number;
  spend?: number;
  leads?: number;
}

function formatKpiValue(valor: number | null, tipo: string): string {
  if (valor === null || valor === undefined) return '—';
  switch (tipo) {
    case 'moeda': return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percentual': return `${valor.toFixed(1)}%`;
    case 'multiplicador': return `${valor.toFixed(2)}x`;
    default: return valor.toLocaleString('pt-BR');
  }
}

const TrendIcon = ({ dir, pct }: { dir: string; pct: number | null }) => {
  if (dir === 'up') return <span className="flex items-center gap-0.5 text-emerald-400 text-[10px]"><TrendingUp className="h-3 w-3" />+{pct}%</span>;
  if (dir === 'down') return <span className="flex items-center gap-0.5 text-red-400 text-[10px]"><TrendingDown className="h-3 w-3" />{pct}%</span>;
  return <span className="flex items-center gap-0.5 text-zinc-600 text-[10px]"><Minus className="h-3 w-3" />—</span>;
};

const PRIORITY_KPIS = ['investimento', 'leads', 'cpl', 'ctr', 'cpm', 'cpc', 'impressoes'];

interface Props { dateRange?: DateRange; }

export function TrafficOverviewWidget({ dateRange }: Props) {
  const now = dateRange?.to ?? new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data: accountsData } = useSWR(
    '/api/meta/ad-accounts',
    (url: string) => fetch(url).then(res => res.json()),
    { dedupingInterval: 300000, revalidateOnFocus: false }
  );

  const accountId = (() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('masteria_meta_selected_account');
        if (saved) return JSON.parse(saved).id;
      }
    } catch {}
    const accs = accountsData?.data || [];
    const defaultAcc = accs.find((a: any) => a.is_default) || accs[0];
    return defaultAcc?.id || null;
  })();

  const { data: trafficData, isLoading: loadingTraffic } = useSWR<TrafficData>(
    accountId ? `/api/v1/marketing/kpis-trafego?modo=midia&mesReferencia=${monthKey}&account_id=${accountId}` : `/api/v1/marketing/kpis-trafego?modo=midia&mesReferencia=${monthKey}`,
    async (url: string) => {
      const json = await fetch(url).then(r => r.json());
      if (json.error) throw new Error(json.error);
      
      if (accountId) {
        const since = `${monthKey}-01`;
        const [y, mo] = monthKey.split('-');
        const ld = new Date(Number(y), Number(mo), 0).getDate();
        const until = `${monthKey}-${ld}`;
        
        const metaParams = new URLSearchParams({
          since,
          until,
          level: 'campaign',
          breakdown: 'none',
          account_id: accountId
        });
        
        try {
          const metaRes = await fetch(`/api/meta/insights?${metaParams}`).then(r => r.ok ? r.json() : null);
          if (metaRes?.totals) {
            const meta = metaRes.totals;
            const safe = (n: number, d: number) => (d && d > 0 ? n / d : null);
            const findC = (id: string) => json.cards.find((c: any) => c.id === id);
            const setV = (id: string, val: number | null) => { const c = findC(id); if (c) c.valor = val; };
            
            const inv = meta.spend || 0;
            const leads = meta.leads || 0;
            const imp = meta.impressions || 0;
            const cli = meta.clicks || 0;
            
            setV('investimento', inv);
            setV('leads', leads);
            setV('impressoes', imp);
            
            const ctr = safe(cli, imp);
            const cpc = safe(inv, cli);
            const cpl = safe(inv, leads);
            const cpm = imp > 0 ? (inv * 1000) / imp : null;
            
            setV('ctr', ctr ? ctr * 100 : null);
            setV('cpc', cpc);
            setV('cpl', cpl);
            setV('cpm', cpm);
          }
        } catch (e) {
          console.error('[traffic-widget] erro meta:', e);
        }
      }
      return json;
    },
    { dedupingInterval: 60000, revalidateOnFocus: false }
  );

  const { data: campaignsData, isLoading: loadingCampaigns } = useSWR(
    accountId ? `/api/meta/campanhas?account_id=${accountId}` : null,
    (url: string) => fetch(url).then(res => res.json()),
    { dedupingInterval: 60000, revalidateOnFocus: false }
  );

  const activeCampaigns: CampaignActive[] = (campaignsData?.data || campaignsData || [])
    .filter((c: Campaign) => ['ACTIVE'].includes(c.status))
    .slice(0, 4);

  const loading = loadingTraffic || loadingCampaigns || (accountId === null && !accountsData);

  const sortedKpis = trafficData?.cards
    ? PRIORITY_KPIS.map(id => trafficData.cards.find(c => c.id === id)).filter(Boolean) as TrafficKpi[]
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-slide-up stagger-8">
      {/* Left: Active campaigns */}
      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <BarChart2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="label-kpi">Tráfego Pago</p>
              <p className="text-zinc-900 dark:text-white font-semibold text-sm mt-0.5">Campanhas Ativas Agora</p>
            </div>
          </div>
          <Link href="/marketing" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors">
            Ver <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="space-y-2.5 flex-1">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-zinc-200 dark:bg-white/5 animate-pulse" />)
          ) : activeCampaigns.length > 0 ? (
            activeCampaigns.map(c => (
              <Link
                key={c.id}
                href="/marketing"
                className="block rounded-xl border border-emerald-500/10 bg-white dark:bg-emerald-500/[0.02] px-3.5 py-3 hover:border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-all shadow-sm dark:shadow-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate flex-1">{c.name}</p>
                  <span className="text-xs text-emerald-500 dark:text-emerald-400 font-medium shrink-0">Ativa</span>
                </div>
                <div className="flex gap-4 mt-1.5 text-xs text-zinc-500">
                  {c.spend != null && <span>Gasto: R$ {c.spend.toFixed(2)}</span>}
                  {c.leads != null && <span>{c.leads} leads</span>}
                  {c.impressions != null && <span>{c.impressions.toLocaleString('pt-BR')} impressões</span>}
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <BarChart2 className="h-8 w-8 text-zinc-700" />
              <p className="text-xs text-zinc-600">Nenhuma campanha ativa no momento</p>
              <Link href="/marketing" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
                Ver marketing →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Right: Traffic KPIs overview */}
      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-kpi">Tráfego Pago</p>
            <p className="text-zinc-900 dark:text-white font-semibold text-sm mt-0.5">Visão Geral do Mês</p>
          </div>
          <Link href="/marketing" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors">
            Detalhes <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-zinc-200 dark:bg-white/5 animate-pulse" />)}
          </div>
        ) : sortedKpis.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {sortedKpis.map(kpi => (
              <div key={kpi.id} className="flex flex-col justify-between h-full rounded-xl bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 p-3 shadow-sm dark:shadow-none">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{kpi.label}</p>
                  <p className="text-lg font-black font-outfit text-zinc-900 dark:text-white mt-1 tabular-nums leading-tight">
                    {formatKpiValue(kpi.valor, kpi.tipo)}
                  </p>
                </div>
                <div className="mt-1.5">
                  <TrendIcon dir={kpi.tendencia.direcao} pct={kpi.tendencia.variacao_pct} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 py-6">
            <TrendingUp className="h-8 w-8 text-zinc-700" />
            <p className="text-xs text-zinc-600 text-center">
              Conecte sua conta Meta para visualizar as métricas de tráfego pago.
            </p>
            <Link href="/integrations" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
              Conectar Meta Ads →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
