import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';
import { messages, conversations, contacts } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

async function runTests() {
    console.log("🚀 Buscando o contato com maior histórico de conversa...");
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

    try {
        const topConv = await db.select({
            convId: messages.conversationId,
            count: sql`count(*)`.as('c')
        })
        .from(messages)
        .where(eq(messages.companyId, companyId))
        .groupBy(messages.conversationId)
        .orderBy(desc(sql`count(*)`))
        .limit(1);

        if (!topConv || topConv.length === 0) {
            console.log("Nenhuma conversa longa encontrada.");
            process.exit(0);
        }

        const targetConvId = topConv[0].convId as string;
        
        // Pega o nome do contato
        const convData = await db.select({ name: contacts.name })
            .from(conversations)
            .innerJoin(contacts, eq(conversations.contactId, contacts.id))
            .where(eq(conversations.id, targetConvId))
            .limit(1);

        const contactName = convData[0]?.name || "Desconhecido";
        
        console.log(`✅ Contato com maior histórico: ${contactName} (Conversa ID: ${targetConvId} | ${topConv[0].count} mensagens)`);

        const prompt = `Você possui o conversationId ${targetConvId}. Puxe as mensagens (getLeadConversations) e faça um resumo COMPLETO e PROFISSIONAL do atendimento. Mostre qual foi o motivo do contato, o que foi resolvido e qual o status final. Não mostre as mensagens soltas, faça um texto de resumo analítico de atendimento.`;
        
        console.log(`\n💬 Pedindo para a IA resumir analiticamente...`);
        const res = await executeCopilotCommand(prompt, companyId, targetConvId);
        
        console.log("\n➡️ Resumo Analítico da IA:\n");
        console.log(res.reply);
        
    } catch(e: any) { 
        console.error("❌ Erro:", e.message); 
    }

    process.exit(0);
}

runTests().catch(console.error);
