const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0'; // Douglas Bot
    const flowRes = await pool.query("SELECT execution_logic FROM automation_flows WHERE id = $1", [flowId]);
    const flow = flowRes.rows[0];
    
    let logic = typeof flow.execution_logic === 'string' ? JSON.parse(flow.execution_logic) : flow.execution_logic;
    
    console.log("=== CONNECTIONS ===");
    logic.steps.forEach(s => {
       if (s.type === 'follow_up_ai' || s.type === 'ai_agent') {
           console.log(`${s.type} (${s.id}) connections:`, JSON.stringify(s.connections));
       }
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
