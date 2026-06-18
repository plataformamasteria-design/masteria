import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';

async function runTests() {
    console.log("🚀 Iniciando Teste Específico: Análise de Público pelo Copilot...");
    
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

    try {
        const prompt = `Escolha uma campanha ativa, pegue o primeiro conjunto de anúncios (AdSet) dela e me diga exatamente qual é a configuração de público (Targeting) que está sendo usada nele (idade, local, interesses, etc).`;
        
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
