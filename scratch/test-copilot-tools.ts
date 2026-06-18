import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';
import { companies } from '@/lib/db/schema';
import OpenAI from 'openai';

async function runTests() {
    console.log("🔄 Iniciando testes do Copilot (Modo Seguro)...");
    
    const company = await db.query.companies.findFirst();
    if (!company) {
        console.log("❌ Nenhuma empresa encontrada.");
        process.exit(1);
    }
    const companyId = company.id;
    console.log(`✅ Empresa selecionada: ${company.name} (${companyId})`);

    // 1. Testando searchContact (Seguro - apenas leitura)
    console.log("\n🧪 Teste 1: Buscar Contato (searchContact com sufixo)");
    try {
        const resSearch = await executeCopilotCommand("Procure algum lead que o número termina com 7585", companyId);
        console.log("➡️ Resposta da IA:", resSearch.reply);
        console.log("🛠️ Tool Calls realizadas:", JSON.stringify(resSearch.toolCalls, null, 2));
    } catch (e: any) {
        console.error("❌ Erro no Teste 1:", e.message);
    }

    // 2. Testando syncWhatsAppTemplates (Seguro - apenas leitura/GET na Meta)
    console.log("\n🧪 Teste 2: Sincronizar Templates (syncWhatsAppTemplates)");
    try {
        const resSync = await executeCopilotCommand("Sincronize o status de todos os meus templates de WhatsApp que estão pendentes com a Meta.", companyId);
        console.log("➡️ Resposta da IA:", resSync.reply);
        console.log("🛠️ Tool Calls realizadas:", JSON.stringify(resSync.toolCalls, null, 2));
    } catch (e: any) {
        console.error("❌ Erro no Teste 2:", e.message);
    }

    // Nota: sendDirectMessage e submitWhatsAppTemplate não serão testados aqui
    // para evitar enviar mensagens reais para clientes ou submeter lixo oficial na API da Meta.
    // Mas a lógica de schemas foi validada pelo TypeScript.
    
    console.log("\n✅ Testes seguros concluídos!");
    process.exit(0);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
