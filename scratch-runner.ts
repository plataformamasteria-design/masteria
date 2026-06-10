import { db } from './src/lib/db';
import { companies, automationFlows, campaigns, whatsappDeliveryReports, contacts, conversations, automationFlowExecutions, messages } from './src/lib/db/schema';
import { eq, ilike, and, desc } from 'drizzle-orm';
import { triggerFlow } from './src/lib/flow-engine';
import { sendUnifiedMessage } from './src/services/unified-message-sender.service';

async function main() {
    const company = await db.query.companies.findFirst({
        where: ilike(companies.name, '%Empresa de DEsenvolvimento Master%')
    });
    if (!company) return console.log("Company not found.");

    const campaign = await db.query.campaigns.findFirst({
        where: and(eq(campaigns.companyId, company.id), ilike(campaigns.name, '%sala_fechada_meet%')),
        orderBy: [desc(campaigns.createdAt)]
    });
    if (!campaign) return console.log("Campaign not found.");

    const msgs = await db.select({ contactId: whatsappDeliveryReports.contactId })
        .from(whatsappDeliveryReports)
        .where(eq(whatsappDeliveryReports.campaignId, campaign.id));
        
    const contactIds = [...new Set(msgs.map(m => m.contactId).filter(Boolean))] as string[];
    console.log(`Found ${contactIds.length} unique contacts who received the campaign message.`);

    if (contactIds.length === 0) return;

    const flow = await db.query.automationFlows.findFirst({
        where: and(eq(automationFlows.companyId, company.id), ilike(automationFlows.name, '%SALA SECRETA -ENTRAR%'))
    });
    if (!flow) return console.log("Automation flow 'SALA SECRETA - ENTRAR' not found.");

    const flowMsgContent = "Vou te mandar aqui o link para entrar no Grupo";

    let triggeredCount = 0;
    let activatedCount = 0;
    let forcedMsgCount = 0;

    for (const contactId of contactIds) {
        let activated = false;
        
        const conv = await db.query.conversations.findFirst({
            where: eq(conversations.contactId, contactId),
            orderBy: [desc(conversations.lastMessageAt)]
        });
        
        if (conv && (!conv.isAiActive || conv.status !== 'IN_PROGRESS' || conv.assignedTo)) {
            await db.update(conversations).set({ isAiActive: true, status: 'IN_PROGRESS', assignedTo: null }).where(eq(conversations.id, conv.id));
            activated = true;
        }
        if (activated) activatedCount++;

        const activeExecutions = await db.select()
            .from(automationFlowExecutions)
            .where(and(eq(automationFlowExecutions.flowId, flow.id), eq(automationFlowExecutions.contactId, contactId)));

        const hasExecution = activeExecutions.length > 0;
        
        let messageSent = false;
        if (conv) {
            const flowMsgsSent = await db.query.messages.findFirst({
                where: and(
                    eq(messages.conversationId, conv.id),
                    ilike(messages.content, `%${flowMsgContent}%`)
                )
            });
            if (flowMsgsSent) messageSent = true;
        }

        if (!hasExecution) {
            try {
                await triggerFlow(flow.id, company.id, contactId, { source: 'manual_recovery' });
                triggeredCount++;
            } catch (err: any) { console.log("Error triggering flow:", err.message); }
        } else if (hasExecution && !messageSent && conv) {
            const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, contactId) });
            const contactPhone = contact?.phone;
            if (contactPhone) {
                const messageToSend = "Vou te mandar aqui o link para entrar no Grupo:\n\nhttps://devzapp.com.br/api-engennier/campanha/api/redirect/69f3a65f038f68000115ceca\n";
                try {
                    await sendUnifiedMessage({
                        provider: 'evolution',
                        connectionId: '81994284-e8f0-4a2b-b17b-a9440a0d563a',
                        to: contactPhone,
                        message: messageToSend
                    });
                    if (conv) {
                        await db.insert(messages).values({
                            companyId: company.id,
                            conversationId: conv.id,
                            senderType: 'SYSTEM',
                            content: messageToSend,
                            contentType: 'TEXT',
                            status: 'SENT'
                        });
                    }
                    forcedMsgCount++;
                } catch (e: any) {
                    console.log(`Failed to send to ${contactPhone}: ${e.message}`);
                }
            }
        }
    }
    console.log(`\nDONE!`);
    console.log(`- Bot Activated for: ${activatedCount} leads`);
    console.log(`- Flow Triggered for: ${triggeredCount} leads`);
    console.log(`- Forced Message for: ${forcedMsgCount} leads`);
}
main().then(() => process.exit(0)).catch(console.error);
