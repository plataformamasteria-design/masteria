import { db } from './src/lib/db';
import * as schema from './src/lib/db/schema';
import { eq, and, gte, ilike } from 'drizzle-orm';

async function main() {
    try {
        console.log("--- BUSCANDO EMPRESA ---");
        const orgs = await db.select().from(schema.companies).where(ilike(schema.companies.name, '%Rosa Marinelli%'));
        if (orgs.length === 0) {
            console.log("Empresa não encontrada.");
            return;
        }
        const company = orgs[0];
        console.log(`Empresa: ${company.name} (ID: ${company.id})`);

        console.log("\n--- AGENTES I.A ---");
        const agentsTable = schema.agents || schema.aiAgents;
        if (agentsTable) {
            const aiAgents = await db.select().from(agentsTable).where(eq(agentsTable.companyId, company.id));
            aiAgents.forEach((a: any) => console.log(`Agente: ${a.name}\nPrompt: ${a.prompt}\n`));
        }

        console.log("\n--- AUTOMAÇÕES ---");
        const flows = await db.select().from(schema.automationFlows).where(eq(schema.automationFlows.companyId, company.id));
        flows.forEach((f: any) => console.log(`Automação: ${f.name} (Ativo: ${f.isActive})\nNodes: ${JSON.stringify(f.visualData)}\n`));

        console.log("\n--- CONVERSAS DOS ÚLTIMOS 5 DIAS ---");
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        
        const recentConversations = await db.select().from(schema.conversations)
            .where(and(
                eq(schema.conversations.companyId, company.id),
                gte(schema.conversations.createdAt, fiveDaysAgo)
            ))
            .limit(10);
            
        console.log(`Encontradas ${recentConversations.length} conversas recentes (limite 10).`);
        
        for (const conv of recentConversations) {
            console.log(`\nConversa ID: ${conv.id} - Status: ${conv.status}`);
            
            const msgs = await db.select().from(schema.messages)
                .where(eq(schema.messages.conversationId, conv.id))
                .orderBy(schema.messages.sentAt)
                .limit(20);
                
            msgs.forEach((m: any) => {
                const sender = m.senderType === 'contact' ? 'Cliente' : (m.senderType === 'bot' ? 'Bot' : 'Atendente');
                console.log(`[${m.sentAt.toISOString()}] ${sender}: ${m.content}`);
            });
        }

    } catch (e: any) {
        console.error("DB Query Error:", e.message);
    }
}
main();
