const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0'; // Douglas Bot
    const flowRes = await pool.query("SELECT visual_data FROM automation_flows WHERE id = $1", [flowId]);
    const flow = flowRes.rows[0];
    
    let visual = typeof flow.visual_data === 'string' ? JSON.parse(flow.visual_data) : flow.visual_data;
    
    console.log("=== AI AGENT PROMPTS ===");
    visual.nodes.filter(n => n.type === 'ai_agent').forEach(n => {
       console.log(`\nNode ID: ${n.id} | Name: ${n.data.agent_name}`);
       console.log(`Prompt: ${n.data.system_message || n.data.systemPrompt}`);
    });

    console.log("\n=== FOLLOW UP PROMPTS ===");
    visual.nodes.filter(n => n.type === 'follow_up_ai').forEach(n => {
       console.log(`\nNode ID: ${n.id} | Label: ${n.data.label}`);
       console.log(`Prompt: ${n.data.followup_prompt}`);
    });

    console.log("\n=== RECENT MESSAGES FOR DEIVID ===");
    // Deivid contact ID? We can find by phone or name
    const msgRes = await pool.query(`
      SELECT m.id, m.content, m.sender_type, m.status, m.sent_at, c.name as contact_name
      FROM messages m
      JOIN conversations conv ON m.conversation_id = conv.id
      JOIN contacts c ON conv.contact_id = c.id
      WHERE c.name ILIKE '%Deivid%'
      ORDER BY m.sent_at DESC
      LIMIT 15
    `);
    
    msgRes.rows.forEach(r => {
      console.log(`[${r.sent_at}] [${r.sender_type}] ${r.content.substring(0, 150)}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
