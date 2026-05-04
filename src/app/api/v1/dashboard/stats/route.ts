// src/app/api/v1/dashboard/stats/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCompanyIdFromSession } from '@/app/actions';
import { and, count, eq, sql, desc, gte, inArray } from 'drizzle-orm';
import { kanbanLeads, contacts, whatsappDeliveryReports, smsDeliveryReports, conversations, users, kanbanBoards, campaigns } from '@/lib/db/schema';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { searchParams } = new URL(request.url);
        
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        const endDate = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(new Date());
        const startDate = startDateParam ? startOfDay(new Date(startDateParam)) : startOfDay(subDays(endDate, 30));
        
        const cacheKey = `dashboard-stats:${companyId}:${startDate.toISOString()}:${endDate.toISOString()}`;
        
        const stats = await getCachedOrFetch(cacheKey, async () => {

        const dateRangeFilter = gte(kanbanLeads.createdAt, startDate);

        const companyCampaignsSubquery = db
            .select({ id: campaigns.id })
            .from(campaigns)
            .where(eq(campaigns.companyId, companyId));

        const [
            totalLeadsResults,
            totalContactsResults,
            pendingConversationsResults,
            totalWhatsappSentResults,
            totalSmsSentResults,
            agentPerformance
        ] = await Promise.all([
            db.select({
                value: sql<string>`sum(${kanbanLeads.value})`.mapWith(Number),
            })
            .from(kanbanLeads)
            .innerJoin(kanbanBoards, eq(kanbanLeads.boardId, kanbanBoards.id))
            .where(and(
                eq(kanbanBoards.companyId, companyId),
                dateRangeFilter
            )),

            db.select({ count: count() })
                .from(contacts)
                .where(and(eq(contacts.companyId, companyId), gte(contacts.createdAt, startDate))),

            db.select({ count: count() })
                .from(conversations)
                .where(and(
                    eq(conversations.companyId, companyId), 
                    eq(conversations.status, 'NEW'),
                    gte(conversations.createdAt, startDate)
                )),

            db.select({ count: count() })
                .from(whatsappDeliveryReports)
                .where(and(
                    inArray(whatsappDeliveryReports.campaignId, companyCampaignsSubquery), 
                    gte(whatsappDeliveryReports.sentAt, startDate)
                )),

            db.select({ count: count() })
                .from(smsDeliveryReports)
                .where(and(
                    inArray(smsDeliveryReports.campaignId, companyCampaignsSubquery), 
                    gte(smsDeliveryReports.sentAt, startDate)
                )),

            db.select({
                id: users.id,
                name: users.name,
                avatarUrl: users.avatarUrl,
                resolved: sql<number>`count(${conversations.id})::int`,
            })
            .from(users)
            .leftJoin(conversations, and(
                eq(conversations.assignedTo, users.id),
                eq(conversations.status, 'RESOLVED'),
                eq(conversations.companyId, companyId),
                gte(conversations.updatedAt, startDate)
            ))
            .where(and(
                eq(users.companyId, companyId),
                eq(users.role, 'atendente')
            ))
            .groupBy(users.id, users.name, users.avatarUrl)
            .orderBy(desc(sql<number>`count(${conversations.id})::int`))
        ]);

        const totalLeadsResult = totalLeadsResults[0];
        const totalContactsResult = totalContactsResults[0];
        const pendingConversationsResult = pendingConversationsResults[0];
        const totalWhatsappSentResult = totalWhatsappSentResults[0];
        const totalSmsSentResult = totalSmsSentResults[0];
            
        return {
            totalLeadValue: totalLeadsResult?.value || 0,
            totalContacts: totalContactsResult?.count || 0,
            totalMessagesSent: (totalWhatsappSentResult?.count || 0) + (totalSmsSentResult?.count || 0),
            totalWhatsappSent: totalWhatsappSentResult?.count || 0,
            totalSmsSent: totalSmsSentResult?.count || 0,
            pendingConversations: pendingConversationsResult?.count || 0,
            agentPerformance,
        };
        }, CacheTTL.MEDIUM);

        return NextResponse.json(stats);

    } catch (error) {
        console.error("Erro ao buscar estatísticas do dashboard:", error);
        return NextResponse.json({ error: (error as Error).message, details: (error as Error).stack }, { status: 500 });
    }
}
