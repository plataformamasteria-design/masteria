import 'dotenv/config';
import { db } from './src/lib/db';
import { kanbanBoards, kanbanLeads } from './src/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

async function test() {
    try {
        console.log('Testing query...');
        const boardsWithCounts = await db
            .select({
                id: kanbanBoards.id,
                name: kanbanBoards.name,
                stages: kanbanBoards.stages,
                createdAt: kanbanBoards.createdAt,
                companyId: kanbanBoards.companyId,
                totalLeads: sql<number>`count(${kanbanLeads.id})`.mapWith(Number),
                totalValue: sql<number>`sum(${kanbanLeads.value})`.mapWith(Number),
            })
            .from(kanbanBoards)
            .leftJoin(kanbanLeads, eq(kanbanBoards.id, kanbanLeads.boardId))
            // .where(eq(kanbanBoards.companyId, companyId)) // skip company check to test syntax
            .groupBy(kanbanBoards.id)
            .orderBy(desc(kanbanBoards.createdAt));
        
        console.log('Query successful! Row count:', boardsWithCounts.length);
        console.log('First row:', boardsWithCounts[0]);
    } catch (e: any) {
        console.error('Query failed:', e.message);
    }
    process.exit(0);
}
test();
