import { db } from '../lib/db';
import { automationLogs, messages, conversations, connections, contacts } from '../lib/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

async function investigateAIResponses() {
  console.log('Investigando respostas dos agentes de IA...\n');

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentLogs = await db
    .select({
      id: automationLogs.id,
      level: automationLogs.level,
      message: automationLogs.message,
      conversationId: automationLogs.conversationId,
      createdAt: automationLogs.createdAt,
      details: automationLogs.details,
    })
    .from(automationLogs)
    .where(gte(automationLogs.createdAt, twentyFourHoursAgo))
    .orderBy(desc(automationLogs.createdAt))
    .limit(100);

  console.log(`Total de logs encontrados: ${recentLogs.length}\n`);

  const logsByConversation = new Map<string, typeof recentLogs>();

  for (const log of recentLogs) {
    if (log.conversationId) {
      if (!logsByConversation.has(log.conversationId)) {
        logsByConversation.set(log.conversationId, []);
      }
      logsByConversation.get(log.conversationId)!.push(log);
    }
  }

  console.log(`Conversacoes com atividade de IA: ${logsByConversation.size}\n`);

  const results: Array<{
    conversationId: string;
    contactName: string;
    connectionName: string;
    connectionType: string;
    provider: string;
    triggerTime: Date | null;
    responseTime: Date | null;
    responseDuration: number | null;
    responseStatus: 'success' | 'error' | 'no_response';
    errorMessage: string | null;
    responseMessage: string | null;
  }> = [];

  for (const [conversationId, logs] of logsByConversation.entries()) {
    const [conversation] = await db
      .select({
        contactId: conversations.contactId,
        connectionId: conversations.connectionId,
        connectionType: connections.connectionType,
        connectionName: connections.config_name,
        contactName: contacts.name,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(connections, eq(conversations.connectionId, connections.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) continue;

    logs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const triggerLog = logs.find(l => l.message.includes('Gatilho recebido'));
    const providerLog = logs.find(l => l.message.includes('Provider identificado') || l.message.includes('Usando persona'));
    const successLog = logs.find(l => l.message.includes('IA respondeu com sucesso') || l.message.includes('Mensagem enviada via'));
    const errorLog = logs.find(l => l.level === 'ERROR');

    const [aiMessage] = await db
      .select({
        content: messages.content,
        sentAt: messages.sentAt,
      })
      .from(messages)
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.senderType, 'AI'),
        gte(messages.sentAt, twentyFourHoursAgo)
      ))
      .orderBy(desc(messages.sentAt))
      .limit(1);

    const triggerTime = triggerLog?.createdAt || null;
    const responseTime = aiMessage?.sentAt || successLog?.createdAt || null;
    const responseDuration = (triggerTime && responseTime)
      ? Math.round((responseTime.getTime() - triggerTime.getTime()) / 1000)
      : null;

    let provider = 'N/A';
    if (providerLog) {
      const match = providerLog.message.match(/Provider identificado: (\w+)/) as RegExpMatchArray | null;
      if (match && match[1]) provider = match[1];
    }

    let responseStatus: 'success' | 'error' | 'no_response' = 'no_response';
    let errorMessage: string | null = null;
    let responseMessage: string | null = null;

    if (aiMessage) {
      responseStatus = 'success';
      responseMessage = aiMessage.content.substring(0, 100) + (aiMessage.content.length > 100 ? '...' : '');
    } else if (errorLog) {
      responseStatus = 'error';
      errorMessage = errorLog.message;
    }

    results.push({
      conversationId,
      contactName: conversation.contactName || 'Sem nome',
      connectionName: conversation.connectionName || 'N/A',
      connectionType: conversation.connectionType || 'N/A',
      provider,
      triggerTime,
      responseTime,
      responseDuration,
      responseStatus,
      errorMessage,
      responseMessage,
    });
  }

  results.sort((a, b) => {
    if (!a.triggerTime && !b.triggerTime) return 0;
    if (!a.triggerTime) return 1;
    if (!b.triggerTime) return -1;
    return b.triggerTime.getTime() - a.triggerTime.getTime();
  });

  console.log('P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%');
  console.log('RELATORIO DE RESPOSTAS DOS AGENTES DE IA (Ultimas 24 horas)');
  console.log('P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%\n');

  const successfulResponses = results.filter(r => r.responseStatus === 'success');
  const errorResponses = results.filter(r => r.responseStatus === 'error');
  const noResponse = results.filter(r => r.responseStatus === 'no_response');

  console.log(`Respostas bem-sucedidas: ${successfulResponses.length}`);
  console.log(`Respostas com erro: ${errorResponses.length}`);
  console.log(`Sem resposta: ${noResponse.length}`);
  console.log(`Total analisado: ${results.length}\n`);

  if (successfulResponses.length > 0) {
    const durations = successfulResponses.filter(r => r.responseDuration !== null).map(r => r.responseDuration || 0);
    if (durations.length > 0) {
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log(`Tempo medio de resposta: ${avgDuration.toFixed(2)} segundos`);
      console.log(`Tempo minimo: ${minDuration} segundos`);
      console.log(`Tempo maximo: ${maxDuration} segundos\n`);
    }
  }

  console.log('P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%');
  console.log('DETALHES DAS RESPOSTAS (Ultimas 10)');
  console.log('P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%\n');

  for (const result of results.slice(0, 10)) {
    console.log(`Conversa: ${result.conversationId.substring(0, 8)}...`);
    console.log(`   Contato: ${result.contactName}`);
    console.log(`   Conexao: ${result.connectionName} (${result.connectionType})`);
    console.log(`   Provider: ${result.provider}`);
    console.log(`   Status: ${result.responseStatus === 'success' ? 'SUCESSO' : result.responseStatus === 'error' ? 'ERRO' : 'SEM RESPOSTA'}`);

    if (result.triggerTime) {
      console.log(`   Trigger: ${result.triggerTime.toLocaleString('pt-BR')}`);
    }

    if (result.responseTime) {
      console.log(`   Resposta: ${result.responseTime.toLocaleString('pt-BR')}`);
    }

    if (result.responseDuration !== null) {
      console.log(`   Duracao: ${result.responseDuration}s`);
    }

    if (result.errorMessage) {
      console.log(`   Erro: ${result.errorMessage}`);
    }

    if (result.responseMessage) {
      console.log(`   Mensagem: ${result.responseMessage}`);
    }

    console.log('');
  }

  console.log('P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%');
  console.log('Investigation concluida');
  console.log('P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%P%\n');
}

investigateAIResponses().catch(console.error).then(() => process.exit(0));
