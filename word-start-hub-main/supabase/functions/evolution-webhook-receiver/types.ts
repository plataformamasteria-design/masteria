export interface EvolutionApiConfig {
    url: string;
    apiKey: string;
    instanceName: string;
}

export interface MessageData {
    chatId: string;
    phone: string;
    isGroup: boolean;
    fromMe: boolean;
    messageType: string;
    content: string | null;
    pushName: string | null;
    messageKeyId: string;
    senderPhone?: string | null;
    senderName?: string | null;
    groupName?: string | null;
    evolutionData: any;
}

export type QuotedPreview = {
    text?: string;
    label?: string;
    message_type?: string;
};

export const ALLOWED_INTERNAL_MESSAGE_TYPES = new Set([
  'text', 'audio', 'image', 'pdf', 'video', 'document', 'contact', 'location', 'pix', 'system',
]);
