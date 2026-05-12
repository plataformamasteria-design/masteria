import { db } from '@/lib/db';
import { contactEvents } from '@/lib/db/schema';
import { emitToCompany } from '@/lib/socket';

export async function logContactEvent(
    companyId: string, 
    contactId: string, 
    type: 'ASSIGNMENT' | 'TAG' | 'KANBAN' | 'AUTOMATION' | 'SYSTEM', 
    description: string, 
    metadata?: any
) {
    try {
        const [event] = await db.insert(contactEvents).values({
            companyId,
            contactId,
            type,
            description,
            metadata: metadata || {}
        }).returning();

        emitToCompany(companyId, 'contact:event', { contactId, event });
        return event;
    } catch (error) {
        console.error('[logContactEvent] Erro ao registrar evento no histórico:', error);
        return null;
    }
}
