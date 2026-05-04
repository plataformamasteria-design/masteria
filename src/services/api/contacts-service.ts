import { Contact } from '@/lib/types';

const API_BASE = '/api/v1/contacts';

class ContactsService {
    private async fetchCall<T>(url: string, options?: RequestInit): Promise<T> {
        const res = await fetch(url, options);
        if (!res.ok) {
            const errorText = await res.text();
            let errorMessage = 'Erro na requisição';
            try {
                const json = JSON.parse(errorText);
                errorMessage = json.error || json.message || errorMessage;
            } catch (e) { /* ignore */ }
            throw new Error(errorMessage);
        }
        return res.json();
    }

    async list(offset = 0, limit = 20, search = ''): Promise<{ contacts: Contact[]; hasMore: boolean }> {
        const params = new URLSearchParams({
            offset: String(offset),
            limit: String(limit)
        });
        if (search) params.set('search', search);

        return this.fetchCall<{ contacts: Contact[]; hasMore: boolean }>(`${API_BASE}?${params}`);
    }

    async get(id: string): Promise<Contact> {
        return this.fetchCall<Contact>(`${API_BASE}/${id}`);
    }

    async create(data: Partial<Contact>): Promise<Contact> {
        return this.fetchCall<Contact>(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    }

    async update(id: string, data: Partial<Contact>): Promise<Contact> {
        return this.fetchCall<Contact>(`${API_BASE}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    }

    async delete(id: string): Promise<void> {
        await this.fetchCall(`${API_BASE}/${id}`, { method: 'DELETE' });
    }

    async import(csvContent: string): Promise<{ imported: number; errors: any[] }> {
        return this.fetchCall(`${API_BASE}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csvContent })
        });
    }
}

export const contactsService = new ContactsService();
