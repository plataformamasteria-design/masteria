

import type * as schema from './db/schema';

// ===================================================================
// BASE TYPES (from a single source of truth - schema.ts)
// ===================================================================
export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Company = typeof schema.companies.$inferSelect;
export type NewCompany = typeof schema.companies.$inferInsert;
export type Contact = typeof schema.contacts.$inferSelect;
export type NewContact = typeof schema.contacts.$inferInsert;
export type Tag = typeof schema.tags.$inferSelect;
export type NewTag = typeof schema.tags.$inferInsert;
export type Team = typeof schema.teams.$inferSelect;
export type UserToTeam = typeof schema.usersToTeams.$inferSelect;
export type ContactList = typeof schema.contactLists.$inferSelect & { contactCount?: number };
export type Template = typeof schema.messageTemplates.$inferSelect & {
    connection?: Connection;
    body?: string;
    headerType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null;
    components?: any[];
};
export type MediaAsset = typeof schema.mediaAssets.$inferSelect;
export type SmsGateway = typeof schema.smsGateways.$inferSelect;
export type ApiKey = typeof schema.apiKeys.$inferSelect;
export type Webhook = typeof schema.webhookSubscriptions.$inferSelect;
export type NewWebhook = typeof schema.webhookSubscriptions.$inferInsert;
export type Message = typeof schema.messages.$inferSelect;
export type NewMessage = typeof schema.messages.$inferInsert;
export type Connection = typeof schema.connections.$inferSelect & { status?: 'Conectado' | 'Falha na Conexão' | 'Não Verificado' };
export type AutomationRule = typeof schema.automationRules.$inferSelect;
export type NewAutomationRule = typeof schema.automationRules.$inferInsert;
export type AutomationCondition = schema.AutomationCondition;
export type AutomationAction = schema.AutomationAction;
export type AiCredential = typeof schema.aiCredentials.$inferSelect;
export type AiChat = typeof schema.aiChats.$inferSelect;
export type AiChatMessage = typeof schema.aiChatMessages.$inferSelect;

export type PageProps<T extends object = object> = {
    params: Promise<T>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export type UserWithCompany = Omit<User, 'password'> & {
    company?: Company | null;
};
// ===================================================================
// EXTENDED & COMPOSITE TYPES (for use in components)
// ===================================================================

export type ExtendedContact = Contact & {
    tags?: Tag[];
    lists?: ContactList[];
    activeConversations?: Array<{
        id: string;
        connectionId: string | null;
        connectionName: string | null;
        connectionType: string | null;
        status: string | null;
        lastMessageAt: Date | null;
        aiActive: boolean | null;
    }>;
    funnels?: Array<{
        leadId: string;
        boardId: string;
        boardName: string;
        stageId: string;
        stageName: string;
        boardStages?: any[];
        value: string | number;
    }>;
    automations?: Array<{
        executionId: string;
        flowId: string;
        flowName: string;
        status: string;
        currentStepId?: string | null;
        currentStepLabel?: string | null;
        startedAt: Date | string | null;
        finishedAt: Date | string | null;
    }>;
};

export type Conversation = typeof schema.conversations.$inferSelect & {
    contactName: string;
    contactAvatar: string | null;
    phone: string;
    isGroup?: boolean | null;
    lastMessage: string | null;
    lastMessageStatus: Message['status'];
    lastMessageSenderType?: string | null;
    unreadCount?: number;
    connectionName?: string | null;
    connectionType?: string | null;
    contactActiveConversationsCount?: number | null;
    teamName?: string | null;
    assignedUserName?: string | null;
    tags?: Tag[];
    // CRM Funnel info
    kanbanBoardName?: string | null;
    kanbanStageName?: string | null;
    kanbanStageType?: 'NEUTRAL' | 'WIN' | 'LOSS' | null;
};

export type KanbanFunnel = typeof schema.kanbanBoards.$inferSelect & {
    totalLeads?: number;
    totalValue?: number;
};

export type KanbanCard = typeof schema.kanbanLeads.$inferSelect & {
    contact?: ExtendedContact;
};

export type HeaderType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'TEXT' | 'NONE';

export type Campaign = typeof schema.campaigns.$inferSelect & {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    progress?: number;
    connectionName?: string | null;
    smsGatewayName?: string | null;
    templateName?: string | null;
    templateBody?: string | null;
    templateHeaderType?: HeaderType | null;
};

export type WhatsappDeliveryReport = typeof schema.whatsappDeliveryReports.$inferSelect;
export type SmsDeliveryReport = typeof schema.smsDeliveryReports.$inferSelect;

export type CampaignSend = (WhatsappDeliveryReport | SmsDeliveryReport) & {
    contactName: string;
    contactPhone: string;
};

export interface MetaApiMessageResponse {
    messaging_product: string;
    contacts: {
        input: string;
        wa_id: string;
    }[];
    messages: {
        id: string;
    }[];
}


// Legacy types for compatibility, can be removed later
export type Persona = typeof schema.aiPersonas.$inferSelect;
export type MetaHandle = schema.MetaHandle;
export type KanbanStage = schema.KanbanStage;
export type AgentResource = schema.AgentResource;
