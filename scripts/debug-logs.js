const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT e.id, c.name, e.started_at, e.status, e.current_step_id
      FROM automation_flow_executions e
      JOIN contacts c ON e.contact_id = c.id
      WHERE c.name ILIKE '%Deivid Rodrigues%'
      ORDER BY e.started_at DESC
      LIMIT 1
    `);
    
    if (res.rows.length) {
       const execId = res.rows[0].id;
       console.log(`Execution ${execId} for ${res.rows[0].name}`);
       
       const logs = await pool.query(`
          SELECT node_id, node_type, status, message, output_data, created_at
          FROM automation_execution_logs
          WHERE execution_id = $1
          ORDER BY created_at ASC
       `, [execId]);
       
       logs.rows.forEach(l => {
          console.log(`\n[${l.created_at}] ${l.node_id} (${l.node_type}) -> ${l.status}`);
          console.log(`Message: ${l.message}`);
          if (l.output_data?.sourceHandle) console.log(`Handle: ${l.output_data.sourceHandle}`);
       });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
