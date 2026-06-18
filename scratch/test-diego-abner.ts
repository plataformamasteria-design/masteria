import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';

async function runTests() {
    console.log("🚀 Iniciando Teste Específico: Resumo de Conversa do Diego Abner...");
    
    // Mesma empresa usada anteriormente
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

    try {
        const prompt = `Procure o contato chamado Diego Abner. Se houver contatos duplicados com esse nome, vá tentando um de cada vez até conseguir puxar o resumo do histórico de mensagens e me mostre o que ele conversou.`;
        
        console.log(`\n💬 Prompt enviado para a IA: "${prompt}"`);
        
        const res = await executeCopilotCommand(prompt, companyId);
        
        console.log("\n➡️ Resposta da IA:\n");
        console.log(res.reply);
        
        console.log("\n🛠️ Tool Calls (Ferramentas acionadas):");
        console.log(JSON.stringify(res.toolCalls, null, 2));
    } catch(e: any) { 
        console.error("❌ Erro no Teste:", e.message); 
    }

    console.log("\n✅ Teste concluído.");
    process.exit(0);
}

runTests().catch(console.error);
