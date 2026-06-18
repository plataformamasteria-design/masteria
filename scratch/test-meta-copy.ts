import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';

async function runTests() {
    console.log("🚀 Iniciando Teste Específico: Análise de Copy pelo Copilot...");
    
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

    try {
        const prompt = `Puxe um dos meus anúncios (ads) da Meta, não precisa listar todos, apenas encontre UM que esteja rodando ou pausado. Depois me diga: qual é o CTA (botão) desse anúncio? O que está escrito na Copy (texto do criativo) dele? E de qual campanha ele faz parte?`;
        
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
