import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';

async function runTests() {
    console.log("🚀 Iniciando Teste Específico: Filtro de 3 dias no Meta Ads...");
    
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

    try {
        const prompt = `Puxe a lista das minhas campanhas de tráfego pago dos últimos 3 dias e me diga o que encontrou.`;
        
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
