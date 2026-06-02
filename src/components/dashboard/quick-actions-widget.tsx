'use client';

import Link from 'next/link';
import {
  MessageSquarePlus, UserPlus, KanbanSquare, Zap,
  Send, Bot, BarChart2, Settings, Phone, Tag,
} from 'lucide-react';

const ACTIONS = [
  { label: 'Novo Contato',    icon: UserPlus,          href: '/contacts',     desc: 'Cadastrar lead'    },
  { label: 'Marketing',       icon: BarChart2,         href: '/marketing',    desc: 'Tráfego pago'     },
  { label: 'Automações',      icon: Zap,               href: '/automacoes',   desc: 'Regras ativas'    },
  { label: 'Nova Campanha',   icon: Send,              href: '/campanhas',    desc: 'Disparar mensagens' },
  { label: 'Pipeline',        icon: KanbanSquare,      href: '/kanban',       desc: 'Gestão de funis'  },
];

export function QuickActionsBar() {
  return (
    <div className="glass-card p-4 animate-fade-slide-up stagger-1">
      <p className="label-kpi mb-3">Acesso Rápido</p>
      <div className="flex flex-nowrap overflow-x-auto sm:overflow-visible sm:grid sm:grid-cols-5 gap-2 [&::-webkit-scrollbar]:hidden">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex-1 min-w-[140px] flex items-center gap-2 rounded-xl px-3.5 py-2.5 bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5 hover:border-emerald-500/30 hover:bg-emerald-50 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/5 hover:shadow-sm transition-all duration-150"
          >
            <action.icon className="h-4 w-4 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-150 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground dark:text-white leading-none truncate">{action.label}</p>
              <p className="text-[10px] text-muted-foreground dark:text-zinc-500 mt-1 leading-none truncate">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
