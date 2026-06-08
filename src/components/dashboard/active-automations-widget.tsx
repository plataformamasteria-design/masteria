'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, ArrowRight, Play, Circle } from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  isActive: boolean;
  triggerEvent: string;
  actions: Array<{ type: string; value?: string }>;
  conditions: Array<{ type: string }>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  send_message: 'Enviar Mensagem',
  send_message_apicloud: 'Msg Cloud API',
  send_message_baileys: 'Msg WhatsApp',
  add_tag: 'Adicionar Tag',
  assign_user: 'Atribuir Usuário',
  add_to_list: 'Adicionar à Lista',
};

const TRIGGER_LABELS: Record<string, string> = {
  new_message: 'Nova Mensagem',
  new_lead: 'Novo Lead',
  tag_added: 'Tag Adicionada',
  conversation_resolved: 'Conversa Resolvida',
  conversation_new: 'Nova Conversa',
};

export function ActiveAutomationsWidget() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRules = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/automations');
        if (res.ok) {
          const data = await res.json();
          setRules(Array.isArray(data) ? data : []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  const activeRules = rules.filter(r => r.isActive);
  const totalRules = rules.length;

  return (
    <div className="glass-card p-6 h-full flex flex-col gap-4 animate-fade-slide-up stagger-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="label-kpi">Automações</p>
            <p className="text-foreground dark:text-white font-semibold text-sm mt-0.5">Regras Configuradas</p>
          </div>
        </div>
        <Link href="/automacoes" className="flex items-center gap-1 text-xs text-muted-foreground dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">
          Ver <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 p-3 text-center">
          <p className="text-2xl font-black font-outfit text-foreground dark:text-white">{loading ? '—' : totalRules}</p>
          <p className="text-xs text-muted-foreground dark:text-zinc-500 mt-0.5">Total criadas</p>
        </div>
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-center">
          <p className="text-2xl font-black font-outfit text-emerald-500 dark:text-emerald-400">{loading ? '—' : activeRules.length}</p>
          <p className="text-xs text-muted-foreground dark:text-zinc-500 mt-0.5">Ativas</p>
        </div>
      </div>

      {/* Active automation nodes */}
      <div className="flex-1 min-h-0">
        <p className="text-xs text-zinc-500 dark:text-zinc-600 font-semibold mb-2 tracking-wide uppercase">Automações Ativas</p>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse mb-2" />
          ))
        ) : activeRules.length > 0 ? (
          <div className="space-y-2 max-h-[280px] overflow-y-auto premium-scrollbar pr-1">
            {activeRules.map(rule => (
              <div
                key={rule.id}
                className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-3 space-y-2"
              >
                {/* Rule name + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Circle className="h-2 w-2 text-emerald-400 fill-emerald-400 shrink-0 animate-pulse" />
                    <p className="text-xs font-semibold text-foreground dark:text-white truncate">{rule.name}</p>
                  </div>
                  <Link
                    href={`/automacoes/${rule.id}`}
                    className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-0.5 transition-colors"
                    title="Abrir editor de fluxo"
                  >
                    <Play className="h-2.5 w-2.5" />
                    Editar
                  </Link>
                </div>

                {/* Trigger + actions as nodes */}
                <div className="flex flex-wrap gap-1.5">
                  {/* Trigger node */}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/15 text-blue-400">
                    ⚡ {TRIGGER_LABELS[rule.triggerEvent] || rule.triggerEvent}
                  </span>
                  {/* Action nodes (max 3) */}
                  {rule.actions.slice(0, 3).map((action, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/15 text-zinc-400">
                      {ACTION_LABELS[action.type] || action.type}
                    </span>
                  ))}
                  {rule.actions.length > 3 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/15 text-zinc-500">
                      +{rule.actions.length - 3} ações
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-600 mb-2">Nenhuma automação ativa</p>
            <Link
              href="/automacoes"
              className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Criar automação →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
