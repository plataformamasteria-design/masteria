import { Conversation, Message } from '@/lib/types';

const API_BASE = '/api/v1/conversations';

export interface AdvancedFilters {
    onlyUnread: boolean;
    awaitingResponse: boolean;
    robotService: boolean;
    filterTeamId: string | null;
    filterAgentId: string | null;
    filterTagId: string | null;
    filterKanbanId: string | null;
    filterConnectionId?: string | null;
    filterSource?: string | null;
    showOtherConnections?: boolean;
}

class ConversationService {
    private async fetchCall<T>(url: string, options?: RequestInit): Promise<T> {
        const res = await fetch(url, options);
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || 'Erro na requisição');
        }
        return res.json();
    }

    async list(offset = 0, limit = 50, search = '', filter = 'all', advancedFilters?: AdvancedFilters, bypassCache = false): Promise<Conversation[]> {
        const params = new URLSearchParams({
            offset: String(offset),
            limit: String(limit),
        });
        if (search) params.set('search', search);
        if (filter !== 'all') params.set('filter', filter);
        if (bypassCache) params.set('t', Date.now().toString());

        // Enviar filtros avançados como query params
        if (advancedFilters) {
            if (advancedFilters.onlyUnread) params.set('onlyUnread', 'true');
            if (advancedFilters.awaitingResponse) params.set('awaitingResponse', 'true');
            if (advancedFilters.robotService) params.set('robotService', 'true');
            if (advancedFilters.filterTeamId) params.set('filterTeamId', advancedFilters.filterTeamId);
            if (advancedFilters.filterAgentId) params.set('filterAgentId', advancedFilters.filterAgentId);
            if (advancedFilters.filterTagId) params.set('filterTagId', advancedFilters.filterTagId);
            if (advancedFilters.filterKanbanId) params.set('filterKanbanId', advancedFilters.filterKanbanId);
            if (advancedFilters.filterConnectionId) params.set('filterConnectionId', advancedFilters.filterConnectionId);
            if (advancedFilters.filterSource) params.set('filterSource', advancedFilters.filterSource);
        }

        const response = await this.fetchCall<{ data: Conversation[] } | Conversation[]>(`${API_BASE}?${params}`);
        return Array.isArray(response) ? response : response.data;
    }

    async getMessages(conversationId: string, limit = 50, before?: string, bypassCache = false, connectionId?: string): Promise<{ messages: Message[]; hasMore: boolean }> {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) params.set('before', before);
        if (bypassCache) params.set('t', Date.now().toString());
        if (connectionId) params.set('connectionId', connectionId);

        const response = await this.fetchCall<{ messages: Message[]; hasMore: boolean } | Message[]>(
            `${API_BASE}/${conversationId}/messages?${params}`
        );

        if (Array.isArray(response)) {
            return { messages: response, hasMore: response.length === limit };
        }
        return response;
    }

    async sendMessage(conversationId: string, text: string): Promise<Message> {
        return this.fetchCall<Message>(`${API_BASE}/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'text', text }),
        });
    }

    async toggleAi(conversationId: string, aiActive: boolean): Promise<void> {
        await this.fetchCall(`${API_BASE}/${conversationId}/toggle-ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aiActive }),
        });
    }

    async archive(conversationId: string): Promise<void> {
        await this.fetchCall(`${API_BASE}/${conversationId}/archive`, { method: 'POST' });
    }

    async unarchive(conversationId: string): Promise<Conversation> {
        return this.fetchCall<Conversation>(`${API_BASE}/${conversationId}/archive`, { method: 'DELETE' });
    }

    async getStatus(t?: string): Promise<{ lastUpdated: string | null }> {
        const query = t ? `?t=${t}` : '';
        return this.fetchCall<{ lastUpdated: string | null }>(`${API_BASE}/status${query}`);
    }
}

export const conversationService = new ConversationService();
