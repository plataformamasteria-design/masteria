// src/lib/quotas.ts
import { db } from './db';
import { companyQuotas } from './db/schema';
import { eq, sql } from 'drizzle-orm';

export type QuotaType = 'messages' | 'contacts' | 'ai_tokens' | 'connections';

export class QuotaService {
    /**
     * Gets or creates default quotas for a company
     */
    static async getOrCreateQuotas(companyId: string) {
        const [quotas] = await db
            .select()
            .from(companyQuotas)
            .where(eq(companyQuotas.companyId, companyId))
            .limit(1);

        if (quotas) return quotas;

        // Create default quotas
        const [newQuotas] = await db
            .insert(companyQuotas)
            .values({
                companyId,
                maxMessagesPerMonth: 1000,
                maxContacts: 500,
                maxAiTokens: 100000,
                maxConnections: 5,
            })
            .returning();

        if (!newQuotas) throw new Error('Failed to create quotas');
        return newQuotas;
    }

    /**
     * Checks if a company has enough quota for an action
     */
    static async checkQuota(companyId: string, type: QuotaType, amount: number = 1): Promise<{ success: boolean; message?: string }> {
        const quotas = await this.getOrCreateQuotas(companyId);

        switch (type) {
            case 'messages':
                if (quotas.currentMessagesMonth + amount > quotas.maxMessagesPerMonth) {
                    return { success: false, message: 'Quota de mensagens mensal excedida.' };
                }
                break;
            case 'ai_tokens':
                if (quotas.currentAiTokensMonth + amount > quotas.maxAiTokens) {
                    return { success: false, message: 'Quota de tokens de IA mensal excedida.' };
                }
                break;
            case 'contacts': {
                // For contacts, we usually check total count in contacts table
                // but we can also use the cached value if we keep it updated.
                // For v0.1, let's use the cached value.
                const [countResult] = await db.execute(sql`SELECT COUNT(*) as count FROM contacts WHERE company_id = ${companyId} AND deleted_at IS NULL`);
                const actualCount = countResult ? Number(countResult.count) : 0;
                if (quotas && actualCount + amount > quotas.maxContacts) {
                    return { success: false, message: 'Limite de contatos atingido.' };
                }
                break;
            }
            case 'connections': {
                const [countResult] = await db.execute(sql`SELECT COUNT(*) as count FROM connections WHERE company_id = ${companyId} AND is_active = true`);
                const actualCount = countResult ? Number(countResult.count) : 0;
                if (quotas && actualCount + amount > quotas.maxConnections) {
                    return { success: false, message: 'Limite de conexões ativas atingido.' };
                }
                break;
            }
        }

        return { success: true };
    }

    /**
     * Increments usage for a specific quota type
     */
    static async incrementUsage(companyId: string, type: QuotaType, amount: number = 1) {
        // Ensure record exists
        await this.getOrCreateQuotas(companyId);

        if (type === 'messages') {
            await db.update(companyQuotas)
                .set({ currentMessagesMonth: sql`${companyQuotas.currentMessagesMonth} + ${amount}` })
                .where(eq(companyQuotas.companyId, companyId));
        } else if (type === 'ai_tokens') {
            await db.update(companyQuotas)
                .set({ currentAiTokensMonth: sql`${companyQuotas.currentAiTokensMonth} + ${amount}` })
                .where(eq(companyQuotas.companyId, companyId));
        }
        // Contacts and Connections are derived from table counts, so no need to increment a counter here
    }
}
