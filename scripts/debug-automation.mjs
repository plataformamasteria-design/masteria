async function q(sql) {
  const host = 'ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech';
  const resp = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': `postgresql://neondb_owner:npg_3A4aphDSoLUZ@${host}/neondb?sslmode=require`,
    },
    body: JSON.stringify({ query: sql, params: [] }),
  });
  return await resp.json();
}

async function run() {
  // 1. Find the timestamp column name
  console.log('\n=== 1. MESSAGES COLUMN NAMES ===');
  const r1 = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position");
  console.log((r1.rows || []).map(r => r.column_name).join(', '));
  
  // 2. Get the actual message with correct timestamp column
  console.log('\n=== 2. MESSAGE 3909a5dc FULL ===');
  const r2 = await q("SELECT id, conversation_id, sender_type, content, content_type, status FROM messages WHERE id = '3909a5dc-d271-4091-b7ce-c790a7407947'");
  console.log(JSON.stringify(r2.rows?.[0], null, 2));
  
  // 3. Check how many times this message was processed in automation_logs
  console.log('\n=== 3. RETRY COUNT FOR MESSAGE 3909a5dc ===');
  const r3 = await q("SELECT COUNT(*) as cnt FROM automation_logs WHERE message LIKE '%3909a5dc%'");
  console.log('Times processed:', r3.rows?.[0]?.cnt);
  
  // 4. Check the conversation with last 3 messages
  console.log('\n=== 4. LAST 3 MESSAGES IN CONV ===');
  const r4 = await q("SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND column_name LIKE '%at%' OR (table_name = 'messages' AND column_name LIKE '%date%') OR (table_name = 'messages' AND column_name LIKE '%time%')");
  console.log('Time columns:', (r4.rows || []).map(r => r.column_name).join(', '));
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
