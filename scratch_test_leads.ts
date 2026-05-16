import 'dotenv/config';
import { db } from './src/lib/db';
import { kanbanLeads, contacts } from './src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function test() {
    try {
        console.log('Testing query leads...');
        const boardId = '2496b926-6cfd-4634-8bb0-a1a3e9a95c67';
        
        const leadsData = await db
            .select({
                id: kanbanLeads.id,
                stageId: kanbanLeads.stageId,
                title: kanbanLeads.title,
                value: kanbanLeads.value,
                notes: kanbanLeads.notes,
                priority: kanbanLeads.priority,
                source: kanbanLeads.source,
                lostReason: kanbanLeads.lostReason,
                winDate: kanbanLeads.winDate,
                lossDate: kanbanLeads.lossDate,
                createdAt: kanbanLeads.createdAt,
                updatedAt: kanbanLeads.updatedAt,
                contact: {
                    id: contacts.id,
                    name: contacts.name,
                    phone: contacts.phone,
                    email: contacts.email,
                    profilePicUrl: contacts.profilePicUrl,
                }
            })
            .from(kanbanLeads)
            .leftJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
            .where(eq(kanbanLeads.boardId, boardId))
            .orderBy(desc(kanbanLeads.createdAt))
            .limit(10);
            
        console.log('Query successful! Row count:', leadsData.length);
    } catch (e: any) {
        console.error('Query failed:', e.message);
    }
    process.exit(0);
}
test();
