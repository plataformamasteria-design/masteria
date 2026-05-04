const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT id, variables FROM automation_flow_executions WHERE status = 'paused'
    `);
    
    let updated = 0;
    for (const row of res.rows) {
       const vars = row.variables?.vars || {};
       if (vars._ai_timeout_at) {
          // If it's a follow up or AI timeout and the timeout is > 5 minutes in the future, set it to now
          if (vars._ai_timeout_at > Date.now() + 300000) {
             vars._ai_timeout_at = Date.now() - 1000; // Past
             await pool.query(
                `UPDATE automation_flow_executions SET variables = $1 WHERE id = $2`,
                [JSON.stringify({ vars }), row.id]
             );
             updated++;
          }
       }
    }
    console.log(`Forced ${updated} paused executions to timeout immediately.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
