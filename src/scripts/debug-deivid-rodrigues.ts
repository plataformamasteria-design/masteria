import 'dotenv/config';
import { db } from '../lib/db';
import { companies, automationFlows, automationFlowExecutions, automationExecutionLogs, connections, conversations, messages, contacts } from '../lib/db/schema';
import { eq, like, desc, and, inArray, sql } from 'drizzle-orm';

async function main() {
    console.log('🔍 Investigando a organização: Deivid Rodrigues');

    // 1. Encontrar a empresa
    const comps = await db.select().from(companies).where(like(companies.name, '%Deivid%'));
    if (comps.length === 0) {
        console.log('❌ Empresa "Deivid Rodrigues" não encontrada.');
        process.exit(1);
    }

    const company = comps[0];
    console.log(`✅ Empresa encontrada: ${company.name} (ID: ${company.id})`);

    // 2. Verificar Conexões
    const conns = await db.select().from(connections).where(eq(connections.companyId, company.id));
    console.log(`\n🔌 Conexões (${conns.length}):`);
    conns.forEach(c => {
        console.log(`  - Nome: ${c.config_name}`);
        console.log(`    Tipo: ${c.connectionType}`);
        console.log(`    Ativa: ${c.isActive}`);
        console.log(`    Status: ${c.status}`);
    });

    // 3. Verificar Regras de Automação
    const rules = await db.select().from(automationFlows).where(eq(automationFlows.companyId, company.id));
    console.log(`\n🤖 Regras de Automação (${rules.length}):`);
    rules.forEach(r => {
        console.log(`  - Nome: ${r.name}`);
        console.log(`    Ativa: ${r.isActive}`);
        console.log(`    Gatilho: ${r.triggerType || 'N/A'}`);
        // console.log(`    executionLogic cru:`, JSON.stringify(r.executionLogic, null, 2));
    });

    // 4. Últimas Conversas
    const convs = await db.select().from(conversations)
        .where(eq(conversations.companyId, company.id))
        .orderBy(desc(conversations.updatedAt))
        .limit(3);
    
    console.log(`\n💬 Últimas Conversas:`);
    for (const c of convs) {
        console.log(`  - ID: ${c.id}`);
        console.log(`    aiActive: ${c.aiActive}`);
        console.log(`    Contato: ${c.contactId}`);

        // Get last message
        const msgs = await db.select().from(messages).where(eq(messages.conversationId, c.id)).orderBy(desc(messages.sentAt)).limit(1);
        if (msgs.length > 0) {
            console.log(`    Última Mensagem: ${msgs[0].content}`);
            console.log(`      - senderType: ${msgs[0].senderType}`);
            console.log(`      - provider: ${msgs[0].provider}`);
            console.log(`      - type: ${msgs[0].contentType}`);
        }
    }

    // 5. Histórico de Execuções (automationFlowExecutions)
    const execs = await db.select().from(automationFlowExecutions)
        .where(eq(automationFlowExecutions.companyId, company.id))
        .orderBy(desc(automationFlowExecutions.startedAt))
        .limit(3)
        .catch(() => []);
    
    console.log(`\n⚙️ Execuções de Fluxo Recentes (${execs.length}):`);
    execs.forEach((e: any) => {
        console.log(`  - Exec ID: ${e.id} | Flow: ${e.flowId} | Status: ${e.status} | Contato: ${e.contactId}`);
        if (e.error) console.log(`    Error: ${e.error}`);
    });

    // Get phone numbers for these contacts
    const allContactIds = [...new Set([
        ...convs.map(c => c.contactId),
        ...execs.map(e => e.contactId)
    ])];

    const contactDetails = await db.select().from(contacts)
        .where(inArray(contacts.id, allContactIds))
        .catch(() => []);

    console.log(`\n📞 Contatos encontrados:`);
    contactDetails.forEach((c: any) => {
        console.log(`  - ID: ${c.id} | Phone: ${c.phone} | Nome: ${c.name}`);
    });

    process.exit(0);
}

main().catch(console.error);
