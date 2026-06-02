
'use client';

import {
  DollarSign, Users, Send, MessageCircleWarning,
  Eye, EyeOff, Zap, Bot,
} from 'lucide-react';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { DateRange } from 'react-day-picker';

interface KpiData {
  totalLeadValue: number;
  totalContacts: number;
  totalMessagesSent: number;
  totalWhatsappSent: number;
  totalSmsSent: number;
  pendingConversations: number;
}

interface AutomationSummary { activeRules: number; totalRules: number; }
interface AISummary { totalPersonas: number; activeAIConversations: number; successRate: number; }

interface ExtendedKpiData extends KpiData {
  automations?: AutomationSummary;
  ai?: AISummary;
}

interface StatsCardsProps { dateRange?: DateRange; }

interface StatCardDef {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  showToggle?: boolean;
}

// ─── Single glass KPI card (monochrome: white text + emerald icon) ───────────
const GlassKpiCard = ({
  title, value, sub, icon: Icon,
  loading, showToggle, isHidden, onToggle, index,
}: StatCardDef & { loading: boolean; isHidden?: boolean; onToggle?: () => void; index: number }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--mouse-x', `${x}px`);
    el.style.setProperty('--mouse-y', `${y}px`);
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    el.style.transform = `perspective(800px) rotateX(${((y - cy) / cy) * -5}deg) rotateY(${((x - cx) / cx) * 5}deg) translateZ(2px)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = 'none';
  }, []);

  const displayValue = () => {
    if (isHidden) return 'R$ ••••••';
    if (typeof value === 'number' && title.toLowerCase().includes('valor')) {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (typeof value === 'number') return value.toLocaleString('pt-BR');
    return value;
  };

  const staggerClass = `stagger-${Math.min(index + 1, 8)}`;

  return (
    <div
      ref={cardRef}
      className={`glass-kpi p-5 cursor-default animate-fade-slide-up ${staggerClass} relative transition-transform duration-150`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Radial mouse glow (brand color only) */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(16,185,129,0.07) 0%, transparent 70%)`,
        }}
      />
      {/* Top accent line (emerald) */}
      <div className="absolute top-0 left-6 right-6 h-px bg-emerald-500/20 rounded-full" />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Icon row */}
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Icon className="h-4 w-4 text-emerald-400" />
          </div>
          {showToggle && (
            <button
              onClick={onToggle}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-800 dark:text-zinc-600 dark:hover:text-zinc-400"
            >
              {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Value */}
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-24 bg-zinc-200 dark:bg-white/5" />
              <Skeleton className="h-3 w-32 bg-zinc-200 dark:bg-white/5" />
            </div>
          ) : (
            <>
              <div
                className="font-outfit text-2xl xl:text-3xl font-black text-zinc-900 dark:text-white leading-none tracking-tight tabular-nums animate-count-up truncate w-full"
                title={typeof value === 'number' ? displayValue() : undefined}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {displayValue()}
              </div>
              <p className="text-xs text-zinc-500 mt-2 leading-snug truncate">{sub}</p>
            </>
          )}
        </div>

        {/* Label */}
        <p className="label-kpi">{title}</p>
      </div>
    </div>
  );
};

export function StatsCards({ dateRange }: StatsCardsProps) {
  const [data, setData] = useState<ExtendedKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideLeadValue, setHideLeadValue] = useState(false);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (dateRange?.from) params.set('startDate', dateRange.from.toISOString());
        if (dateRange?.to) params.set('endDate', dateRange.to.toISOString());

        const [kpiRes, autoRes, aiRes] = await Promise.all([
          fetch(`/api/v1/dashboard/stats?${params.toString()}`),
          fetch('/api/v1/automations').catch(() => null),
          fetch('/api/v1/ia/metrics').catch(() => null),
        ]);

        if (!kpiRes.ok) {
          const err = await kpiRes.json();
          throw new Error(err.error || 'Falha ao carregar KPIs.');
        }

        const kpiData: KpiData = await kpiRes.json();
        let automations: AutomationSummary | undefined;
        let ai: AISummary | undefined;

        if (autoRes?.ok) {
          const rules: Array<{ isActive: boolean }> = await autoRes.json();
          automations = { totalRules: rules.length, activeRules: rules.filter(r => r.isActive).length };
        }
        if (aiRes?.ok) {
          const aiData = await aiRes.json();
          ai = {
            totalPersonas: aiData.summary?.totalPersonas ?? 0,
            activeAIConversations: aiData.summary?.activeAIConversations ?? 0,
            successRate: aiData.summary?.successRate ?? 0,
          };
        }

        setData({ ...kpiData, automations, ai });
      } catch (error) {
        notify.error('Erro nos KPIs', (error as Error).message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange, notify]);

  const cards: StatCardDef[] = [
    {
      title: 'Valor em Leads',
      value: data?.totalLeadValue ?? 0,
      sub: 'Soma de oportunidades no período',
      icon: DollarSign,
      showToggle: true,
    },
    {
      title: 'Novos Contatos',
      value: data?.totalContacts ?? 0,
      sub: 'Contatos criados no período',
      icon: Users,
    },
    {
      title: 'Mensagens Enviadas',
      value: data?.totalMessagesSent ?? 0,
      sub: `${(data?.totalWhatsappSent ?? 0).toLocaleString('pt-BR')} WhatsApp · ${(data?.totalSmsSent ?? 0).toLocaleString('pt-BR')} SMS`,
      icon: Send,
    },
    {
      title: 'Atendimentos Pendentes',
      value: data?.pendingConversations ?? 0,
      sub: 'Aguardando 1ª resposta',
      icon: MessageCircleWarning,
    },
    {
      title: 'Automações Ativas',
      value: data?.automations?.activeRules ?? 0,
      sub: `${data?.automations?.totalRules ?? 0} regras criadas`,
      icon: Zap,
    },
    {
      title: 'Agentes de IA',
      value: data?.ai?.totalPersonas ?? 0,
      sub: `${data?.ai?.activeAIConversations ?? 0} conversas ativas · ${data?.ai?.successRate ?? 0}% sucesso`,
      icon: Bot,
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card, i) => (
        <GlassKpiCard
          key={card.title}
          {...card}
          loading={loading}
          isHidden={card.showToggle ? hideLeadValue : false}
          onToggle={card.showToggle ? () => setHideLeadValue(v => !v) : undefined}
          index={i}
        />
      ))}
    </div>
  );
}
