const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Buscar a última mensagem recebida de um contato (incoming)
  const res = await client.query(`
    SELECT m.id, m.conversation_id, m.content, m.sender_type, m.sent_at, c.phone 
    FROM messages m
    JOIN conversations cv ON m.conversation_id = cv.id
    JOIN contacts c ON cv.contact_id = c.id
    WHERE m.sender_type = 'CONTACT' 
    ORDER BY m.sent_at DESC 
    LIMIT 1
  `);
  
  await client.end();

  if (res.rows.length === 0) {
    console.log('Nenhuma mensagem encontrada.');
    return;
  }

  const msg = res.rows[0];
  console.log(`Testando fluxo para a mensagem mais recente:`);
  console.log(`De: ${msg.phone} | Conteúdo: "${msg.content}" | ID: ${msg.id}`);
  console.log(`Data: ${msg.sent_at}`);
  console.log('--------------------------------------------------');
  console.log('Iniciando processIncomingMessageTrigger...');

  try {
    // Para executar o script TS diretamente, podemos precisar de tsx
    // Mas se importarmos via automação-engine que está em TS, precisamos rodar esse script com tsx
    console.log("Execute o seguinte comando no terminal para testar o gatilho desta mensagem específica:");
    console.log(`npx -y dotenv-cli -e .env.local -- npx tsx -e "import { processIncomingMessageTrigger } from './src/lib/automation-engine'; processIncomingMessageTrigger('${msg.conversation_id}', '${msg.id}').then(() => { console.log('Sucesso'); process.exit(0); }).catch(console.error);"`);
  } catch (err) {
    console.error('Erro:', err);
  }
}

main().catch(console.error);
