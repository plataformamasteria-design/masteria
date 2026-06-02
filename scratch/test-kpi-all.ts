import 'dotenv/config';
import { db } from '../src/lib/db';
import { contacts, kanbanLeads, kanbanBoards, conversations, whatsappDeliveryReports, smsDeliveryReports, campaigns, users } from '../src/lib/db/schema';
import { and, count, eq, gte, inArray, sql, desc } from 'drizzle-orm';
import { startOfDay, subDays } from 'date-fns';

async function main() {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        const startDate = startOfDay(subDays(new Date(), 30));

        const dateRangeFilter = gte(kanbanLeads.createdAt, startDate);

        const companyCampaignsSubquery = db
            .select({ id: campaigns.id })
            .from(campaigns)
            .where(eq(campaigns.companyId, companyId));

        console.log("Executando queries do dashboard em Promise.all...");
        
        const results = await Promise.all([
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
        
        console.log("Sucesso!");
        console.log(results);
    } catch (error) {
        console.error("ERRO DETALHADO:");
        console.error(error);
        if (error.code) console.error("Código Postgres:", error.code);
        if (error.message) console.error("Mensagem:", error.message);
    }
    process.exit(0);
}

main();
