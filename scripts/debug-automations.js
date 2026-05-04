const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0';
    const flowRes = await pool.query("SELECT execution_logic FROM automation_flows WHERE id = $1", [flowId]);
    const logic = typeof flowRes.rows[0].execution_logic === 'string' ? JSON.parse(flowRes.rows[0].execution_logic) : flowRes.rows[0].execution_logic;
    const steps = logic.steps || logic;
    
    const aiAgent = steps.find(s => s.id === 'ai_agent_1777482851759');
    console.log('AI Agent Data:', JSON.stringify(aiAgent.data, null, 2));
    
    const followUpNode = steps.find(s => s.type === 'follow_up_ai');
    console.log('Follow Up Agent Data:', JSON.stringify(followUpNode?.data || {}, null, 2));
  } finally {
    await pool.end();
  }
}
run();
