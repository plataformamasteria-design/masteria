
import { db } from '../lib/db';
import { campaigns, whatsappDeliveryReports, messages, conversations, automationLogs, contacts, connections, webhookLogs } from '../lib/db/schema';
import { eq, like, desc, inArray } from 'drizzle-orm';
import * as fs from 'fs';

async function diagnose() {
    const results: any = {};

    // 1. Campaign Investigation
    const campaignId = '8cb7b49b-40dd-4b9d-869a-b690db3cb2c2';
    try {
        const camp = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
        results.campaign = camp;

        results.deliveryReports = await db.select()
            .from(whatsappDeliveryReports)
            .where(eq(whatsappDeliveryReports.campaignId, campaignId))
            .orderBy(desc(whatsappDeliveryReports.sentAt))
            .limit(20);
    } catch (e) { results.errCampaign = (e as Error).message; }

    // 2. Connection Investigation
    const connectionId = '285d2fbf-d210-457b-8126-bf6045bd29e7';
    try {
        const conn = await db.select().from(connections).where(eq(connections.id, connectionId));
        results.connection = conn;
    } catch (e) { results.errConn = (e as Error).message; }

    // 3. Webhook Logs
    try {
        const logs = await db.select().from(webhookLogs)
            .orderBy(desc(webhookLogs.createdAt))
            .limit(20);
        results.recentWebhookLogs = logs;
    } catch (e) { results.errLogs = (e as Error).message; }

    // 4. Contact/Conversation check for 556499526870
    const phone = '556499526870';
    try {
        const findContacts = await db.select().from(contacts).where(like(contacts.phone, `%${phone}%`));
        results.findContacts = findContacts;

        if (findContacts.length > 0) {
            const contactIds = findContacts.map(c => c.id);
            results.findConversations = await db.select().from(conversations).where(
                inArray(conversations.contactId, contactIds)
            );

            if (results.findConversations.length > 0) {
                const convoIds = results.findConversations.map((c: any) => c.id);
                results.findMessages = await db.select().from(messages).where(
                    inArray(messages.conversationId, convoIds)
                ).orderBy(desc(messages.sentAt)).limit(20);
            }
        }
    } catch (e) { results.errContactSearch = (e as Error).message; }

    // 5. Automation logs (Simplified query)
    try {
        results.recentAutomationLogs = await db.select().from(automationLogs)
            .orderBy(desc(automationLogs.createdAt))
            .limit(50);
    } catch (e) { results.errAutomation = (e as Error).message; }

    fs.writeFileSync('deep_diag_results.json', JSON.stringify(results, null, 2));
    console.log('Results written to deep_diag_results.json');
    process.exit(0);
}

diagnose().catch(err => { console.error(err); process.exit(1); });
