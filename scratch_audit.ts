import { db } from './src/lib/db';
import { companies, users, agents, automationFlows, conversations, messages, contacts } from './src/lib/db/schema';
import { eq, and, gte, like, ilike } from 'drizzle-orm';

async function main() {
    try {
        console.log("--- BUSCANDO EMPRESA ---");
        const orgs = await db.select().from(companies).where(ilike(companies.name, '%Rosa Marinelli%'));
        if (orgs.length === 0) {
            console.log("Empresa não encontrada.");
            return;
        }
        const company = orgs[0];
        console.log(`Empresa: ${company.name} (ID: ${company.id})`);

        console.log("\n--- AGENTES I.A ---");
        const aiAgents = await db.select().from(agents).where(eq(agents.companyId, company.id));
        aiAgents.forEach(a => console.log(`Agente: ${a.name}\nPrompt: ${a.prompt?.substring(0, 200)}...\n`));

        console.log("\n--- AUTOMAÇÕES ---");
        const flows = await db.select().from(automationFlows).where(eq(automationFlows.companyId, company.id));
        flows.forEach(f => console.log(`Automação: ${f.name} (Ativo: ${f.isActive})\nNodes: ${JSON.stringify(f.visualData).substring(0, 200)}...\n`));

        console.log("\n--- CONVERSAS DOS ÚLTIMOS 5 DIAS ---");
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        
        const recentConversations = await db.select().from(conversations)
            .where(and(
                eq(conversations.companyId, company.id),
                gte(conversations.createdAt, fiveDaysAgo)
            ))
            .limit(10);
            
        console.log(`Encontradas ${recentConversations.length} conversas recentes (limite 10).`);
        
        for (const conv of recentConversations) {
            console.log(`\nConversa ID: ${conv.id} - Status: ${conv.status} - Contato ID: ${conv.contactId}`);
            
            const msgs = await db.select().from(messages)
                .where(eq(messages.conversationId, conv.id))
                .orderBy(messages.createdAt)
                .limit(20);
                
            msgs.forEach(m => {
                const sender = m.senderType === 'contact' ? 'Cliente' : (m.senderType === 'bot' ? 'Bot' : 'Atendente');
                console.log(`[${m.createdAt.toISOString()}] ${sender}: ${m.content}`);
            });
        }

    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
