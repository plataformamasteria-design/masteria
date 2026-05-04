const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT c.id, c.name, c.phone, c.notes
      FROM contacts c
      WHERE c.name ILIKE '%Deivid%'
      LIMIT 1
    `);
    
    if (res.rows.length) {
       console.log("Contact notes:", res.rows[0].notes);
       
       const execRes = await pool.query(`
          SELECT variables FROM automation_flow_executions 
          WHERE contact_id = $1 ORDER BY started_at DESC LIMIT 1
       `, [res.rows[0].id]);
       
       if (execRes.rows.length) {
          console.log("Execution variables:", JSON.stringify(execRes.rows[0].variables, null, 2).substring(0, 500));
       }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
