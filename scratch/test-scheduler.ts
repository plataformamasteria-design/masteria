import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';
import { copilotScheduledTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function runTests() {
    console.log("🚀 Iniciando Teste Específico: Copilot Scheduler...");
    
    // Pegando uma empresa e conversa válidas
    const conv = await db.query.conversations.findFirst();
    if (!conv) throw new Error("Sem conversa no DB");

    const company = await db.query.companies.findFirst({
        where: (c, { eq }) => eq(c.id, conv.companyId)
    });
    if (!company) throw new Error("Sem empresa no DB");

    try {
        const prompt = `Por favor, agende para amanhã às 15:00 o envio de uma mensagem com o resumo dos meus atendimentos.`;
        
        console.log(`\n💬 Prompt enviado para a IA: "${prompt}"`);
        console.log(`CompanyId: ${company.id}, ConversationId: ${conv.id}`);
        
        const res = await executeCopilotCommand(`[DIRETRIZ EXECUTIVA PRINCIPAL DA AUTOMAÇÃO]:\n"${prompt}"\n\nATENÇÃO: A sua prioridade máxima é cumprir essa diretriz executiva!`, company.id, conv.id);
        
        console.log("\n➡️ Resposta da IA:\n");
        console.log(res.reply);
        
        console.log("\n🛠️ Tool Calls (Ferramentas acionadas):");
        console.log(JSON.stringify(res.toolCalls, null, 2));

        console.log("\n🔍 Verificando no Banco de Dados se a task foi salva...");
        const tasks = await db.query.copilotScheduledTasks.findMany({
            where: eq(copilotScheduledTasks.conversationId, conv.id)
        });
        
        console.log(`Encontradas ${tasks.length} tasks no banco:`, tasks);
        
        if (tasks.length > 0) {
            // Delete as inserted test tasks
            for (const t of tasks) {
                 await db.delete(copilotScheduledTasks).where(eq(copilotScheduledTasks.id, t.id));
            }
            console.log("\n🧹 Tarefas de teste removidas.");
        }
    } catch(e: any) { 
        console.error("❌ Erro no Teste:", e.message); 
    }

    console.log("\n✅ Teste concluído.");
    process.exit(0);
}

runTests().catch(console.error);
