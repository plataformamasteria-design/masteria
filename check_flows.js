const { Pool } = require('pg');
async function run() {
  const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
  
  const res = await pool.query("SELECT id, name, is_active, company_id, execution_logic FROM automation_flows WHERE is_active = true ORDER BY created_at DESC LIMIT 5");
  
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run().catch(console.error);
