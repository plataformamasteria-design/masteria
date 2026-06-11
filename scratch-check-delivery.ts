import 'dotenv/config';
import { db } from './src/lib/db';
import { connections, messageTemplates, templates } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendWhatsappTemplateMessage } from './src/lib/facebookApiService';

async function main() {
    const conns = await db.select().from(connections).where(eq(connections.config_name, '8276_Antônio_BM_GRUP_ED'));
    const conn = conns[0];
    
    if (!conn) return console.log('Conexao nao encontrada');

    // Find a template
    let tmpl = await db.select().from(messageTemplates).where(and(
        eq(messageTemplates.companyId, conn.companyId),
        eq(messageTemplates.status, 'APPROVED')
    )).limit(1);

    if (tmpl.length === 0) {
        console.log('Sem templates na nova tabela, buscando na antiga...');
        tmpl = await db.select().from(templates).where(and(
            eq(templates.companyId, conn.companyId),
            eq(templates.status, 'APPROVED')
        )).limit(1);
    }

    if (tmpl.length === 0) {
        console.log('Nenhum template aprovado encontrado para enviar teste.');
        return;
    }

    const templateName = tmpl[0].name;
    const language = tmpl[0].language || 'pt_BR';
    console.log(`Usando template: ${templateName} (${language})`);

    // Test with 9th digit
    try {
        const res9 = await sendWhatsappTemplateMessage({
            connection: conn,
            to: '5588920008007',
            templateName,
            languageCode: language,
            components: []
        });
        console.log('Enviado para 5588920008007 (Com 9). Result:', res9);
    } catch (e) {
        console.error('Erro ao enviar com 9:', e);
    }

    // Test without 9th digit
    try {
        const res8 = await sendWhatsappTemplateMessage({
            connection: conn,
            to: '558820008007',
            templateName,
            languageCode: language,
            components: []
        });
        console.log('Enviado para 558820008007 (Sem 9). Result:', res8);
    } catch (e) {
        console.error('Erro ao enviar sem 9:', e);
    }
}

main().catch(console.error);
