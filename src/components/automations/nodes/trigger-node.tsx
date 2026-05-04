'use client';

import { Zap, X, MessageSquare, Globe, CreditCard, ShoppingBag, UserPlus, Tag, Terminal, Clock } from 'lucide-react';
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const triggerTypeConfig: Record<string, { icon: any; label: string; color: string; gradient: string }> = {
    message_received: { icon: MessageSquare, label: 'Nova Mensagem', color: 'text-blue-600', gradient: 'from-blue-400 to-blue-600' },
    keyword: { icon: MessageSquare, label: 'Palavra-chave', color: 'text-indigo-600', gradient: 'from-indigo-400 to-indigo-600' },
    webhook: { icon: Globe, label: 'Webhook Externo', color: 'text-teal-600', gradient: 'from-teal-400 to-teal-600' },
    webhook_pix: { icon: CreditCard, label: 'PIX Recebido', color: 'text-green-600', gradient: 'from-green-400 to-green-600' },
    webhook_sale: { icon: ShoppingBag, label: 'Venda Realizada', color: 'text-purple-600', gradient: 'from-purple-400 to-purple-600' },
    contact_created: { icon: UserPlus, label: 'Novo Contato', color: 'text-sky-600', gradient: 'from-sky-400 to-sky-600' },
    contact_tag_added: { icon: Tag, label: 'Tag Adicionada', color: 'text-amber-600', gradient: 'from-amber-400 to-amber-600' },
    manual: { icon: Terminal, label: 'Manual (API)', color: 'text-gray-600', gradient: 'from-gray-400 to-gray-600' },
    schedule: { icon: Clock, label: 'Agendamento', color: 'text-rose-600', gradient: 'from-rose-400 to-rose-600' },
};

const defaultConfig = { icon: Zap, label: 'Configurar Gatilho', color: 'text-amber-600', gradient: 'from-amber-400 to-orange-500' };

export const TriggerNode = memo(({ data, selected }: any) => {
    const triggerType = data.triggerType || '';
    const config = triggerTypeConfig[triggerType] || defaultConfig;
    const TriggerIcon = config.icon;

    // Build display label
    let displayLabel = config.label;
    if (triggerType === 'keyword' && data.keyword) {
        displayLabel = `"${data.keyword}"`;
    } else if (triggerType === 'webhook') {
        displayLabel = 'Webhook Externo';
    } else if (triggerType === 'message_received') {
        displayLabel = data.keyword ? `Mensagem: "${data.keyword}"` : 'Qualquer Mensagem';
    }

    return (
        <div className={`px-6 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl bg-white border ${selected ? 'border-amber-400 shadow-[0_4px_24px_rgba(245,158,11,0.15)]' : 'border-gray-100'} min-w-[280px] animate-in zoom-in duration-200 group/node relative transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]`}>
            {/* Delete button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    data.onDelete?.();
                }}
                className={`absolute -top-3 -right-3 w-7 h-7 bg-white border border-gray-200 rounded-full shadow-md text-gray-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-all z-[100] ${selected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} group-hover/node:scale-100 group-hover/node:opacity-100 active:scale-90`}
            >
                <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 bg-gradient-to-br ${config.gradient} rounded-xl shadow-sm`}>
                    <TriggerIcon className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                    <span className={`block text-[10px] font-semibold ${config.color} uppercase tracking-[0.15em]`}>Ponto de Entrada</span>
                    <span className="text-[13px] font-semibold text-gray-900 tracking-tight">Gatilho Principal</span>
                </div>
            </div>

            <div className="text-[13px] font-medium text-gray-600 bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 flex items-center justify-between">
                <span className="truncate">{data.label || displayLabel}</span>
                <div className={`w-2 h-2 rounded-full ${triggerType ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]' : 'bg-gray-300'}`} />
            </div>

            {/* Webhook URL badge */}
            {triggerType === 'webhook' && (
                <div className="mt-2 text-[10px] text-teal-500 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 truncate font-mono">
                    POST /webhook-trigger/...
                </div>
            )}

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-amber-400 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 shadow-lg !-bottom-2 z-50 transition-transform hover:scale-125"
            />
        </div>
    );
});

TriggerNode.displayName = 'TriggerNode';
