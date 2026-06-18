import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../src/lib/db';
import { contacts, companies, conversations } from '../src/lib/db/schema';
import { executeCopilotCommand } from '../src/lib/copilot-engine';
import { eq, ilike, desc, and } from 'drizzle-orm';

async function run() {
    const contact2 = await db.query.contacts.findFirst({
        where: ilike(contacts.phone, '%88920008007%')
    });
    if (!contact2) throw new Error('Contact not found');

    const company = await db.query.companies.findFirst({
        where: eq(companies.id, contact2.companyId)
    });
    if (!company) throw new Error('Company not found');

    const conversation = await db.query.conversations.findFirst({
        where: eq(conversations.contactId, contact2.id),
        orderBy: [desc(conversations.lastMessageAt)]
    });

    console.log('Company:', company.id);
    console.log('Contact:', contact2.id);
    console.log('Conversation:', conversation?.id);

    const questions = [
        'Qual o resumo do atendimento do Heitor Santos?',
        'Quais listas de contatos nós temos cadastradas?',
        'Quantos leads estão no funil GCR na etapa Lead Novo?',
        'Verifique se o template teste_master_copilot foi aprovado',
        'Qual o nosso custo por lead geral da conta nos últimos 30 dias?',
        'Quais conjuntos de anúncios da campanha CASAL DE NEGÓCIOS existem?',
        'Faça uma análise de público separando por idade e genero na campanha EVENTO-CASAL DE NEGÓCIOS'
    ];

    for (const q of questions) {
        console.log('\n\n========================================');
        console.log(`PERGUNTA: ${q}`);
        console.log('========================================');
        try {
            const res = await executeCopilotCommand(q, company.id, conversation?.id || null);
            console.log('RESPOSTA:\n' + JSON.stringify(res, null, 2));
        } catch (e) {
            console.error('ERRO:', e);
        }
    }
    process.exit(0);
}
run();
