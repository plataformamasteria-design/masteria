// src/app/api/v1/conversations/status/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

// GET /api/v1/conversations/status
// Retorna o timestamp da última mensagem de uma empresa para verificação de atualizações.
// OTIMIZAÇÃO: TTL de 2.5s para garantir cache hits com polling de 5s
// Índice utilizado: idx_conversations_company_lastmsg (company_id, last_message_at DESC)
export async function GET() {
    const startTime = Date.now();
    
    try {
        const companyId = await getCompanyIdFromSession();
        
        const cacheKey = `conversations:status:${companyId}`;
        const result = await getCachedOrFetch(cacheKey, async () => {
            const [latestUpdate] = await db
                .select({ time: conversations.updatedAt })
                .from(conversations)
                .where(eq(conversations.companyId, companyId))
                .orderBy(desc(conversations.updatedAt))
                .limit(1);

            const [latestMessage] = await db
                .select({ time: conversations.lastMessageAt })
                .from(conversations)
                .where(eq(conversations.companyId, companyId))
                .orderBy(desc(conversations.lastMessageAt))
                .limit(1);

            const time1 = latestUpdate?.time ? new Date(latestUpdate.time).getTime() : 0;
            const time2 = latestMessage?.time ? new Date(latestMessage.time).getTime() : 0;
            let finalTime = null;
            if (time1 > 0 || time2 > 0) {
                 finalTime = time1 > time2 ? new Date(time1) : new Date(time2);
            }
            
            return { lastUpdated: finalTime ? finalTime.toISOString() : null };
        }, CacheTTL.STATUS_POLLING);
        
        const totalTime = Date.now() - startTime;
        
        const response = NextResponse.json(result);
        response.headers.set('X-Response-Time', `${totalTime}ms`);
        response.headers.set('Cache-Control', 'private, max-age=2');
        
        return response;

    } catch (error) {
        if (error instanceof Error && error.message.includes("Não autorizado")) {
             return NextResponse.json({ error: error.message }, { status: 401 });
        }
        console.error('[Conversations Status] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
