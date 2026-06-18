import 'dotenv/config';
import { db } from '@/lib/db';
import { executeCopilotCommand } from '@/lib/copilot-engine';
import { contacts, conversations, messageTemplates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function runFullTests() {
    console.log("🚀 Iniciando Testes Internos Reais do Copilot...");
    
    // Pegamos a empresa que tem WABA configurado no console anterior
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
    console.log(`✅ Empresa selecionada: ${companyId}`);

    // ----- PREPARAÇÃO: Criar contato falso para testar sendDirectMessage -----
    console.log("🛠️ Criando contato e conversa fake no banco para testar envio direto...");
    const fakeContactId = randomUUID();
    const fakePhone = "5511999999999"; // Número fake, o envio vai falhar na API, mas testará o fluxo
    
    await db.insert(contacts).values({
        id: fakeContactId,
        companyId,
        name: "Teste Interno Bot",
        phone: fakePhone,
    }).onConflictDoNothing();

    const fakeConvId = randomUUID();
    
    // Precisamos de uma connectionId válida da empresa
    const conn = await db.query.connections.findFirst({
        where: (c, { eq }) => eq(c.companyId, companyId)
    });

    if (conn) {
        await db.insert(conversations).values({
            id: fakeConvId,
            companyId,
            contactId: fakeContactId,
            connectionId: conn.id,
            status: "OPEN",
        }).onConflictDoNothing();
    }

    // 1. Teste de Envio de Mensagem Direta
    console.log("\n🧪 Teste 1: Enviar Mensagem Direta (sendDirectMessage)");
    try {
        const resDirect = await executeCopilotCommand(`Mande a mensagem exata 'Oi, isso é um teste interno' na conversa de ID ${fakeConvId}. Lembre-se de usar a tool sendDirectMessage já que eu te passei o ID da conversa.`, companyId, fakeConvId);
        console.log("➡️ Resposta da IA:", resDirect.reply);
        console.log("🛠️ Tool Calls:", JSON.stringify(resDirect.toolCalls, null, 2));
    } catch (e: any) {
        console.error("❌ Erro no Teste 1:", e.message);
    }

    // 2. Teste de Criação de Template (Isso vai bater na Meta, usaremos um nome inofensivo)
    console.log("\n🧪 Teste 2: Criar Template Avançado na Meta (submitWhatsAppTemplate)");
    const templateName = `test_internal_${Math.floor(Date.now() / 1000)}`; // Nome único
    try {
        const resTemplate = await executeCopilotCommand(`Crie um template chamado ${templateName} de categoria MARKETING. O texto será 'Teste de integração interna'. Coloque um cabeçalho de TEXT com conteúdo 'Alerta' e 1 botão URL com texto 'Acessar' e link 'https://masteria.com'.`, companyId);
        console.log("➡️ Resposta da IA:", resTemplate.reply);
        console.log("🛠️ Tool Calls:", JSON.stringify(resTemplate.toolCalls, null, 2));

        // Verificar se salvou no banco corretamente com os componentes
        const saved = await db.query.messageTemplates.findFirst({
            where: eq(messageTemplates.name, templateName)
        });
        if (saved) {
            console.log("✅ Componentes salvos no Banco:", JSON.stringify(saved.components, null, 2));
        } else {
            console.log("❌ Template não encontrado no banco de dados.");
        }
    } catch (e: any) {
        console.error("❌ Erro no Teste 2:", e.message);
    }

    // Limpeza do contato fake
    await db.delete(conversations).where(eq(conversations.id, fakeConvId));
    await db.delete(contacts).where(eq(contacts.id, fakeContactId));
    
    console.log("\n✅ Testes finais concluídos!");
    process.exit(0);
}

runFullTests().catch(e => {
    console.error(e);
    process.exit(1);
});
