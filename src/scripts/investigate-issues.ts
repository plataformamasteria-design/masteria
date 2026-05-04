
import { db } from '../lib/db';
import { campaigns, whatsappDeliveryReports, messages, conversations, automationLogs, contacts, connections } from '../lib/db/schema';
import { eq, like, desc, and, sql, or } from 'drizzle-orm';

async function diagnose() {
    console.log('--- DIAGNÓSTICO DE CAMPANHA ---');
    // Procurar por partes do nome para ser mais flexível
    const campaignName = '%pac_2026_ofc_2%';
    const campaignList = await db.select().from(campaigns).where(like(campaigns.name, campaignName)).orderBy(desc(campaigns.createdAt)).limit(5);

    if (campaignList.length === 0) {
        console.log('Campanha não encontrada com o nome:', campaignName);
        // Listar campanhas recentes para ver o que existe
        const recentCampaigns = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(5);
        console.log('Campanhas recentes no banco:', recentCampaigns.map(c => ({ id: c.id, name: c.name })));
    } else {
        for (const campaign of campaignList) {
            console.log(`ID: ${campaign.id} | Nome: ${campaign.name} | Status: ${campaign.status} | Criada em: ${campaign.createdAt}`);

            const reports = await db.select({
                status: whatsappDeliveryReports.status,
                count: sql<number>`count(*)`
            })
                .from(whatsappDeliveryReports)
                .where(eq(whatsappDeliveryReports.campaignId, campaign.id))
                .groupBy(whatsappDeliveryReports.status);

            console.log('Relatórios de entrega:', reports);

            if (reports.length === 0) {
                console.log('Nenhum relatório de entrega encontrado para esta campanha.');
            }
        }
    }

    console.log('\n--- DIAGNÓSTICO DE IA / MENSAGENS RECENTES ---');
    const targetId = '5865391262387407327';

    // 1. Procurar em Connections (phoneNumberId ou wabaId)
    const connResults = await db.select().from(connections).where(
        or(
            eq(connections.phoneNumberId, targetId),
            eq(connections.wabaId, targetId)
        )
    );
    console.log('Conexões encontradas com este ID:', connResults.map(c => ({ id: c.id, name: c.config_name, type: c.connectionType, status: c.status })));

    // 2. Procurar em Contatos
    const contactList = await db.select().from(contacts).where(
        or(
            eq(contacts.phone, targetId),
            eq(contacts.externalId, targetId),
            like(contacts.phone, `%${targetId}%`)
        )
    ).limit(5);
    console.log(`Contatos encontrados para "${targetId}":`, contactList.map(c => ({ id: c.id, phone: c.phone, name: c.name })));

    let convoIdToCheck: string | null = null;

    if (connResults.length > 0) {
        // Se encontramos uma conexão, vamos ver as conversas dela
        const connIds = connResults.map(c => c.id);
        const recentConvos = await db.select().from(conversations).where(
            sql`${conversations.connectionId} IN ${connIds}`
        ).orderBy(desc(conversations.updatedAt)).limit(5);
        console.log('Conversas recentes nesta conexão:', recentConvos.map(c => ({ id: c.id, aiActive: c.aiActive, lastMsg: c.lastMessageAt })));
        if (recentConvos.length > 0) convoIdToCheck = recentConvos[0]!.id;
    } else if (contactList.length > 0) {
        const contactId = contactList[0]!.id;
        const convoList = await db.select().from(conversations).where(eq(conversations.contactId, contactId)).limit(1);
        if (convoList.length > 0) convoIdToCheck = convoList[0]!.id;
    }

    if (convoIdToCheck) {
        const convoResults = await db.select().from(conversations).where(eq(conversations.id, convoIdToCheck));
        const convo = convoResults[0];
        
        if (!convo) {
            console.log('Conversa não encontrada no banco de dados.');
        } else {
            console.log(`Analisando Conversa ID: ${convo.id} | IA Ativa: ${convo.aiActive} | Persona: ${convo.assignedPersonaId}`);

            const recentMsgs = await db.select().from(messages).where(eq(messages.conversationId, convo.id)).orderBy(desc(messages.sentAt)).limit(10);
            console.log('Últimas 10 mensagens:', recentMsgs.map(m => ({ id: m.id, type: m.senderType, content: m.content?.substring(0, 50), status: m.status, at: m.sentAt })));

            const logs = await db.select().from(automationLogs).where(eq(automationLogs.conversationId, convo.id)).orderBy(desc(automationLogs.createdAt)).limit(10);
            console.log('Logs de automação para esta conversa:', logs.map(l => ({ level: l.level, message: l.message, at: l.createdAt })));
        }
    } else {
        console.log('Não foi possível identificar uma conversa para o ID informado.');
    }

    console.log('\n--- VERIFICAÇÃO GERAL META_API (APIClOUD) ---');
    const metaConnections = await db.select().from(connections).where(eq(connections.connectionType, 'meta_api')).limit(10);
    console.log('Conexões Meta/APICloud:', metaConnections.map(c => ({ id: c.id, name: c.config_name, status: c.status })));

    const recentFailures = await db.select().from(whatsappDeliveryReports)
        .where(and(
            eq(whatsappDeliveryReports.status, 'failed'),
            sql`${whatsappDeliveryReports.sentAt} > NOW() - INTERVAL '24 hours'`
        ))
        .orderBy(desc(whatsappDeliveryReports.sentAt))
        .limit(10);

    console.log('Falhas de entrega nas últimas 24h:', recentFailures.map(f => ({ id: f.id, contactId: f.contactId, reason: f.failureReason, at: f.sentAt })));

    process.exit(0);
}

diagnose().catch(err => { console.error(err); process.exit(1); });
