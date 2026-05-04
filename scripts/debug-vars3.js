const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const contactId = '3d466445-5a60-4910-b9c5-4a6e57856c34';
    
    const res = await pool.query(`
      SELECT c.id, c.name, c.notes
      FROM contacts c
      WHERE c.id = $1
    `, [contactId]);
    
    console.log("Contact notes:", res.rows[0].notes);
       
    const execRes = await pool.query(`
       SELECT variables FROM automation_flow_executions 
       WHERE contact_id = $1 ORDER BY started_at DESC LIMIT 1
    `, [contactId]);
       
    if (execRes.rows.length) {
       const vars = execRes.rows[0].variables?.vars || {};
       console.log("nota_interna:", vars.nota_interna);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
