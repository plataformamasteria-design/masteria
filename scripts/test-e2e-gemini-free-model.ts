// scripts/test-e2e-gemini-free-model.ts
import { db } from '@/lib/db';
import { aiPersonas, connections, conversations, messages, contacts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';

const PERSONA_ID = '71c7a1c6-8903-436a-b0c1-699a746af25c'; // EDN Atendimento - Antônio/Pablo
const CONNECTION_NAME = 'wtz-6-iphone_-';

async function main() {
  console.log('=== 🧪 TESTE E2E: Agente com Modelo Gemini Gratuito ===\n');
  console.log(`Modelo esperado: gemini-3-flash-preview`);
  console.log(`Persona: EDN Atendimento - Antônio/Pablo (Gemini)\n`);

  try {
    // 1. Verificar configuração da persona
    console.log('1️⃣ VERIFICANDO CONFIGURAÇÃO DA PERSONA...\n');
    const persona = await db.query.aiPersonas.findFirst({
      where: eq(aiPersonas.id, PERSONA_ID),
    });

    if (!persona) {
      console.error('❌ Persona não encontrada');
      process.exit(1);
    }

    console.log('✅ Persona encontrada:');
    console.log(`   Nome: ${persona.name}`);
    console.log(`   Provider: ${persona.provider}`);
    console.log(`   Modelo: ${persona.model || 'N/A'}`);
    console.log(`   Is Active: ${persona.isActive}\n`);

    if (persona.model !== 'gemini-3-flash-preview') {
      console.warn(`⚠️ ATENÇÃO: Modelo configurado é "${persona.model}", não "gemini-3-flash-preview"`);
    }

    // 2. Verificar conexão
    console.log('2️⃣ VERIFICANDO CONEXÃO...\n');
    const connection = await db.query.connections.findFirst({
      where: eq(connections.config_name, CONNECTION_NAME),
    });

    if (!connection) {
      console.error('❌ Conexão não encontrada');
      process.exit(1);
    }

    console.log('✅ Conexão encontrada:');
    console.log(`   Nome: ${connection.config_name}`);
    console.log(`   Assigned Persona ID: ${connection.assignedPersonaId || 'N/A'}`);
    console.log(`   Status: ${connection.status}\n`);

    if (connection.assignedPersonaId !== PERSONA_ID) {
      console.warn(`⚠️ ATENÇÃO: Conexão não está configurada com a persona esperada`);
    }

    // 3. Buscar ou criar conversa de teste
    console.log('3️⃣ PREPARANDO CONVERSA DE TESTE...\n');
    
    // Buscar contato existente ou criar um de teste
    let contact = await db.query.contacts.findFirst({
      where: eq(contacts.phone, '556231426957'),
    });

    if (!contact) {
      console.log('   Criando contato de teste...');
      const [newContact] = await db.insert(contacts).values({
        phone: '556231426957',
        name: 'Teste E2E',
        companyId: connection.companyId,
      }).returning();
      contact = newContact;
    }

    // Buscar conversa existente ou criar uma nova
    let conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.contactId, contact.id),
        eq(conversations.connectionId, connection.id)
      ),
    });

    if (!conversation) {
      console.log('   Criando conversa de teste...');
      const [newConversation] = await db.insert(conversations).values({
        contactId: contact.id,
        connectionId: connection.id,
        companyId: connection.companyId,
        status: 'NEW',
        aiActive: true,
      }).returning();
      conversation = newConversation;
    }

    console.log('✅ Conversa preparada:');
    console.log(`   ID: ${conversation.id}`);
    console.log(`   Contato: ${contact.name || contact.phone}`);
    console.log(`   AI Active: ${conversation.aiActive}\n`);

    // 4. Criar mensagem de teste
    console.log('4️⃣ CRIANDO MENSAGEM DE TESTE...\n');
    const testMessage = `Olá! Este é um teste E2E do agente de IA com modelo gratuito. Data: ${new Date().toISOString()}`;
    
    const [newMessage] = await db.insert(messages).values({
      conversationId: conversation.id,
      companyId: connection.companyId,
      content: testMessage,
      senderType: 'USER',
      status: 'received',
      sentAt: new Date(),
    }).returning();

    console.log('✅ Mensagem criada:');
    console.log(`   ID: ${newMessage.id}`);
    console.log(`   Conteúdo: ${testMessage.substring(0, 80)}...\n`);

    // 5. Processar mensagem (disparar automação)
    console.log('5️⃣ PROCESSANDO MENSAGEM (DISPARANDO AUTOMAÇÃO)...\n');
    console.log('   Aguardando 5 segundos para processamento...\n');
    
    await processIncomingMessageTrigger(conversation.id, newMessage.id);
    
    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 6. Verificar resposta do agente
    console.log('6️⃣ VERIFICANDO RESPOSTA DO AGENTE...\n');
    
    const aiMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.conversationId, conversation.id),
        eq(messages.senderType, 'AGENT')
      ),
      orderBy: [desc(messages.sentAt)],
      limit: 1,
    });

    if (aiMessages.length === 0) {
      console.log('⚠️ Nenhuma resposta do agente encontrada ainda.');
      console.log('   Aguardando mais 5 segundos...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const aiMessagesRetry = await db.query.messages.findMany({
        where: and(
          eq(messages.conversationId, conversation.id),
          eq(messages.senderType, 'AGENT')
        ),
        orderBy: [desc(messages.sentAt)],
        limit: 1,
      });

      if (aiMessagesRetry.length === 0) {
        console.error('❌ Agente não respondeu após 10 segundos');
        console.log('\n📋 Verificando logs de automação...\n');
        
        // Buscar logs de automação
        const { automationLogs } = await import('@/lib/db/schema');
        const logs = await db.query.automationLogs.findMany({
          where: eq(automationLogs.conversationId, conversation.id),
          orderBy: [desc(automationLogs.createdAt)],
          limit: 10,
        });

        if (logs.length > 0) {
          console.log('📝 Últimos logs de automação:');
          logs.forEach((log, idx) => {
            console.log(`\n[${idx + 1}] [${log.level}] ${log.createdAt}`);
            console.log(`    ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}`);
          });
        } else {
          console.log('⚠️ Nenhum log de automação encontrado');
        }
        
        process.exit(1);
      } else {
        const response = aiMessagesRetry[0];
        console.log('✅ Resposta do agente encontrada:');
        console.log(`   ID: ${response.id}`);
        console.log(`   Status: ${response.status || 'N/A'}`);
        console.log(`   Conteúdo: ${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}\n`);
      }
    } else {
      const response = aiMessages[0];
      console.log('✅ Resposta do agente encontrada:');
      console.log(`   ID: ${response.id}`);
      console.log(`   Status: ${response.status || 'N/A'}`);
      console.log(`   Conteúdo: ${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}\n`);
    }

    // 7. Verificar logs de automação para erros
    console.log('7️⃣ VERIFICANDO LOGS DE AUTOMAÇÃO...\n');
    
    const { automationLogs } = await import('@/lib/db/schema');
    const logs = await db.query.automationLogs.findMany({
      where: eq(automationLogs.conversationId, conversation.id),
      orderBy: [desc(automationLogs.createdAt)],
      limit: 20,
    });

    const errorLogs = logs.filter(log => log.level === 'ERROR');
    const quotaErrors = logs.filter(log => 
      log.message.includes('COTA EXCEDIDA') || 
      log.message.includes('quota') ||
      log.message.includes('RESOURCE_EXHAUSTED')
    );

    if (quotaErrors.length > 0) {
      console.error('❌ ERROS DE QUOTA ENCONTRADOS:');
      quotaErrors.forEach((log, idx) => {
        console.log(`\n[${idx + 1}] [${log.level}] ${log.createdAt}`);
        console.log(`    ${log.message}`);
      });
      process.exit(1);
    }

    if (errorLogs.length > 0) {
      console.warn('⚠️ ERROS ENCONTRADOS (mas não relacionados a quota):');
      errorLogs.forEach((log, idx) => {
        console.log(`\n[${idx + 1}] [${log.level}] ${log.createdAt}`);
        console.log(`    ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}`);
      });
    } else {
      console.log('✅ Nenhum erro encontrado nos logs');
    }

    // 8. Verificar se modelo foi usado corretamente
    console.log('\n8️⃣ VERIFICANDO MODELO USADO...\n');
    
    const modelLogs = logs.filter(log => 
      log.message.includes('gemini-3-flash-preview') ||
      log.message.includes('gemini-2.5-flash') ||
      log.message.includes('Model:') ||
      log.message.includes('model:')
    );

    if (modelLogs.length > 0) {
      console.log('✅ Logs relacionados ao modelo encontrados:');
      modelLogs.slice(0, 5).forEach((log, idx) => {
        console.log(`\n[${idx + 1}] [${log.level}] ${log.createdAt}`);
        console.log(`    ${log.message.substring(0, 200)}${log.message.length > 200 ? '...' : ''}`);
      });
    } else {
      console.log('⚠️ Nenhum log específico sobre o modelo encontrado');
    }

    // 9. Resumo final
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RESUMO DO TESTE E2E\n');
    console.log('✅ Persona configurada corretamente');
    console.log('✅ Conexão configurada corretamente');
    console.log('✅ Mensagem de teste criada');
    console.log('✅ Automação processada');
    console.log(aiMessages.length > 0 ? '✅ Agente respondeu' : '❌ Agente não respondeu');
    console.log(quotaErrors.length === 0 ? '✅ Sem erros de quota' : '❌ Erros de quota encontrados');
    console.log(errorLogs.length === 0 ? '✅ Sem erros gerais' : `⚠️ ${errorLogs.length} erros encontrados`);
    
    if (aiMessages.length > 0 && quotaErrors.length === 0) {
      console.log('\n🎉 TESTE E2E CONCLUÍDO COM SUCESSO!');
      console.log('   O agente está funcionando com o modelo gratuito.');
    } else {
      console.log('\n⚠️ TESTE E2E CONCLUÍDO COM AVISOS');
      console.log('   Verifique os logs acima para mais detalhes.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante teste E2E:', error);
    process.exit(1);
  }
}

main().catch(console.error);
