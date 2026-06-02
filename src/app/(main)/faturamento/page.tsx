'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard, Zap, CheckCircle2, ArrowRight, Crown, Star,
  TrendingUp, Users, MessageSquare, Bot, Calendar, Receipt,
  Loader2, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'R$ 197',
    period: '/mês',
    description: 'Para começar com inteligência',
    icon: Star,
    color: 'from-zinc-400 to-zinc-600',
    accent: 'border-zinc-500/30 bg-zinc-500/5',
    features: [
      '1 Conexão WhatsApp',
      '3 Agentes de IA',
      '500 Disparos/mês',
      '1.000 Leads',
      'Suporte por chat',
    ],
    current: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 397',
    period: '/mês',
    description: 'Para times de alta performance',
    icon: Zap,
    color: 'from-emerald-400 to-teal-600',
    accent: 'border-emerald-500/40 bg-emerald-500/5',
    badge: 'Popular',
    features: [
      '5 Conexões WhatsApp',
      'Agentes de IA Ilimitados',
      '5.000 Disparos/mês',
      '10.000 Leads',
      'Integrações Meta Ads',
      'Suporte prioritário',
    ],
    current: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    description: 'Para grandes operações',
    icon: Crown,
    color: 'from-amber-400 to-orange-600',
    accent: 'border-amber-500/30 bg-amber-500/5',
    features: [
      'Conexões Ilimitadas',
      'Tudo do Pro',
      'Disparos Ilimitados',
      'Leads Ilimitados',
      'API Dedicada',
      'Gerente de conta',
      'SLA Premium',
    ],
    current: false,
  },
];

const USAGE = [
  { label: 'Disparos este mês', value: 2847, max: 5000, icon: MessageSquare, color: 'bg-emerald-500' },
  { label: 'Leads ativos', value: 4231, max: 10000, icon: Users, color: 'bg-blue-500' },
  { label: 'Agentes de IA', value: 3, max: null, icon: Bot, color: 'bg-purple-500' },
  { label: 'Conexões WhatsApp', value: 2, max: 5, icon: TrendingUp, color: 'bg-amber-500' },
];

const INVOICES = [
  { id: 'INV-2025-005', date: 'Mai 2025', amount: 'R$ 397,00', status: 'Pago' },
  { id: 'INV-2025-004', date: 'Abr 2025', amount: 'R$ 397,00', status: 'Pago' },
  { id: 'INV-2025-003', date: 'Mar 2025', amount: 'R$ 397,00', status: 'Pago' },
  { id: 'INV-2025-002', date: 'Fev 2025', amount: 'R$ 397,00', status: 'Pago' },
];

export default function FaturamentoPage() {
  const { toast } = useToast();
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    await new Promise(r => setTimeout(r, 1500));
    setUpgrading(null);
    toast({
      title: 'Em breve!',
      description: 'Nossa equipe entrará em contato para concluir o upgrade do plano.',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Faturamento"
        description="Gerencie sua assinatura, uso e faturas."
        icon={CreditCard}
      />

      {/* ── Current Plan Banner ─── */}
      <div className="relative rounded-2xl overflow-hidden border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl shadow-2xl p-6">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/20">
              <Zap className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">Plano Pro</h2>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] uppercase tracking-widest">Ativo</Badge>
              </div>
              <p className="text-zinc-400 text-sm mt-0.5">Próxima cobrança em <strong className="text-white">15 Jun 2025</strong> · R$ 397,00</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/[0.08]">
              <Receipt className="h-4 w-4 mr-2" />
              Gerenciar Pagamento
            </Button>
          </div>
        </div>
      </div>

      {/* ── Usage Stats ─── */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-xl shadow-2xl p-6">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          Uso do Plano (Mai 2025)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {USAGE.map(item => (
            <div key={item.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs text-zinc-400">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {item.value.toLocaleString('pt-BR')}{item.max ? ` / ${item.max.toLocaleString('pt-BR')}` : ''}
                </span>
              </div>
              {item.max && (
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', item.color)}
                    style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Plans ─── */}
      <div>
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-400" />
          Planos Disponíveis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={cn(
                'relative rounded-2xl border backdrop-blur-xl shadow-xl p-5 flex flex-col transition-all duration-200',
                plan.accent,
                plan.current && 'ring-1 ring-emerald-500/40'
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-emerald-500 text-black font-bold text-[10px] px-3 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={cn('p-2 rounded-xl bg-gradient-to-br opacity-20 absolute')} />
                <plan.icon className="h-5 w-5 text-white relative" />
                <div>
                  <p className="text-white font-bold text-sm">{plan.name}</p>
                  <p className="text-zinc-500 text-xs">{plan.description}</p>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-2xl font-black text-white tracking-tight">{plan.price}</span>
                <span className="text-zinc-500 text-xs">{plan.period}</span>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-zinc-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.current ? (
                <Button disabled variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 w-full">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Plano Atual
                </Button>
              ) : (
                <Button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading === plan.id}
                  className="w-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white"
                >
                  {upgrading === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Upgrade <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Invoice History ─── */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-xl shadow-2xl p-6">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-zinc-400" />
          Histórico de Faturas
        </h3>
        <div className="space-y-2">
          {INVOICES.map(inv => (
            <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-white/5">
                  <Receipt className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{inv.id}</p>
                  <p className="text-xs text-zinc-500">{inv.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-white font-semibold">{inv.amount}</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">{inv.status}</Badge>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-white px-2">
                  PDF
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-400">
            Para cancelar ou solicitar reembolso, entre em contato com nosso{' '}
            <span className="text-emerald-400 cursor-pointer hover:underline">suporte</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
