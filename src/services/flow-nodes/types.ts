import { FlowStep } from '@/services/flow-triggers.service';

export interface ExecutionContext {
    executionId: string;
    flowId: string;
    companyId: string;
    contactId: string;
    contactPhone: string;
    contactName: string;
    contactEmail: string;
    contactTags: string[];
    contactNotes: string;
    variables: Record<string, any>;
    connectionId: string;
    provider: string;
    conversationId?: string; // Adicionado para suportar AI Nodes
}

export interface NodeResult {
    action?: 'continue' | 'pause' | 'delay' | 'stop';
    sourceHandle?: string;
    nextNodeIds?: string[];
    newVars?: Record<string, any>;
    delayMs?: number;
    message?: string;
    error?: string; // Adicionado para suportar erros em AI Nodes
}

export interface NodeHandler {
    execute(step: FlowStep, ctx: ExecutionContext, allSteps: FlowStep[]): Promise<NodeResult>;
}
