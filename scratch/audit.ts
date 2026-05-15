import { db } from '../src/lib/db/index';
import { companies, contacts, conversations, messages } from '../src/lib/db/schema';
import { ilike, eq, and, gte, desc } from 'drizzle-orm';
import fs from 'fs';

async function main() {
    try {
        console.log("Finding company...");
        const company = await db.query.companies.findFirst({
            where: ilike(companies.name, '%Henrique Felipe Alves%')
        });

        if (!company) {
            console.log("Company not found.");
            process.exit(1);
        }

        console.log(`Found company: ${company.name} (${company.id})`);

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const msgs = await db.select({
            contactId: contacts.id,
            contactName: contacts.name,
            contactPhone: contacts.phone,
            conversationId: conversations.id,
            messageId: messages.id,
            content: messages.content,
            senderType: messages.senderType,
            sentAt: messages.sentAt,
            isAiGenerated: messages.isAiGenerated
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(
            and(
                eq(messages.companyId, company.id),
                gte(messages.sentAt, threeDaysAgo)
            )
        )
        .orderBy(desc(contacts.id), messages.sentAt);

        console.log(`Found ${msgs.length} messages.`);
        
        // Group by contact
        const conversationsByContact = {};
        for (const msg of msgs) {
            if (!conversationsByContact[msg.contactName]) {
                conversationsByContact[msg.contactName] = {
                    phone: msg.contactPhone,
                    messages: []
                };
            }
            conversationsByContact[msg.contactName].messages.push({
                sender: msg.senderType,
                content: msg.content,
                sentAt: msg.sentAt,
                isAi: msg.isAiGenerated
            });
        }

        fs.writeFileSync('./scratch/audit-results.json', JSON.stringify(conversationsByContact, null, 2));
        console.log("Saved to scratch/audit-results.json");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
