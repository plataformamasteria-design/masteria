import { NodeHandler } from './types';
import { CRMNodeHandler } from './crm.node';
import { AINodeHandler } from './ai.node';
import { ConditionNodeHandler } from './condition.node';
import { HttpNodeHandler } from './http.node';

export class NodeRegistry {
    private static handlers: Map<string, NodeHandler> = new Map();

    static {
        // Register CRM Nodes
        const crmHandler = new CRMNodeHandler();
        this.handlers.set('crm_move', crmHandler);
        this.handlers.set('crm', crmHandler);
        this.handlers.set('assign_connection', crmHandler);
        this.handlers.set('assign_user', crmHandler);
        this.handlers.set('add_tag', crmHandler);
        this.handlers.set('remove_tag', crmHandler);

        // Register AI Nodes
        const aiHandler = new AINodeHandler();
        this.handlers.set('ai_copilot', aiHandler);
        this.handlers.set('ai_agent', aiHandler);
        this.handlers.set('ai', aiHandler);
        this.handlers.set('follow_up_ai', aiHandler);
        this.handlers.set('intent_router', aiHandler);
        this.handlers.set('send_ai_response', aiHandler);

        // Register Condition/Logic Nodes
        const conditionHandler = new ConditionNodeHandler();
        this.handlers.set('condition', conditionHandler);
        this.handlers.set('logic', conditionHandler);
        this.handlers.set('filter', conditionHandler);
        this.handlers.set('router', conditionHandler);

        // Register HTTP Node
        const httpHandler = new HttpNodeHandler();
        this.handlers.set('http_request', httpHandler);
    }

    static getHandler(type: string): NodeHandler | undefined {
        return this.handlers.get(type);
    }
}
