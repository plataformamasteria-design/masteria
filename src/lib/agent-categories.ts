// src/lib/agent-categories.ts
// Definições de categorias de agentes IA por função

export const AGENT_TYPES = {
    GENERAL: 'GENERAL',
    ATENDIMENTO: 'ATENDIMENTO',
    SDR: 'SDR',
    VENDAS: 'VENDAS',
    ONBOARDING: 'ONBOARDING',
    RELATOR: 'RELATOR',
} as const;

export type AgentType = (typeof AGENT_TYPES)[keyof typeof AGENT_TYPES];

// Lista ordenada para uso em selects
export const AGENT_TYPE_LIST = Object.values(AGENT_TYPES);

export interface AgentTypeConfig {
    label: string;
    description: string;
    icon: string; // lucide icon name
    badgeColor: string;
    badgeBg: string;
    /** Quais tabs mostrar no editor */
    tabs: {
        behavior: boolean;
        sales: boolean;
        resources: boolean;
    };
}

export const AGENT_TYPE_CONFIG: Record<AgentType, AgentTypeConfig> = {
    GENERAL: {
        label: 'Uso Geral',
        description: 'Agente completo com acesso a todas as configurações.',
        icon: 'Bot',
        badgeColor: 'text-white',
        badgeBg: 'bg-slate-600',
        tabs: { behavior: true, sales: true, resources: true },
    },
    ATENDIMENTO: {
        label: 'Atendimento + Qualificação',
        description: 'Recebe leads passivos, qualifica e encaminha. Ideal para primeiro contato.',
        icon: 'Headphones',
        badgeColor: 'text-white',
        badgeBg: 'bg-blue-600',
        tabs: { behavior: true, sales: false, resources: true },
    },
    SDR: {
        label: 'SDR + Qualificação',
        description: 'Prospecção ativa, qualificação de leads e agendamento de reuniões.',
        icon: 'Target',
        badgeColor: 'text-white',
        badgeBg: 'bg-purple-600',
        tabs: { behavior: true, sales: true, resources: true },
    },
    VENDAS: {
        label: 'Vendas',
        description: 'Focado em fechamento, negociação e conversão.',
        icon: 'TrendingUp',
        badgeColor: 'text-white',
        badgeBg: 'bg-green-600',
        tabs: { behavior: true, sales: true, resources: true },
    },
    ONBOARDING: {
        label: 'Onboarding / Pós-Vendas',
        description: 'Acolhimento, orientação e acompanhamento pós-venda.',
        icon: 'UserCheck',
        badgeColor: 'text-white',
        badgeBg: 'bg-amber-600',
        tabs: { behavior: true, sales: false, resources: true },
    },
    RELATOR: {
        label: 'Relator / Analista de Dados',
        description: 'Analisa dados e emite relatórios a partir de fontes externas.',
        icon: 'BarChart3',
        badgeColor: 'text-white',
        badgeBg: 'bg-cyan-600',
        tabs: { behavior: true, sales: false, resources: true },
    },
};

/**
 * Helper para obter config de um tipo de agente com fallback seguro para GENERAL
 */
export function getAgentTypeConfig(agentType: string | null | undefined): AgentTypeConfig {
    const type = (agentType || 'GENERAL') as AgentType;
    return AGENT_TYPE_CONFIG[type] || AGENT_TYPE_CONFIG.GENERAL;
}
