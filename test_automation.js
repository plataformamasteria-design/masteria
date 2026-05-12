const { Pool } = require('pg');
const fetch = require('node-fetch');

async function runTest() {
  const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
  
  console.log("🔍 Buscando a organização 'Deivid Rodrigues'...");
  const companyRes = await pool.query("SELECT id FROM companies WHERE name ILIKE '%Deivid Rodrigues%' LIMIT 1");
  const companyId = companyRes.rows[0]?.id;
  if (!companyId) return console.log("Organização não encontrada.");

  console.log(`✅ Organização encontrada: ${companyId}`);
  
  console.log("🔍 Buscando uma conexão Baileys ativa...");
  const connRes = await pool.query("SELECT id FROM connections WHERE company_id = $1 AND connection_type = 'baileys' LIMIT 1", [companyId]);
  const connectionId = connRes.rows[0]?.id;
  if (!connectionId) return console.log("Nenhuma conexão Baileys encontrada.");

  console.log(`✅ Conexão Baileys encontrada: ${connectionId}`);

  console.log("🔍 Buscando uma conversa com IA ativada...");
  const convRes = await pool.query("SELECT id, contact_id FROM conversations WHERE company_id = $1 AND connection_id = $2 AND ai_active = true LIMIT 1", [companyId, connectionId]);
  const conv = convRes.rows[0];
  if (!conv) return console.log("Nenhuma conversa com IA ativada encontrada.");

  console.log(`✅ Conversa encontrada: ${conv.id} (Contact: ${conv.contact_id})`);

  // Criar mensagem falsa no banco simulando Whatsmeow Service
  const msgContent = "Olá, estou testando a velocidade da automação Baileys agora!";
  console.log(`📝 Inserindo mensagem no banco...`);
  const msgRes = await pool.query(
    "INSERT INTO messages (company_id, conversation_id, sender_type, sender_id, content, content_type, status) VALUES ($1, $2, 'CONTACT', $3, $4, 'TEXT', 'received') RETURNING id",
    [companyId, conv.id, conv.contact_id, msgContent]
  );
  const msgId = msgRes.rows[0].id;
  console.log(`✅ Mensagem simulada inserida: ${msgId}`);

  // Disparar Webhook
  console.log(`🚀 Disparando Webhook HTTP para localhost:3000...`);
  const payload = {
    companyId,
    data: {
      conversationId: conv.id,
      savedMessageId: msgId,
      connectionId: connectionId,
      contactPhone: '5511999999999',
      contactName: 'Test Contact',
      messageContent: msgContent,
      messageType: 'TEXT',
      isFromMe: false
    }
  };

  const startTime = Date.now();
  const whRes = await fetch('http://localhost:3000/api/v1/webhooks/baileys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log(`✅ Webhook disparado. Status: ${whRes.status}`);

  console.log(`⏳ Aguardando IA responder no banco de dados (timeout 25s)...`);
  
  for(let i=0; i<25; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const aiMsgRes = await pool.query(
      "SELECT id, content, created_at FROM messages WHERE conversation_id = $1 AND sender_type = 'AI' AND created_at > (NOW() - INTERVAL '1 minute') ORDER BY created_at DESC LIMIT 1",
      [conv.id]
    );
    if (aiMsgRes.rows.length > 0 && aiMsgRes.rows[0].id !== msgId) {
       const delay = Date.now() - startTime;
       console.log(`🎉 SUCESSO! A IA respondeu em ${delay}ms.`);
       console.log(`🤖 Mensagem da IA: "${aiMsgRes.rows[0].content}"`);
       process.exit(0);
    }
  }
  
  console.log(`❌ FALHA: A IA não respondeu após 25 segundos.`);
  process.exit(1);
}

runTest().catch(console.error);
