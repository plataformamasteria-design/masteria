'use client';

import React, { memo } from 'react';
import { NodePropsV4 } from './types';
import { Position } from '@xyflow/react';
import {
    Zap, MessageSquare, Globe, CreditCard, ShoppingBag,
    UserPlus, Tag, Terminal, Clock, Send,
} from 'lucide-react';
import { BaseNode, type NodeColorKey } from './base/BaseNode';
import { NodeHandle } from './base/NodeHandle';

// ─── Config por tipo de trigger ──────────────────────────────────────────────
const TRIGGER_MAP: Record<string, {
    icon: React.ElementType;
    label: string;
    color: NodeColorKey;
    badge: string;
}> = {
    message_received: { icon: MessageSquare, label: 'Qualquer Mensagem',     color: 'blue',   badge: 'WhatsApp' },
    keyword:          { icon: MessageSquare, label: 'Palavra-chave',         color: 'indigo', badge: 'Keyword'  },
    webhook:          { icon: Globe,         label: 'Webhook Externo',       color: 'teal',   badge: 'HTTP'     },
    webhook_pix:      { icon: CreditCard,    label: 'PIX Recebido',          color: 'green',  badge: 'PIX'      },
    webhook_sale:     { icon: ShoppingBag,   label: 'Venda Realizada',       color: 'violet', badge: 'Sale'     },
    contact_created:  { icon: UserPlus,      label: 'Novo Contato',          color: 'cyan',   badge: 'CRM'      },
    contact_tag_added:{ icon: Tag,           label: 'Tag Adicionada',        color: 'amber',  badge: 'CRM'      },
    lead_assigned:    { icon: UserPlus,      label: 'Lead Atribuído',        color: 'cyan',   badge: 'CRM'      },
    campaign_dispatched:{ icon: Send,        label: 'Disparo de Campanha',   color: 'emerald',badge: 'Campaign' },
    manual:           { icon: Terminal,      label: 'Ativação Manual (API)', color: 'zinc',   badge: 'API'      },
    schedule:         { icon: Clock,         label: 'Agendamento',           color: 'rose',   badge: 'Cron'     },
};

const DEFAULT_TRIGGER = { icon: Zap, label: 'Configurar Gatilho', color: 'amber' as NodeColorKey, badge: 'Trigger' };

// ─── Componente ──────────────────────────────────────────────────────────────
export const TriggerNodeV4 = memo(({ data, selected }: NodePropsV4) => {
    const triggerType = data.triggerType || '';
    const cfg = TRIGGER_MAP[triggerType] ?? DEFAULT_TRIGGER;
    const TriggerIcon = cfg.icon;

    // Label dinâmico
    let displayLabel = data.label || cfg.label;
    if (triggerType === 'keyword' && data.keyword) {
        displayLabel = `"${data.keyword}"`;
    } else if (triggerType === 'message_received') {
        const cat = data.message_category || 'general';
        if (cat === 'connection') {
            displayLabel = `Mensagem (Conexão Específica)`;
        } else if (cat === 'funnel_stage') {
            displayLabel = `Mensagem (Etapa de Funil)`;
        } else if (cat === 'tag') {
            displayLabel = `Mensagem (Tag: ${data.filter_tag || '?'})`;
        } else if (cat === 'assigned') {
            displayLabel = `Mensagem (Atribuído)`;
        } else if (data.keyword) {
            displayLabel = `Mensagem: "${data.keyword}"`;
        } else {
            displayLabel = 'Qualquer Mensagem';
        }
    }

    const headerExtra = (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400`}>
            {cfg.badge}
        </span>
    );

    const footer = (
        <div className={`flex justify-center py-3 relative ${triggerType === 'campaign_dispatched' ? 'w-full h-10 border-t border-zinc-100 dark:border-zinc-800/80 mt-2' : ''}`}>
            {triggerType === 'campaign_dispatched' ? (
                <>
                    <div className="absolute inset-0 flex justify-around items-center pt-2 w-full">
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold tracking-widest uppercase">Respondeu</span>
                        <span className="text-[9px] text-orange-500 font-semibold tracking-widest uppercase">Timeout</span>
                    </div>
                    <NodeHandle type="source" position={Position.Bottom} id="respondeu" semantic colIndex={0} colTotal={2} />
                    <NodeHandle type="source" position={Position.Bottom} id="timeout" semantic colIndex={1} colTotal={2} />
                </>
            ) : (
                <>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-400 font-semibold tracking-widest uppercase mt-1">Início do Fluxo</span>
                    <NodeHandle
                        type="source"
                        position={Position.Bottom}
                        accentColor={cfg.color}
                    />
                </>
            )}
        </div>
    );

    return (
        <BaseNode
            selected={selected}
            accentColor={cfg.color}
            icon={TriggerIcon}
            category="Ponto de Entrada"
            label={displayLabel}
            onDelete={data.onDelete}
            onDuplicate={data.onDuplicate}
            onLabelChange={data.onLabelChange}
            headerExtra={headerExtra}
            footer={footer}
        >
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${triggerType ? 'bg-green-400' : 'bg-zinc-300 dark:bg-zinc-700'} shrink-0`} />
                <span className="text-[12px] text-zinc-600 dark:text-zinc-300 font-medium truncate">
                    {triggerType ? cfg.label : 'Nenhum gatilho selecionado'}
                </span>
            </div>
            {/* Handle target oculto — triggers não têm entrada mas precisam para compatibilidade */}
            <NodeHandle type="target" position={Position.Top} accentColor={cfg.color} />
        </BaseNode>
    );
});

TriggerNodeV4.displayName = 'TriggerNodeV4';
