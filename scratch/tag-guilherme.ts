import { db } from '../src/lib/db';
import { campaigns, connections, whatsappDeliveryReports, contactsToTags, tags, contacts } from '../src/lib/db/schema';
import { desc, and, eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function run() {
    const company = await db.query.companies.findFirst({
        where: eq(companies.name, "Empresa de Desenvolvimento Master")
    });
    if (!company) throw new Error("Empresa não encontrada");
    
    // Buscar campanhas da API oficial
    const offCampaigns = await db.select({
        id: campaigns.id,
        name: campaigns.name,
        createdAt: campaigns.createdAt,
        status: campaigns.status
    }).from(campaigns)
    .innerJoin(connections, eq(campaigns.connectionId, connections.id))
    .where(and(
        eq(campaigns.companyId, company.id),
        eq(connections.connectionType, 'meta_api')
    ))
    .orderBy(desc(campaigns.createdAt))
    .limit(5);
    
    console.log("Últimas 5 Campanhas da API Oficial:");
    offCampaigns.forEach((c, i) => console.log(`${i}: ${c.name} (ID: ${c.id}) - ${c.status} - ${c.createdAt}`));

    // O penúltimo disparo seria o índice 1 (já que criamos um agora no índice 0).
    const targetCampaign = offCampaigns[1];
    console.log("Campanha Alvo:", targetCampaign);

    if (targetCampaign) {
        // Encontrar os contatos dessa campanha
        const reports = await db.select({ contactId: whatsappDeliveryReports.contactId })
            .from(whatsappDeliveryReports)
            .where(eq(whatsappDeliveryReports.campaignId, targetCampaign.id));
        
        console.log(`Contatos encontrados na campanha ${targetCampaign.id}:`, reports.length);
        
        // Criar a tag "GUILHERME"
        let tag = await db.query.tags.findFirst({
            where: and(eq(tags.companyId, company.id), eq(tags.name, 'GUILHERME'))
        });
        if (!tag) {
            const inserted = await db.insert(tags).values({
                id: uuidv4(),
                companyId: company.id,
                name: 'GUILHERME',
                color: '#ff0000'
            }).returning();
            tag = inserted[0];
            console.log("Tag 'GUILHERME' criada.");
        } else {
            console.log("Tag 'GUILHERME' já existe.");
        }

        let added = 0;
        for (const r of reports) {
            if (!r.contactId) continue;
            
            // Verificar se já tem a tag
            const hasTag = await db.query.contactsToTags.findFirst({
                where: and(
                    eq(contactsToTags.contactId, r.contactId),
                    eq(contactsToTags.tagId, tag.id)
                )
            });
            
            if (!hasTag) {
                await db.insert(contactsToTags).values({
                    contactId: r.contactId,
                    tagId: tag.id
                });
                added++;
            }
        }
        console.log(`Tag 'GUILHERME' adicionada a ${added} novos leads.`);
    }

    process.exit(0);
}
// Importar companies tbm
import { companies } from '../src/lib/db/schema';
run();
