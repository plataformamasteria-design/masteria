const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0'; // Douglas Bot
    const flowRes = await pool.query("SELECT visual_data FROM automation_flows WHERE id = $1", [flowId]);
    const flow = flowRes.rows[0];
    
    let visual = typeof flow.visual_data === 'string' ? JSON.parse(flow.visual_data) : flow.visual_data;
    
    console.log("=== AI AGENT NODES ===");
    visual.nodes.filter(n => n.type === 'ai_agent').forEach(n => {
       console.log(`Node ID: ${n.id}`);
       console.log(`Config: timeout_enabled=${n.data.timeout_enabled}, legacy=${n.data.response_timeout_enabled}`);
       console.log(`Amount: ${n.data.timeout_amount}, legacy=${n.data.response_timeout_minutes}`);
    });

    console.log("\n=== FOLLOW UP NODES ===");
    visual.nodes.filter(n => n.type === 'follow_up_ai').forEach(n => {
       console.log(`Node ID: ${n.id}`);
       console.log(`Config: timeout_enabled=${n.data.timeout_enabled}, legacy=${n.data.response_timeout_enabled}`);
       console.log(`Amount: ${n.data.timeout_amount}, legacy=${n.data.response_timeout_minutes}`);
       console.log(`Unit: ${n.data.timeout_unit}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
