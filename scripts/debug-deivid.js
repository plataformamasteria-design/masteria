const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT c.id, c.name
      FROM contacts c
      WHERE c.name ILIKE '%Deivid%'
      LIMIT 5
    `);
    
    for (const c of res.rows) {
       console.log("Contact:", c.id, c.name);
       const execRes = await pool.query(`
          SELECT id, started_at, status FROM automation_flow_executions 
          WHERE contact_id = $1 ORDER BY started_at DESC LIMIT 3
       `, [c.id]);
       
       console.log(`Executions: ${execRes.rows.length}`);
       execRes.rows.forEach(e => console.log(` - ${e.id} [${e.status}]`));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
