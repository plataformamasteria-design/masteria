import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';

async function runTests() {
    console.log("🚀 Iniciando Teste Específico: Meta Ads - Conjuntos e Anúncios...");
    
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

    try {
        const prompt = `Faça o seguinte passo a passo usando suas tools:
1. Puxe a lista das minhas campanhas de tráfego pago (Meta Ads).
2. Pegue o ID de apenas UMA campanha (a primeira que encontrar) e use a tool para puxar os conjuntos de anúncios (AdSets) dessa campanha.
3. Depois, puxe os anúncios (Ads) dessa mesma campanha.
4. Me dê um resumo do que encontrou.`;
        
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
