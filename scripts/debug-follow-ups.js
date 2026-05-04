const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT l.node_id, l.node_type, l.status, l.message, l.input_data, l.output_data, l.created_at
      FROM automation_execution_logs l
      WHERE l.node_type = 'follow_up_ai'
      ORDER BY l.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${res.rows.length} execution logs for follow_up_ai nodes.`);
    res.rows.forEach(r => {
      console.log(`\n--- LOG [${r.created_at}] ---`);
      console.log(`Node: ${r.node_id} | Status: ${r.status}`);
      console.log(`Message: ${r.message}`);
      if (r.output_data) console.log(`Output: ${JSON.stringify(r.output_data).substring(0, 200)}`);
    });

    // Let's also check active paused executions to see where they are waiting
    const pausedRes = await pool.query(`
      SELECT id, contact_id, current_step_id, variables, started_at
      FROM automation_flow_executions
      WHERE status = 'paused'
      ORDER BY started_at DESC
      LIMIT 10
    `);
    console.log(`\nFound ${pausedRes.rows.length} currently paused executions.`);
    pausedRes.rows.forEach(r => {
       const vars = r.variables?.vars || {};
       console.log(`Execution ${r.id} | Step: ${r.current_step_id} | AI Timeout: ${vars._ai_timeout_at ? new Date(vars._ai_timeout_at).toISOString() : 'None'} | Timeout Step: ${vars._ai_step_id || 'None'}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
