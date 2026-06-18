import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';

async function runTests() {
    console.log("🚀 Iniciando Suíte Final de Testes da IA Copilot...");
    
    // Pegar a mesma empresa (WABA ativo)
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

    // 1. Resumo do Histórico de Heitor Santos
    console.log("\n🧪 Teste 1: Buscar e Resumir Heitor Santos");
    try {
        const res1 = await executeCopilotCommand("Procure o contato Heitor Santos e traga um resumo detalhado das últimas mensagens que trocamos com ele.", companyId);
        console.log("➡️ Resposta da IA:", res1.reply);
        console.log("🛠️ Tool Calls:", JSON.stringify(res1.toolCalls, null, 2));
    } catch(e: any) { console.error("❌ Erro Teste 1:", e.message); }

    // 2. Sincronizar templates com Meta para ver o que houve com o test_internal
    console.log("\n🧪 Teste 2: Sincronizar Templates Pendentes");
    try {
        const res2 = await executeCopilotCommand("Sincronize meus templates do WhatsApp. Quero saber o que aconteceu com aquele template test_internal_ que mandamos antes.", companyId);
        console.log("➡️ Resposta da IA:", res2.reply);
        console.log("🛠️ Tool Calls:", JSON.stringify(res2.toolCalls, null, 2));
    } catch(e: any) { console.error("❌ Erro Teste 2:", e.message); }

    // 3. Criar campanha + template avançado juntos
    console.log("\n🧪 Teste 3: Criação Completa de Campanha e Template Avançado");
    try {
        const prompt = `Crie um novo template chamado campanha_anual_vip_2025 da categoria MARKETING. Quero que tenha um cabeçalho de imagem (https://picsum.photos/300) e o texto principal dizendo 'Venha para a campanha Vip'. Adicione um botão de URL escrito 'Participar' apontando para https://masteria.com. Depois que criar o template, crie/agende uma campanha chamada 'Campanha Vip Anual' e deixe ela com status QUEUED.`;
        const res3 = await executeCopilotCommand(prompt, companyId);
        console.log("➡️ Resposta da IA:", res3.reply);
        console.log("🛠️ Tool Calls:", JSON.stringify(res3.toolCalls, null, 2));
    } catch(e: any) { console.error("❌ Erro Teste 3:", e.message); }

    console.log("\n✅ Testes concluídos com sucesso.");
    process.exit(0);
}

runTests().catch(console.error);
